import { prisma } from '../prisma';
import type { Prisma } from '@prisma/client';
import {
  createAccessToken,
  createRefreshToken,
  generateRefreshTokenRaw,
  hashRefreshToken,
  verifyPassword,
  verifyRefreshToken,
} from '../auth';
import {
  BranchAccessDeniedError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  AccountDisabledError,
} from '../errors';
import {
  getPermissions,
  isMultiBranchUser,
  type Permission,
  type UserRole,
} from '@oase/shared';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface BranchSummary {
  id: string;
  code: string;
  name: string;
}

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  name: string | null;
  activeBranchId: string | null;
  branchContext?: string | null;
  branches: BranchSummary[];
  permissions: Permission[];
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Ambil daftar branch yang boleh diakses user.
 * OWNER: akses semua cabang, tapi tanpa assignment (API-CONTRACT: branches []).
 * Non-OWNER: dari EmployeeBranch yang aktif dan cabangnya aktif.
 */
export async function getAssignedBranches(userId: string): Promise<BranchSummary[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, employeeId: true },
  });

  if (!user || user.role === 'OWNER' || !user.employeeId) return [];

  const assignments = await prisma.employeeBranch.findMany({
    where: { employeeId: user.employeeId, active: true, branch: { active: true } },
    select: { branch: { select: { id: true, code: true, name: true } } },
    orderBy: { branch: { code: 'asc' } },
  });

  return assignments.map((a) => a.branch);
}

/**
 * Terbitkan pasangan token baru + simpan hash refresh token (SHA-256) di DB.
 * Cookie menyimpan JWT-nya; DB hanya menyimpan hash sehingga token bisa direvoke
 * dan tidak pernah tersimpan dalam bentuk plaintext.
 */
async function issueSession(
  params: {
    userId: string;
    email: string;
    role: UserRole;
    branchId: string | null;
    employeeId: string | null;
    branchCount?: number;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<SessionTokens> {
  const accessToken = await createAccessToken({
    userId: params.userId,
    email: params.email,
    role: params.role,
    branchId: params.branchId,
    employeeId: params.employeeId,
    branchCount: params.branchCount,
  });

  const refreshToken = await createRefreshToken({
    userId: params.userId,
    tokenId: generateRefreshTokenRaw(),
    branchId: params.branchId,
  });

  await db.refreshToken.create({
    data: {
      userId: params.userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });

  return { accessToken, refreshToken };
}

/**
 * Login: email + password.
 * - Single-branch (CASHIER dll): otomatis masuk tanpa interstisial.
 * - Multi-branch: re-validasi rememberedBranch 30 hari (Amandemen A2), jika valid auto-apply,
 *   jika tidak diarahkan ke interstisial /select-branch.
 */
export async function login(input: {
  identifier?: string;
  email?: string;
  password: string;
  ip: string | null;
  rememberedBranch?: string | null;
}): Promise<{
  user: PublicUser;
  tokens: SessionTokens;
  branchContext: string | null;
  rememberedApplied: boolean;
}> {
  const rawIdentifier = (input.identifier || input.email || '').trim().toLowerCase();

  // Prioritas lookup: email dulu, lalu username (keduanya case-insensitive)
  let user = await prisma.user.findFirst({
    where: {
      email: { equals: rawIdentifier, mode: 'insensitive' },
    },
    include: { employee: { select: { name: true, active: true } } },
  });

  if (!user) {
    user = await prisma.user.findFirst({
      where: {
        username: { equals: rawIdentifier, mode: 'insensitive' },
      },
      include: { employee: { select: { name: true, active: true } } },
    });
  }

  const passwordValid = user ? await verifyPassword(input.password, user.passwordHash) : false;

  // Kredensial salah (user tidak ditemukan atau password tidak cocok) -> pesan samar 401 UNAUTHORIZED
  if (!user || !passwordValid) {
    // Audit tanpa PII: simpan id bila user dikenal, tidak menyimpan email/password.
    await prisma.auditLog.create({
      data: {
        actorId: user?.id ?? null,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user?.id ?? null,
        ip: input.ip,
        note: 'Login gagal: kredensial salah',
      },
    });

    // Pesan sengaja generik agar tidak membocorkan email mana yang terdaftar.
    throw new UnauthorizedError('Email atau password salah');
  }

  // Kredensial BENAR, tapi akun nonaktif (Amandemen A2) -> pesan jelas 401 ACCOUNT_DISABLED
  if (!user.active) {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user.id,
        ip: input.ip,
        note: 'Login gagal: akun dinonaktifkan',
      },
    });

    throw new AccountDisabledError('Akun telah dinonaktifkan. Hubungi administrator.');
  }

  const role = user.role as UserRole;

  if (role !== 'OWNER' && !user.employeeId) {
    throw new ForbiddenError('Akun non-OWNER belum terhubung ke data karyawan');
  }

  // Kredensial BENAR, tapi karyawan nonaktif (Amandemen A2) -> pesan jelas 401 ACCOUNT_DISABLED
  if (role !== 'OWNER' && user.employee && !user.employee.active) {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user.id,
        ip: input.ip,
        note: 'Login gagal: data karyawan dinonaktifkan',
      },
    });
    throw new AccountDisabledError('Data karyawan telah dinonaktifkan. Hubungi administrator.');
  }

  const branches = await getAssignedBranches(user.id);

  if (role !== 'OWNER' && branches.length === 0) {
    throw new ForbiddenError('Akun belum punya penempatan cabang aktif');
  }

  let activeBranchId: string | null = null;
  let branchContext: string | null = null;
  let rememberedApplied = false;

  const isMultiBranch = isMultiBranchUser({ role, branches });

  if (!isMultiBranch) {
    // User terikat 1 cabang (CASHIER dll.): login langsung masuk, TANPA langkah pilih cabang.
    activeBranchId = branches[0]?.id ?? null;
    branchContext = activeBranchId;
  } else {
    // User multi-cabang: re-validasi server-side terhadap assignment aktif saat login (Amandemen A2)
    if (input.rememberedBranch) {
      if (role === 'OWNER') {
        if (input.rememberedBranch === 'ALL') {
          activeBranchId = null;
          branchContext = 'ALL';
          rememberedApplied = true;
        } else {
          const branch = await prisma.branch.findUnique({
            where: { id: input.rememberedBranch },
          });
          if (branch && branch.active) {
            activeBranchId = branch.id;
            branchContext = branch.id;
            rememberedApplied = true;
          }
        }
      } else {
        const found = branches.find((b) => b.id === input.rememberedBranch);
        if (found) {
          activeBranchId = found.id;
          branchContext = found.id;
          rememberedApplied = true;
        }
      }
    }
  }

  const tokens = await issueSession({
    userId: user.id,
    email: user.email,
    role,
    branchId: activeBranchId,
    employeeId: user.employeeId,
    branchCount: branches.length,
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      ip: input.ip,
    },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      role,
      name: user.employee?.name ?? null,
      activeBranchId,
      branchContext,
      branches,
      permissions: getPermissions(role),
    },
    tokens,
    branchContext,
    rememberedApplied,
  };
}

/**
 * Bentuk PublicUser dari userId + branch aktif (dipakai /auth/me & select-branch).
 */
export async function getSessionUser(
  userId: string,
  activeBranchId: string | null,
  branchContext?: string | null,
): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { employee: { select: { name: true } } },
  });

  if (!user || !user.active) {
    throw new UnauthorizedError('Akun tidak aktif atau tidak ditemukan');
  }

  const role = user.role as UserRole;
  const branches = await getAssignedBranches(user.id);
  const effectiveContext = branchContext !== undefined ? branchContext : activeBranchId;

  return {
    id: user.id,
    email: user.email,
    role,
    name: user.employee?.name ?? null,
    activeBranchId,
    branchContext: effectiveContext,
    branches,
    permissions: getPermissions(role),
  };
}

/**
 * Rotasi access token memakai refresh token dari cookie.
 * Token lama langsung direvoke (rotation) agar tidak bisa dipakai dua kali.
 */
export async function refreshSession(
  rawRefreshToken: string,
  currentBranchContext?: string | null,
): Promise<{
  user: PublicUser;
  tokens: SessionTokens;
  branchContext: string | null;
}> {
  let payload;
  try {
    payload = await verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new UnauthorizedError('Refresh token tidak valid atau kedaluwarsa');
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(rawRefreshToken) },
    include: {
      user: {
        include: { employee: { select: { name: true, active: true } } },
      },
    },
  });

  if (!stored) {
    throw new UnauthorizedError('Refresh token sudah tidak berlaku');
  }

  const user = stored.user;

  if (!user) {
    throw new UnauthorizedError('Akun tidak ditemukan');
  }

  if (!user.active) {
    throw new AccountDisabledError('Akun telah dinonaktifkan. Hubungi administrator.');
  }

  if (user.role !== 'OWNER' && user.employee && !user.employee.active) {
    throw new AccountDisabledError('Data karyawan telah dinonaktifkan. Hubungi administrator.');
  }

  if (stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
    throw new UnauthorizedError('Refresh token sudah tidak berlaku');
  }

  const role = user.role as UserRole;
  const branches = await getAssignedBranches(user.id);

  // Amandemen A2: Pertahankan branchContext yang ada dari session cookie
  const effectiveBranchContext = currentBranchContext ?? payload.branchId;

  // Revoke token lama & terbitkan yang baru dalam satu transaction.
  const tokens = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return issueSession(
      {
        userId: user.id,
        email: user.email,
        role,
        branchId: payload.branchId,
        employeeId: user.employeeId,
        branchCount: branches.length,
      },
      tx
    );
  });

  return {
    user: await getSessionUser(user.id, payload.branchId, effectiveBranchContext),
    tokens,
    branchContext: effectiveBranchContext,
  };
}

/**
 * Logout: revoke refresh token milik user ini.
 * Token yang tidak dikenal diabaikan agar logout tetap idempoten.
 */
export async function logout(input: {
  rawRefreshToken: string | null;
  actorId: string | null;
  ip: string | null;
}): Promise<void> {
  if (input.rawRefreshToken) {
    const tokenHash = hashRefreshToken(input.rawRefreshToken);

    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  if (input.actorId) {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: 'LOGOUT',
        entity: 'User',
        entityId: input.actorId,
        ip: input.ip,
      },
    });
  }
}

/**
 * Pilih konteks cabang kerja (Amandemen A1: satu pintu untuk seluruh role).
 * - Role OWNER: boleh memilih "ALL" (Semua Cabang) ATAU UUID cabang aktif spesifik.
 * - Role Non-OWNER: hanya boleh memilih cabang yang di-assign dan aktif; "ALL" dilarang (403 FORBIDDEN).
 */
export async function selectBranch(input: {
  userId: string;
  role: UserRole;
  branchId: string;
  remember?: boolean;
  rawRefreshToken: string | null;
  ip: string | null;
}): Promise<{ user: PublicUser; tokens: SessionTokens; branchContext: string }> {
  let targetBranchId: string | null = null;
  let targetBranchCode = 'ALL';
  let branchContext = input.branchId;

  if (input.branchId === 'ALL') {
    if (input.role !== 'OWNER') {
      throw new ForbiddenError('Hanya OWNER yang dapat memilih Semua Cabang (Pusat)');
    }
    targetBranchId = null;
    branchContext = 'ALL';
  } else {
    if (input.role === 'OWNER') {
      const branch = await prisma.branch.findUnique({
        where: { id: input.branchId },
      });
      if (!branch || !branch.active) {
        throw new NotFoundError('Cabang tidak ditemukan atau sudah tidak aktif');
      }
      targetBranchId = branch.id;
      targetBranchCode = branch.code;
      branchContext = branch.id;
    } else {
      const branches = await getAssignedBranches(input.userId);
      const target = branches.find((b) => b.id === input.branchId);
      if (!target) {
        throw new BranchAccessDeniedError();
      }
      targetBranchId = target.id;
      targetBranchCode = target.code;
      branchContext = target.id;
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, employeeId: true, active: true },
  });

  if (!user || !user.active) {
    throw new UnauthorizedError('Akun tidak aktif atau tidak ditemukan');
  }

  const oldToken = input.rawRefreshToken
    ? await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(input.rawRefreshToken) },
      })
    : null;

  const branches = await getAssignedBranches(input.userId);

  const tokens = await prisma.$transaction(async (tx) => {
    if (oldToken && !oldToken.revokedAt) {
      await tx.refreshToken.update({
        where: { id: oldToken.id },
        data: { revokedAt: new Date() },
      });
    }

    const newTokens = await issueSession(
      {
        userId: input.userId,
        email: user.email,
        role: input.role,
        branchId: targetBranchId,
        employeeId: user.employeeId,
        branchCount: branches.length,
      },
      tx
    );

    await tx.auditLog.create({
      data: {
        actorId: input.userId,
        action: 'SWITCH_BRANCH',
        entity: 'Branch',
        entityId: targetBranchId ?? input.userId,
        ip: input.ip,
        note: 'Konteks cabang diubah ke ' + targetBranchCode,
      },
    });

    return newTokens;
  });

  return {
    user: await getSessionUser(input.userId, targetBranchId, branchContext),
    tokens,
    branchContext,
  };
}

/**
 * @deprecated Digantikan oleh selectBranch() (Amandemen A1: satu pintu untuk seluruh role).
 * Dijadwalkan dihapus pada v2.1.
 */
export async function switchBranch(input: {
  userId: string;
  role: UserRole;
  branchId: string;
  rawRefreshToken: string | null;
  ip: string | null;
}): Promise<{ user: PublicUser; tokens: SessionTokens; branchContext: string }> {
  return selectBranch(input);
}
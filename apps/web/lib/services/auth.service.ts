import { prisma } from '../prisma';
import {
  createAccessToken,
  createRefreshToken,
  generateRefreshTokenRaw,
  hashRefreshToken,
  verifyPassword,
  verifyRefreshToken,
} from '../auth';
import { BranchAccessDeniedError, ForbiddenError, UnauthorizedError } from '../errors';
import { getPermissions, type Permission, type UserRole } from '@oase/shared';

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
async function getAssignedBranches(userId: string): Promise<BranchSummary[]> {
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
async function issueSession(params: {
  userId: string;
  email: string;
  role: UserRole;
  branchId: string | null;
  employeeId: string | null;
}): Promise<SessionTokens> {
  const accessToken = await createAccessToken({
    userId: params.userId,
    email: params.email,
    role: params.role,
    branchId: params.branchId,
    employeeId: params.employeeId,
  });

  const refreshToken = await createRefreshToken({
    userId: params.userId,
    tokenId: generateRefreshTokenRaw(),
    branchId: params.branchId,
  });

  await prisma.refreshToken.create({
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
 * activeBranchId sesuai API-CONTRACT — OWNER null, non-OWNER dengan tepat 1
 * assignment di-set otomatis, lebih dari 1 wajib switch-branch dulu.
 */
export async function login(input: {
  email: string;
  password: string;
  ip: string | null;
}): Promise<{ user: PublicUser; tokens: SessionTokens }> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { employee: { select: { name: true, active: true } } },
  });

  const passwordValid = user ? await verifyPassword(input.password, user.passwordHash) : false;

  if (!user || !passwordValid || !user.active) {
    // Audit tanpa PII: simpan id bila user dikenal, tidak menyimpan email/password.
    await prisma.auditLog.create({
      data: {
        actorId: user?.id ?? null,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user?.id ?? null,
        ip: input.ip,
        note: 'Login gagal',
      },
    });

    // Pesan sengaja generik agar tidak membocorkan email mana yang terdaftar.
    throw new UnauthorizedError('Email atau password salah');
  }

  const role = user.role as UserRole;

  if (role !== 'OWNER' && !user.employeeId) {
    throw new ForbiddenError('Akun non-OWNER belum terhubung ke data karyawan');
  }

  if (role !== 'OWNER' && user.employee && !user.employee.active) {
    throw new ForbiddenError('Data karyawan sudah tidak aktif');
  }

  const branches = await getAssignedBranches(user.id);

  if (role !== 'OWNER' && branches.length === 0) {
    throw new ForbiddenError('Akun belum punya penempatan cabang aktif');
  }

  const activeBranchId = branches.length === 1 ? (branches[0]?.id ?? null) : null;

  const tokens = await issueSession({
    userId: user.id,
    email: user.email,
    role,
    branchId: activeBranchId,
    employeeId: user.employeeId,
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
      branches,
      permissions: getPermissions(role),
    },
    tokens,
  };
}

/**
 * Bentuk PublicUser dari userId + branch aktif (dipakai /auth/me & switch-branch).
 */
export async function getSessionUser(
  userId: string,
  activeBranchId: string | null,
): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { employee: { select: { name: true } } },
  });

  if (!user || !user.active) {
    throw new UnauthorizedError('Akun tidak aktif atau tidak ditemukan');
  }

  const role = user.role as UserRole;

  return {
    id: user.id,
    email: user.email,
    role,
    name: user.employee?.name ?? null,
    activeBranchId,
    branches: await getAssignedBranches(user.id),
    permissions: getPermissions(role),
  };
}

/**
 * Rotasi access token memakai refresh token dari cookie.
 * Token lama langsung direvoke (rotation) agar tidak bisa dipakai dua kali.
 */
export async function refreshSession(rawRefreshToken: string): Promise<{
  user: PublicUser;
  tokens: SessionTokens;
}> {
  let payload;
  try {
    payload = await verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new UnauthorizedError('Refresh token tidak valid atau kedaluwarsa');
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(rawRefreshToken) },
  });

  if (!stored || stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
    throw new UnauthorizedError('Refresh token sudah tidak berlaku');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { employee: { select: { name: true } } },
  });

  if (!user || !user.active) {
    throw new UnauthorizedError('Akun tidak aktif atau tidak ditemukan');
  }

  const role = user.role as UserRole;

  // Revoke token lama & terbitkan yang baru dalam satu transaction.
  const tokens = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return issueSession({
      userId: user.id,
      email: user.email,
      role,
      branchId: payload.branchId,
      employeeId: user.employeeId,
    });
  });

  return {
    user: await getSessionUser(user.id, payload.branchId),
    tokens,
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
 * Ganti branch aktif. Hanya untuk non-OWNER (API-CONTRACT bagian 1).
 * Branch tujuan wajib ada di assignment user, jika tidak → BRANCH_ACCESS_DENIED.
 * Refresh token lama direvoke dan diganti yang baru dalam satu transaction
 * (device-scoped rotation, sama seperti pola refreshSession).
 */
export async function switchBranch(input: {
  userId: string;
  role: UserRole;
  branchId: string;
  rawRefreshToken: string | null;
  ip: string | null;
}): Promise<{ user: PublicUser; tokens: SessionTokens }> {
  if (input.role === 'OWNER') {
    throw new ForbiddenError('OWNER sudah memiliki akses ke semua cabang');
  }

  const branches = await getAssignedBranches(input.userId);
  const target = branches.find((b) => b.id === input.branchId);

  if (!target) {
    throw new BranchAccessDeniedError();
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, employeeId: true, active: true },
  });

  if (!user || !user.active) {
    throw new UnauthorizedError('Akun tidak aktif atau tidak ditemukan');
  }

  // Cari refresh token lama di DB (hanya jika dikirim oleh caller).
  // Token yang tidak dikenal / sudah revoked diabaikan agar switch tetap jalan.
  const oldToken = input.rawRefreshToken
    ? await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(input.rawRefreshToken) },
      })
    : null;

  // Revoke token lama + terbitkan yang baru dalam satu transaction —
  // mengikuti persis pola refreshSession() agar tidak ada mekanisme revoke ganda.
  const tokens = await prisma.$transaction(async (tx) => {
    if (oldToken && !oldToken.revokedAt) {
      await tx.refreshToken.update({
        where: { id: oldToken.id },
        data: { revokedAt: new Date() },
      });
    }

    return issueSession({
      userId: input.userId,
      email: user.email,
      role: input.role,
      branchId: target.id,
      employeeId: user.employeeId,
    });
  });

  await prisma.auditLog.create({
    data: {
      actorId: input.userId,
      action: 'SWITCH_BRANCH',
      entity: 'Branch',
      entityId: target.id,
      ip: input.ip,
      note: 'Branch aktif diganti ke ' + target.code,
    },
  });

  return {
    user: await getSessionUser(input.userId, target.id),
    tokens,
  };
}
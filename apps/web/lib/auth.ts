import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';

const BCRYPT_COST = 10;

/**
 * Hash password dengan bcrypt (cost 10+ sesuai PRD 7.1).
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Verifikasi password terhadap hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Payload JWT access token.
 * - userId: ID user
 * - email: email user
 * - role: role user
 * - branchId: branch aktif saat ini (null untuk OWNER yang belum switch)
 * - employeeId: ID employee (null untuk OWNER tanpa employee)
 */
export interface AccessTokenPayload extends JWTPayload {
  userId: string;
  email: string;
  role: string;
  branchId: string | null;
  employeeId: string | null;
}

/**
 * Payload JWT refresh token.
 * - userId: ID user
 * - tokenId: UUID refresh token di DB
 */
export interface RefreshTokenPayload extends JWTPayload {
  userId: string;
  tokenId: string;
  // Branch aktif dibawa di refresh token agar rotasi tidak mereset pilihan
  // hasil switch-branch. Hanya claim JWT, bukan kolom DB.
  branchId: string | null;
}

function getAccessSecret(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET tidak dikonfigurasi');
  return new TextEncoder().encode(secret);
}

function getRefreshSecret(): Uint8Array {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET tidak dikonfigurasi');
  return new TextEncoder().encode(secret);
}

/**
 * Buat access token JWT (umur 15 menit).
 */
export async function createAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getAccessSecret());
}

/**
 * Verifikasi & decode access token.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getAccessSecret());
  return payload as unknown as AccessTokenPayload;
}

/**
 * Buat refresh token JWT (umur 7 hari).
 */
export async function createRefreshToken(payload: RefreshTokenPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getRefreshSecret());
}

/**
 * Verifikasi & decode refresh token.
 */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, getRefreshSecret());
  return payload as unknown as RefreshTokenPayload;
}

/**
 * Generate random token string (untuk refresh token raw).
 */
export function generateRefreshTokenRaw(): string {
  return randomBytes(48).toString('hex');
}

/**
 * Hash refresh token untuk disimpan di DB (SHA-256).
 */
export function hashRefreshToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Cookie name untuk access token.
 */
export const ACCESS_TOKEN_COOKIE = 'access_token';

/**
 * Cookie name untuk refresh token.
 */
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
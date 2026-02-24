import { prisma } from '@/lib/db/prisma';
import { generateAccessToken, generateRefreshToken, getAccessTokenExpiry } from './jwt';
import { hashPassword } from './password';
import { JWTPayload, TokenPair } from '@/types';

/**
 * Create a new session for a user with hashed refresh token
 */
export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<TokenPair> {
  // Generate session ID
  const sessionId = crypto.randomUUID();

  // Create JWT payload
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, username: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const payload: JWTPayload = {
    userId,
    email: user.email,
    username: user.username,
    sessionId,
  };

  // Generate tokens
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  
  // Hash refresh token before storing
  const refreshTokenHash = await hashPassword(refreshToken);

  // Store session in database with hashed refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      token: accessToken,
      refreshTokenHash,
      ipAddress,
      userAgent,
      expiresAt,
    },
  });

  // Update last login time
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: getAccessTokenExpiry(),
  };
}

/**
 * Validate if a session exists and is valid
 */
export async function validateSession(sessionId: string): Promise<boolean> {
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  return !!session;
}

/**
 * Revoke a session (logout)
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.session.delete({
    where: { id: sessionId },
  });
}

/**
 * Revoke all sessions for a user
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  });
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}

/**
 * Get active sessions for a user
 */
export async function getUserSessions(userId: string) {
  return prisma.session.findMany({
    where: {
      userId,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

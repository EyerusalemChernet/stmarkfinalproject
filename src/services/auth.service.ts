import { prisma } from '@/lib/db/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession, revokeSession, revokeAllUserSessions } from '@/lib/auth/session';
import { verifyRefreshToken, generateAccessToken, getAccessTokenExpiry } from '@/lib/auth/jwt';
import { LoginCredentials, TokenPair, CreateUserDTO } from '@/types';
import { AuditService } from './audit.service';

/**
 * Authentication Service - Handles all authentication operations
 */
export class AuthService {
  /**
   * Login user with email and password
   */
  static async login(
    credentials: LoginCredentials,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: any; tokens: TokenPair } | null> {
    try {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: credentials.email },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!user) {
        await AuditService.logFailure(
          undefined,
          'LOGIN_FAILED',
          'User',
          'User not found',
          undefined,
          { email: credentials.email },
          ipAddress,
          userAgent
        );
        return null;
      }

      // Check if user is active
      if (user.status !== 'ACTIVE') {
        await AuditService.logFailure(
          user.id,
          'LOGIN_FAILED',
          'User',
          `User status is ${user.status}`,
          user.id,
          { email: credentials.email },
          ipAddress,
          userAgent
        );
        return null;
      }

      // Verify password
      const isValidPassword = await verifyPassword(
        credentials.password,
        user.passwordHash
      );

      if (!isValidPassword) {
        await AuditService.logFailure(
          user.id,
          'LOGIN_FAILED',
          'User',
          'Invalid password',
          user.id,
          { email: credentials.email },
          ipAddress,
          userAgent
        );
        return null;
      }

      // Create session and generate tokens
      const tokens = await createSession(user.id, ipAddress, userAgent);

      // Log successful login
      await AuditService.logSuccess(
        user.id,
        'LOGIN_SUCCESS',
        'User',
        user.id,
        { email: credentials.email },
        ipAddress,
        userAgent
      );

      // Return user without password hash
      const { passwordHash, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        tokens,
      };
    } catch (error) {
      console.error('Login error:', error);
      return null;
    }
  }

  /**
   * Logout user
   */
  static async logout(
    sessionId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await revokeSession(sessionId);

    await AuditService.logSuccess(
      userId,
      'LOGOUT',
      'User',
      userId,
      undefined,
      ipAddress,
      userAgent
    );
  }

  /**
   * Logout from all devices
   */
  static async logoutAll(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await revokeAllUserSessions(userId);

    await AuditService.logSuccess(
      userId,
      'LOGOUT_ALL',
      'User',
      userId,
      undefined,
      ipAddress,
      userAgent
    );
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(
    refreshToken: string
  ): Promise<{ accessToken: string; expiresIn: number } | null> {
    try {
      // Verify refresh token
      const payload = verifyRefreshToken(refreshToken);

      if (!payload) {
        return null;
      }

      // Check if session exists
      const session = await prisma.session.findFirst({
        where: {
          refreshToken,
          userId: payload.userId,
        },
      });

      if (!session) {
        return null;
      }

      // Check if session is expired
      if (session.expiresAt < new Date()) {
        await revokeSession(session.id);
        return null;
      }

      // Generate new access token
      const accessToken = generateAccessToken(payload);

      // Update session with new access token
      await prisma.session.update({
        where: { id: session.id },
        data: { token: accessToken },
      });

      return {
        accessToken,
        expiresIn: getAccessTokenExpiry(),
      };
    } catch (error) {
      console.error('Refresh token error:', error);
      return null;
    }
  }

  /**
   * Register new user
   */
  static async register(
    data: CreateUserDTO,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: any; tokens: TokenPair } | null> {
    try {
      // Check if email already exists
      const existingEmail = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingEmail) {
        return null;
      }

      // Check if username already exists
      const existingUsername = await prisma.user.findUnique({
        where: { username: data.username },
      });

      if (existingUsername) {
        return null;
      }

      // Hash password
      const passwordHash = await hashPassword(data.password);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: data.email,
          username: data.username,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          status: 'ACTIVE',
        },
      });

      // Assign default role if provided
      if (data.roleIds && data.roleIds.length > 0) {
        await Promise.all(
          data.roleIds.map((roleId) =>
            prisma.userRole.create({
              data: {
                userId: user.id,
                roleId,
                assignedBy: 'SYSTEM',
              },
            })
          )
        );
      }

      // Create session and generate tokens
      const tokens = await createSession(user.id, ipAddress, userAgent);

      // Log user creation
      await AuditService.logSuccess(
        user.id,
        'USER_CREATED',
        'User',
        user.id,
        { email: data.email, username: data.username },
        ipAddress,
        userAgent
      );

      // Return user without password hash
      const { passwordHash: _, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        tokens,
      };
    } catch (error) {
      console.error('Registration error:', error);
      return null;
    }
  }
}

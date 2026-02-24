import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/modules/auth/password';
import { CreateUserDTO, UpdateUserDTO, PaginatedResponse } from '@/types';
import { AuditService } from '@/modules/audit/audit.service';

/**
 * User Service - Handles all user management operations
 */
export class UserService {
  /**
   * Create a new user
   */
  static async createUser(
    data: CreateUserDTO,
    createdBy: string
  ): Promise<any> {
    // Check for existing email
    const existingEmail = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingEmail) {
      throw new Error('Email already exists');
    }

    // Check for existing username
    const existingUsername = await prisma.user.findUnique({
      where: { username: data.username },
    });

    if (existingUsername) {
      throw new Error('Username already exists');
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

    // Assign roles if provided
    if (data.roleIds && data.roleIds.length > 0) {
      await Promise.all(
        data.roleIds.map((roleId) =>
          prisma.userRole.create({
            data: {
              userId: user.id,
              roleId,
              assignedBy: createdBy,
            },
          })
        )
      );
    }

    // Log user creation
    await AuditService.logSuccess(
      createdBy,
      'USER_CREATED',
      'User',
      user.id,
      { email: data.email, username: data.username }
    );

    // Return user without password
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<any | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Get all users with pagination and filtering
   */
  static async getUsers(params: {
    page?: number;
    limit?: number;
    status?: string;
    role?: string;
    search?: string;
  }): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 10, status, role, search } = params;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (role) {
      where.roles = {
        some: {
          role: {
            name: role,
          },
        },
      };
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update user
   */
  static async updateUser(
    userId: string,
    data: UpdateUserDTO,
    updatedBy: string
  ): Promise<any> {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new Error('User not found');
    }

    // Check for email uniqueness if email is being updated
    if (data.email && data.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (emailExists) {
        throw new Error('Email already exists');
      }
    }

    // Check for username uniqueness if username is being updated
    if (data.username && data.username !== existingUser.username) {
      const usernameExists = await prisma.user.findUnique({
        where: { username: data.username },
      });

      if (usernameExists) {
        throw new Error('Username already exists');
      }
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data,
    });

    // Log user update
    await AuditService.logSuccess(
      updatedBy,
      'USER_UPDATED',
      'User',
      userId,
      { changes: data }
    );

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Delete user (soft delete)
   */
  static async deleteUser(userId: string, deletedBy: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Soft delete by setting status to INACTIVE and deletedAt timestamp
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'INACTIVE',
        deletedAt: new Date(),
      },
    });

    // Log user deletion
    await AuditService.logSuccess(
      deletedBy,
      'USER_DELETED',
      'User',
      userId
    );
  }

  /**
   * Assign role to user
   */
  static async assignRole(
    userId: string,
    roleId: string,
    assignedBy: string,
    expiresAt?: Date
  ): Promise<void> {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    // Check if role is already assigned
    const existingAssignment = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    if (existingAssignment) {
      throw new Error('Role already assigned to user');
    }

    // Assign role
    await prisma.userRole.create({
      data: {
        userId,
        roleId,
        assignedBy,
        expiresAt,
      },
    });

    // Log role assignment
    await AuditService.logSuccess(
      assignedBy,
      'ROLE_ASSIGNED',
      'UserRole',
      undefined,
      { userId, roleId, roleName: role.name }
    );
  }

  /**
   * Remove role from user
   */
  static async removeRole(
    userId: string,
    roleId: string,
    removedBy: string
  ): Promise<void> {
    const userRole = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
      include: {
        role: true,
      },
    });

    if (!userRole) {
      throw new Error('Role assignment not found');
    }

    await prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    // Log role removal
    await AuditService.logSuccess(
      removedBy,
      'ROLE_REMOVED',
      'UserRole',
      undefined,
      { userId, roleId, roleName: userRole.role.name }
    );
  }
}

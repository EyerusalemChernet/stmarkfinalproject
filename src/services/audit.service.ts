import { prisma } from '@/lib/db/prisma';
import { AuditLogData } from '@/types';

/**
 * Audit Service - Handles all audit logging operations
 */
export class AuditService {
  /**
   * Create an audit log entry
   */
  static async log(data: AuditLogData): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          details: data.details || {},
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          status: data.status,
          errorMessage: data.errorMessage,
        },
      });
    } catch (error) {
      // Don't throw error to prevent audit logging from breaking the main flow
      console.error('Failed to create audit log:', error);
    }
  }

  /**
   * Log successful action
   */
  static async logSuccess(
    userId: string,
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource,
      resourceId,
      details,
      ipAddress,
      userAgent,
      status: 'SUCCESS',
    });
  }

  /**
   * Log failed action
   */
  static async logFailure(
    userId: string | undefined,
    action: string,
    resource: string,
    errorMessage: string,
    resourceId?: string,
    details?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource,
      resourceId,
      details,
      ipAddress,
      userAgent,
      status: 'FAILURE',
      errorMessage,
    });
  }

  /**
   * Get audit logs with filtering and pagination
   */
  static async getLogs(params: {
    userId?: string;
    action?: string;
    resource?: string;
    status?: 'SUCCESS' | 'FAILURE';
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const {
      userId,
      action,
      resource,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = params;

    const where: any = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get audit logs for a specific resource
   */
  static async getResourceHistory(
    resource: string,
    resourceId: string,
    page: number = 1,
    limit: number = 20
  ) {
    return this.getLogs({
      resource,
      page,
      limit,
    });
  }

  /**
   * Get user activity history
   */
  static async getUserActivity(
    userId: string,
    page: number = 1,
    limit: number = 20
  ) {
    return this.getLogs({
      userId,
      page,
      limit,
    });
  }

  /**
   * Get failed login attempts
   */
  static async getFailedLoginAttempts(
    email?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const where: any = {
      action: 'LOGIN_FAILED',
      status: 'FAILURE',
    };

    if (email) {
      where.details = {
        path: ['email'],
        equals: email,
      };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    return prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}

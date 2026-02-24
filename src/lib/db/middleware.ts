import { Prisma } from '@prisma/client';

/**
 * Soft Delete Middleware for Prisma
 * Automatically filters out soft-deleted records for User model
 */
export function createSoftDeleteMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    // Only apply to User model operations
    if (params.model === 'User') {
      // Handle different query types
      if (params.action === 'findUnique' || params.action === 'findFirst') {
        // Modify where clause to exclude soft-deleted records
        params.args.where = {
          ...params.args.where,
          deletedAt: null,
        };
      }

      if (params.action === 'findMany') {
        // Check if explicitly requesting deleted records
        const includeDeleted = params.args.where?.includeDeleted;
        
        if (!includeDeleted) {
          // Add deletedAt filter if not explicitly requesting deleted records
          if (params.args.where) {
            delete params.args.where.includeDeleted;
            params.args.where = {
              ...params.args.where,
              deletedAt: null,
            };
          } else {
            params.args.where = { deletedAt: null };
          }
        } else {
          // Remove the includeDeleted flag before executing query
          delete params.args.where.includeDeleted;
        }
      }

      if (params.action === 'update') {
        // Ensure we're not updating soft-deleted records
        params.args.where = {
          ...params.args.where,
          deletedAt: null,
        };
      }

      if (params.action === 'updateMany') {
        // Ensure we're not updating soft-deleted records
        if (params.args.where) {
          params.args.where = {
            ...params.args.where,
            deletedAt: null,
          };
        } else {
          params.args.where = { deletedAt: null };
        }
      }

      if (params.action === 'delete') {
        // Convert hard delete to soft delete
        params.action = 'update';
        params.args.data = { deletedAt: new Date() };
      }

      if (params.action === 'deleteMany') {
        // Convert hard delete to soft delete
        params.action = 'updateMany';
        params.args.data = { deletedAt: new Date() };
      }

      // Handle count operations
      if (params.action === 'count') {
        const includeDeleted = params.args.where?.includeDeleted;
        
        if (!includeDeleted) {
          if (params.args.where) {
            delete params.args.where.includeDeleted;
            params.args.where = {
              ...params.args.where,
              deletedAt: null,
            };
          } else {
            params.args.where = { deletedAt: null };
          }
        } else {
          delete params.args.where.includeDeleted;
        }
      }
    }

    return next(params);
  };
}

/**
 * Type extension for Prisma to support includeDeleted flag
 */
declare global {
  namespace PrismaJson {
    interface UserWhereInput {
      includeDeleted?: boolean;
    }
  }
}
import { prisma } from '@/lib/db/prisma';
import { AuthUser, PermissionCheck } from '@/types';

/**
 * Get all permissions for a user based on their roles
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const userWithRoles = await prisma.user.findUnique({
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

  if (!userWithRoles) {
    return [];
  }

  // Extract unique permissions
  const permissions = new Set<string>();

  userWithRoles.roles.forEach((userRole: any) => {
    userRole.role.permissions.forEach((rolePermission: any) => {
      const permissionKey = `${rolePermission.permission.resource}.${rolePermission.permission.action}`;
      permissions.add(permissionKey);
    });
  });

  return Array.from(permissions);
}

/**
 * Check if a user has a specific permission
 */
export async function hasPermission(
  userId: string,
  resource: string,
  action: string
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  const requiredPermission = `${resource}.${action}`;
  
  return permissions.includes(requiredPermission);
}

/**
 * Check if a user has any of the specified permissions
 */
export async function hasAnyPermission(
  userId: string,
  checks: PermissionCheck[]
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  
  return checks.some((check) => {
    const requiredPermission = `${check.resource}.${check.action}`;
    return permissions.includes(requiredPermission);
  });
}

/**
 * Check if a user has all of the specified permissions
 */
export async function hasAllPermissions(
  userId: string,
  checks: PermissionCheck[]
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  
  return checks.every((check) => {
    const requiredPermission = `${check.resource}.${check.action}`;
    return permissions.includes(requiredPermission);
  });
}

/**
 * Get user roles
 */
export async function getUserRoles(userId: string): Promise<string[]> {
  const userWithRoles = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!userWithRoles) {
    return [];
  }

  return userWithRoles.roles.map((userRole: any) => userRole.role.name);
}

/**
 * Build complete AuthUser object with roles and permissions
 */
export async function buildAuthUser(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      status: true,
    },
  });

  if (!user) {
    return null;
  }

  const [roles, permissions] = await Promise.all([
    getUserRoles(userId),
    getUserPermissions(userId),
  ]);

  return {
    ...user,
    roles,
    permissions,
  };
}

/**
 * Check if user can access a resource (ownership check)
 * Prevents horizontal privilege escalation
 */
export async function canAccessResource(
  userId: string,
  resourceOwnerId: string,
  resource: string,
  action: string
): Promise<boolean> {
  // If user is the owner, allow access
  if (userId === resourceOwnerId) {
    return true;
  }

  // Otherwise, check if user has permission to access others' resources
  return hasPermission(userId, resource, action);
}

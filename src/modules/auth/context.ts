import { NextRequest } from 'next/server';
import { verifyAccessToken } from './jwt';
import { prisma } from '@/lib/db/prisma';

/**
 * Strongly typed authentication context
 */
export interface AuthContext {
  isAuthenticated: boolean;
  user?: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    status: string;
  };
  roles: string[];
  permissions: string[];
  sessionId?: string;
  token?: string;
}

/**
 * Unauthenticated context
 */
const UNAUTHENTICATED_CONTEXT: AuthContext = {
  isAuthenticated: false,
  roles: [],
  permissions: [],
};

/**
 * Extract token from Authorization header
 */
function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring(7);
}

/**
 * Build complete authentication context from request
 * This function centralizes all authentication logic and eliminates redundant token verification
 */
export async function buildRequestContext(request: NextRequest): Promise<AuthContext> {
  try {
    // Step 1: Extract token
    const token = extractToken(request);
    if (!token) {
      return UNAUTHENTICATED_CONTEXT;
    }

    // Step 2: Verify JWT (single verification point)
    const payload = verifyAccessToken(token);
    if (!payload) {
      return UNAUTHENTICATED_CONTEXT;
    }

    // Step 3: Validate session exists and is not expired
    const session = await prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!session) {
      return UNAUTHENTICATED_CONTEXT;
    }

    // Step 4: Load user with roles and permissions in a single query
    const userWithRolesAndPermissions = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        status: true,
        roles: {
          select: {
            role: {
              select: {
                name: true,
                permissions: {
                  select: {
                    permission: {
                      select: {
                        resource: true,
                        action: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!userWithRolesAndPermissions) {
      return UNAUTHENTICATED_CONTEXT;
    }

    // Step 5: Extract roles and permissions
    const roles = userWithRolesAndPermissions.roles.map((ur: any) => ur.role.name);
    
    const permissionSet = new Set<string>();
    userWithRolesAndPermissions.roles.forEach((userRole: any) => {
      userRole.role.permissions.forEach((rolePermission: any) => {
        const permissionKey = `${rolePermission.permission.resource}.${rolePermission.permission.action}`;
        permissionSet.add(permissionKey);
      });
    });
    
    const permissions = Array.from(permissionSet);

    // Step 6: Return complete context
    return {
      isAuthenticated: true,
      user: {
        id: userWithRolesAndPermissions.id,
        email: userWithRolesAndPermissions.email,
        username: userWithRolesAndPermissions.username,
        firstName: userWithRolesAndPermissions.firstName,
        lastName: userWithRolesAndPermissions.lastName,
        status: userWithRolesAndPermissions.status,
      },
      roles,
      permissions,
      sessionId: payload.sessionId,
      token,
    };
  } catch (error) {
    console.error('Error building auth context:', error);
    return UNAUTHENTICATED_CONTEXT;
  }
}

/**
 * Check if user has specific permission using cached context
 */
export function hasPermissionInContext(
  context: AuthContext,
  resource: string,
  action: string
): boolean {
  if (!context.isAuthenticated) {
    return false;
  }

  const requiredPermission = `${resource}.${action}`;
  return context.permissions.includes(requiredPermission);
}

/**
 * Check if user has any of the specified permissions using cached context
 */
export function hasAnyPermissionInContext(
  context: AuthContext,
  checks: Array<{ resource: string; action: string }>
): boolean {
  if (!context.isAuthenticated) {
    return false;
  }

  return checks.some(check => {
    const requiredPermission = `${check.resource}.${check.action}`;
    return context.permissions.includes(requiredPermission);
  });
}

/**
 * Check if user has all of the specified permissions using cached context
 */
export function hasAllPermissionsInContext(
  context: AuthContext,
  checks: Array<{ resource: string; action: string }>
): boolean {
  if (!context.isAuthenticated) {
    return false;
  }

  return checks.every(check => {
    const requiredPermission = `${check.resource}.${check.action}`;
    return context.permissions.includes(requiredPermission);
  });
}

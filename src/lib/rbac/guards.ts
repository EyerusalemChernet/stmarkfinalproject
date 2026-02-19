import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { hasPermission, hasAnyPermission, hasAllPermissions } from './permissions';
import { PermissionCheck } from '@/types';

/**
 * Extract token from Authorization header
 */
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring(7);
}

/**
 * Verify authentication and return user ID
 */
export async function verifyAuth(request: NextRequest): Promise<string | null> {
  const token = extractToken(request);
  
  if (!token) {
    return null;
  }

  const payload = verifyAccessToken(token);
  
  if (!payload) {
    return null;
  }

  return payload.userId;
}

/**
 * Permission guard - Check if user has required permission
 * Usage: await requirePermission(request, 'user', 'create')
 */
export async function requirePermission(
  request: NextRequest,
  resource: string,
  action: string
): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const userId = await verifyAuth(request);

  if (!userId) {
    return {
      authorized: false,
      error: 'Unauthorized - Invalid or missing token',
    };
  }

  const hasAccess = await hasPermission(userId, resource, action);

  if (!hasAccess) {
    return {
      authorized: false,
      userId,
      error: `Forbidden - Missing permission: ${resource}.${action}`,
    };
  }

  return {
    authorized: true,
    userId,
  };
}

/**
 * Require any of the specified permissions
 */
export async function requireAnyPermission(
  request: NextRequest,
  checks: PermissionCheck[]
): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const userId = await verifyAuth(request);

  if (!userId) {
    return {
      authorized: false,
      error: 'Unauthorized - Invalid or missing token',
    };
  }

  const hasAccess = await hasAnyPermission(userId, checks);

  if (!hasAccess) {
    const permissionList = checks
      .map((c) => `${c.resource}.${c.action}`)
      .join(', ');
    return {
      authorized: false,
      userId,
      error: `Forbidden - Missing any of: ${permissionList}`,
    };
  }

  return {
    authorized: true,
    userId,
  };
}

/**
 * Require all of the specified permissions
 */
export async function requireAllPermissions(
  request: NextRequest,
  checks: PermissionCheck[]
): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const userId = await verifyAuth(request);

  if (!userId) {
    return {
      authorized: false,
      error: 'Unauthorized - Invalid or missing token',
    };
  }

  const hasAccess = await hasAllPermissions(userId, checks);

  if (!hasAccess) {
    const permissionList = checks
      .map((c) => `${c.resource}.${c.action}`)
      .join(', ');
    return {
      authorized: false,
      userId,
      error: `Forbidden - Missing permissions: ${permissionList}`,
    };
  }

  return {
    authorized: true,
    userId,
  };
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized') {
  return NextResponse.json(
    { success: false, error: message },
    { status: 401 }
  );
}

/**
 * Create forbidden response
 */
export function forbiddenResponse(message: string = 'Forbidden') {
  return NextResponse.json(
    { success: false, error: message },
    { status: 403 }
  );
}

/**
 * Higher-order function to wrap API routes with permission checks
 */
export function withPermission(
  resource: string,
  action: string,
  handler: (request: NextRequest, userId: string) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const authCheck = await requirePermission(request, resource, action);

    if (!authCheck.authorized) {
      return authCheck.error?.includes('Unauthorized')
        ? unauthorizedResponse(authCheck.error)
        : forbiddenResponse(authCheck.error);
    }

    return handler(request, authCheck.userId!);
  };
}

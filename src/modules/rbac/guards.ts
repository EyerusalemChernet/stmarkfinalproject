import { NextRequest, NextResponse } from 'next/server';
import { buildRequestContext, hasPermissionInContext, hasAnyPermissionInContext, hasAllPermissionsInContext, AuthContext } from '@/modules/auth/context';
import { PermissionCheck } from '@/types';

/**
 * Permission guard result
 */
export interface PermissionGuardResult {
  authorized: boolean;
  context: AuthContext;
  error?: string;
}

/**
 * Require specific permission using centralized auth context
 */
export async function requirePermission(
  request: NextRequest,
  resource: string,
  action: string
): Promise<PermissionGuardResult> {
  const context = await buildRequestContext(request);

  if (!context.isAuthenticated) {
    return {
      authorized: false,
      context,
      error: 'Unauthorized - Invalid or missing token',
    };
  }

  const hasAccess = hasPermissionInContext(context, resource, action);

  if (!hasAccess) {
    return {
      authorized: false,
      context,
      error: `Forbidden - Missing permission: ${resource}.${action}`,
    };
  }

  return {
    authorized: true,
    context,
  };
}

/**
 * Require any of the specified permissions using centralized auth context
 */
export async function requireAnyPermission(
  request: NextRequest,
  checks: PermissionCheck[]
): Promise<PermissionGuardResult> {
  const context = await buildRequestContext(request);

  if (!context.isAuthenticated) {
    return {
      authorized: false,
      context,
      error: 'Unauthorized - Invalid or missing token',
    };
  }

  const hasAccess = hasAnyPermissionInContext(context, checks);

  if (!hasAccess) {
    const permissionList = checks
      .map((c) => `${c.resource}.${c.action}`)
      .join(', ');
    return {
      authorized: false,
      context,
      error: `Forbidden - Missing any of: ${permissionList}`,
    };
  }

  return {
    authorized: true,
    context,
  };
}

/**
 * Require all of the specified permissions using centralized auth context
 */
export async function requireAllPermissions(
  request: NextRequest,
  checks: PermissionCheck[]
): Promise<PermissionGuardResult> {
  const context = await buildRequestContext(request);

  if (!context.isAuthenticated) {
    return {
      authorized: false,
      context,
      error: 'Unauthorized - Invalid or missing token',
    };
  }

  const hasAccess = hasAllPermissionsInContext(context, checks);

  if (!hasAccess) {
    const permissionList = checks
      .map((c) => `${c.resource}.${c.action}`)
      .join(', ');
    return {
      authorized: false,
      context,
      error: `Forbidden - Missing permissions: ${permissionList}`,
    };
  }

  return {
    authorized: true,
    context,
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
  handler: (request: NextRequest, context: AuthContext) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const guardResult = await requirePermission(request, resource, action);

    if (!guardResult.authorized) {
      return guardResult.error?.includes('Unauthorized')
        ? unauthorizedResponse(guardResult.error)
        : forbiddenResponse(guardResult.error);
    }

    return handler(request, guardResult.context);
  };
}

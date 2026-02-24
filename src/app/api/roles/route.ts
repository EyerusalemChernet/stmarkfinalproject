import { NextRequest, NextResponse } from 'next/server';
import { RoleService } from '@/modules/rbac/role.service';
import { requirePermission } from '@/modules/rbac/guards';
import { createRoleSchema, sanitizeObject } from '@/modules/rbac/validation';
import { ZodError } from 'zod';

/**
 * GET /api/roles
 * Get all roles
 * Required permission: role.read
 */
export async function GET(request: NextRequest) {
  try {
    // Check permission
    const authCheck = await requirePermission(request, 'role', 'read');

    if (!authCheck.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: authCheck.error,
        },
        { status: authCheck.error?.includes('Unauthorized') ? 401 : 403 }
      );
    }

    // Get roles
    const roles = await RoleService.getRoles();

    return NextResponse.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error('Get roles error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/roles
 * Create a new role
 * Required permission: role.create
 */
export async function POST(request: NextRequest) {
  try {
    // Check permission
    const authCheck = await requirePermission(request, 'role', 'create');

    if (!authCheck.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: authCheck.error,
        },
        { status: authCheck.error?.includes('Unauthorized') ? 401 : 403 }
      );
    }

    const body = await request.json();
    
    // Sanitize input
    const sanitizedBody = sanitizeObject(body);

    // Validate input
    const validatedData = createRoleSchema.parse(sanitizedBody);

    // Create role
    const role = await RoleService.createRole(validatedData, authCheck.context.user!.id);

    return NextResponse.json(
      {
        success: true,
        data: role,
        message: 'Role created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    console.error('Create role error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { RoleService } from '@/services/role.service';
import { requirePermission } from '@/lib/rbac/guards';
import { assignPermissionsSchema, idParamSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

/**
 * PUT /api/roles/[id]/permissions
 * Assign permissions to a role
 * Required permission: permission.assign
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate ID
    const { id } = idParamSchema.parse(params);

    // Check permission
    const authCheck = await requirePermission(request, 'permission', 'assign');

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

    // Validate input
    const { permissionIds } = assignPermissionsSchema.parse(body);

    // Assign permissions
    await RoleService.assignPermissions(id, permissionIds, authCheck.userId!);

    return NextResponse.json({
      success: true,
      message: 'Permissions assigned successfully',
    });
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

    console.error('Assign permissions error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

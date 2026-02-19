import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/services/user.service';
import { requirePermission } from '@/lib/rbac/guards';
import { updateUserSchema, idParamSchema, sanitizeObject } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

/**
 * GET /api/users/[id]
 * Get user by ID
 * Required permission: user.read
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate ID
    const { id } = idParamSchema.parse(params);

    // Check permission
    const authCheck = await requirePermission(request, 'user', 'read');

    if (!authCheck.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: authCheck.error,
        },
        { status: authCheck.error?.includes('Unauthorized') ? 401 : 403 }
      );
    }

    // Get user
    const user = await UserService.getUserById(id);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid user ID',
        },
        { status: 400 }
      );
    }

    console.error('Get user error:', error);
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
 * PATCH /api/users/[id]
 * Update user
 * Required permission: user.update
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate ID
    const { id } = idParamSchema.parse(params);

    // Check permission
    const authCheck = await requirePermission(request, 'user', 'update');

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
    const validatedData = updateUserSchema.parse(sanitizedBody);

    // Update user
    const user = await UserService.updateUser(id, validatedData, authCheck.userId!);

    return NextResponse.json({
      success: true,
      data: user,
      message: 'User updated successfully',
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

    console.error('Update user error:', error);
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
 * DELETE /api/users/[id]
 * Delete user (soft delete)
 * Required permission: user.delete
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate ID
    const { id } = idParamSchema.parse(params);

    // Check permission
    const authCheck = await requirePermission(request, 'user', 'delete');

    if (!authCheck.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: authCheck.error,
        },
        { status: authCheck.error?.includes('Unauthorized') ? 401 : 403 }
      );
    }

    // Prevent self-deletion
    if (id === authCheck.userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete your own account',
        },
        { status: 400 }
      );
    }

    // Delete user
    await UserService.deleteUser(id, authCheck.userId!);

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid user ID',
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

    console.error('Delete user error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

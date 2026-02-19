import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/services/user.service';
import { requirePermission } from '@/lib/rbac/guards';
import { createUserSchema, userFilterSchema, sanitizeObject } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

/**
 * GET /api/users
 * Get all users with pagination and filtering
 * Required permission: user.list
 */
export async function GET(request: NextRequest) {
  try {
    // Check permission
    const authCheck = await requirePermission(request, 'user', 'list');

    if (!authCheck.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: authCheck.error,
        },
        { status: authCheck.error?.includes('Unauthorized') ? 401 : 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const params = {
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      status: searchParams.get('status'),
      role: searchParams.get('role'),
      search: searchParams.get('search'),
    };

    // Validate query parameters
    const validatedParams = userFilterSchema.parse(params);

    // Get users
    const result = await UserService.getUsers(validatedParams);

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
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

    console.error('Get users error:', error);
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
 * POST /api/users
 * Create a new user
 * Required permission: user.create
 */
export async function POST(request: NextRequest) {
  try {
    // Check permission
    const authCheck = await requirePermission(request, 'user', 'create');

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
    const validatedData = createUserSchema.parse(sanitizedBody);

    // Create user
    const user = await UserService.createUser(validatedData, authCheck.userId!);

    return NextResponse.json(
      {
        success: true,
        data: user,
        message: 'User created successfully',
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

    console.error('Create user error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

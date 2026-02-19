import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { loginSchema, sanitizeObject } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

/**
 * POST /api/auth/login
 * Authenticate user and return JWT tokens
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Sanitize input
    const sanitizedBody = sanitizeObject(body);

    // Validate input
    const validatedData = loginSchema.parse(sanitizedBody);

    // Get client info
    const ipAddress = request.ip || request.headers.get('x-forwarded-for') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    // Attempt login
    const result = await AuthService.login(validatedData, ipAddress, userAgent);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email or password',
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user: result.user,
        tokens: result.tokens,
      },
      message: 'Login successful',
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

    console.error('Login error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

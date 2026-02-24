import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/modules/auth/auth.service';
import { z } from 'zod';

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token with rotation and security hardening
 */
export async function POST(request: NextRequest) {
  const ipAddress = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    const body = await request.json();

    // Validate input
    const { refreshToken } = refreshSchema.parse(body);

    // Refresh token with rotation and security checks
    const result = await AuthService.refreshTokenWithRotation(refreshToken, ipAddress, userAgent);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired refresh token',
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Token refreshed successfully',
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

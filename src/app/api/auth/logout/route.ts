import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/modules/auth/auth.service';
import { buildRequestContext } from '@/modules/auth/context';
import { verifyAccessToken } from '@/modules/auth/jwt';

/**
 * POST /api/auth/logout
 * Logout user and revoke session
 */
export async function POST(request: NextRequest) {
  try {
    const context = await buildRequestContext(request);

    if (!context.isAuthenticated || !context.user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { status: 401 }
      );
    }

    // Get session ID from token
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const payload = verifyAccessToken(token!);

    if (!payload) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid token',
        },
        { status: 401 }
      );
    }

    // Get client info
    const ipAddress = request.ip || request.headers.get('x-forwarded-for') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    // Logout
    await AuthService.logout(payload.sessionId, context.user.id, ipAddress, userAgent);

    return NextResponse.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

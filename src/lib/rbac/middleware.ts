import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { validateSession } from '@/lib/auth/session';

/**
 * Authentication middleware for Next.js
 * Add this to middleware.ts to protect routes
 */
export async function authMiddleware(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');

  // Allow public routes
  const publicRoutes = ['/api/auth/login', '/api/auth/register'];
  if (publicRoutes.some((route) => request.nextUrl.pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if token exists
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Verify token
  const payload = verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired token' },
      { status: 401 }
    );
  }

  // Validate session
  const isValidSession = await validateSession(payload.sessionId);
  if (!isValidSession) {
    return NextResponse.json(
      { success: false, error: 'Session expired or invalid' },
      { status: 401 }
    );
  }

  // Add user info to request headers for downstream use
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.userId);
  requestHeaders.set('x-user-email', payload.email);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

/**
 * Rate limiting middleware (basic implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimitMiddleware(
  request: NextRequest,
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
) {
  const ip = request.ip || 'unknown';
  const now = Date.now();

  const rateLimit = rateLimitMap.get(ip);

  if (!rateLimit || now > rateLimit.resetTime) {
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    });
    return NextResponse.next();
  }

  if (rateLimit.count >= maxRequests) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 }
    );
  }

  rateLimit.count++;
  return NextResponse.next();
}

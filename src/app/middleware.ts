import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/rbac/middleware';

/**
 * Middleware configuration
 * This runs before API routes are processed
 */
export async function middleware(request: NextRequest) {
  // Apply authentication middleware to all API routes except public ones
  if (request.nextUrl.pathname.startsWith('/api')) {
    return authMiddleware(request);
  }

  return NextResponse.next();
}

/**
 * Configure which routes the middleware should run on
 */
export const config = {
  matcher: [
    '/api/:path*',
  ],
};

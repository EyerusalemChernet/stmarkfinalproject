import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware configuration
 * This runs before API routes are processed
 * 
 * NOTE: We're using a lightweight approach here to avoid bcrypt in Edge runtime
 */
export async function middleware(request: NextRequest) {
  // Only apply to API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    // Public routes that don't require authentication
    const publicRoutes = [
      '/api/health',
      '/api/auth/login',
      '/api/auth/refresh',
    ];

    const isPublicRoute = publicRoutes.some(route => 
      request.nextUrl.pathname === route || 
      request.nextUrl.pathname.startsWith(route + '/')
    );

    // Allow public routes to pass through
    if (isPublicRoute) {
      return NextResponse.next();
    }

    // For protected routes, check for Authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Missing or invalid token' },
        { status: 401 }
      );
    }

    // Token validation will be done in the API routes themselves
    // This middleware just checks for presence of token
    return NextResponse.next();
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

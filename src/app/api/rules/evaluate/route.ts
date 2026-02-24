import { NextRequest, NextResponse } from 'next/server';
import { RulesService } from '@/modules/rules/rules.service';
import { buildRequestContext } from '@/modules/auth/context';
import { buildAuthUser } from '@/modules/rbac/permissions';
import { ruleEvaluationSchema } from '@/modules/rules/validation';
import { sanitizeObject } from '@/modules/rbac/validation';
import { ZodError } from 'zod';

/**
 * POST /api/rules/evaluate
 * Evaluate rules for a given context
 * This endpoint is for testing purposes - in production, use RulesService directly
 */
export async function POST(request: NextRequest) {
  try {
    const context = await buildRequestContext(request);

    if (!context.isAuthenticated || !context.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const sanitizedBody = sanitizeObject(body);

    // Validate input
    const validatedData = ruleEvaluationSchema.parse(sanitizedBody);

    // Build auth user with roles and permissions
    const authUser = await buildAuthUser(context.user.id);

    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Evaluate rules
    const result = await RulesService.evaluateRules({
      user: {
        id: authUser.id,
        email: authUser.email,
        roles: authUser.roles,
        permissions: authUser.permissions,
      },
      action: validatedData.action,
      moduleName: validatedData.moduleName,
      resourceData: validatedData.resourceData,
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: result,
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

    console.error('Rule evaluation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

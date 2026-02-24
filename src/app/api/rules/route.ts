import { NextRequest, NextResponse } from 'next/server';
import { RulesService } from '@/modules/rules/rules.service';
import { requirePermission } from '@/modules/rbac/guards';
import { createRuleSchema } from '@/modules/rules/validation';
import { sanitizeObject } from '@/modules/rbac/validation';
import { prisma } from '@/lib/db/prisma';
import { ZodError } from 'zod';

/**
 * GET /api/rules
 * Get all rules or filter by module
 * Required permission: rule.read
 */
export async function GET(request: NextRequest) {
  try {
    const authCheck = await requirePermission(request, 'rule', 'read');

    if (!authCheck.authorized) {
      return NextResponse.json(
        { success: false, error: authCheck.error },
        { status: authCheck.error?.includes('Unauthorized') ? 401 : 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const moduleName = searchParams.get('module');

    let rules;
    if (moduleName) {
      rules = await RulesService.getRulesByModule(moduleName);
    } else {
      rules = await prisma.rule.findMany({
        where: { isActive: true },
        orderBy: { priority: 'asc' },
      });
    }

    return NextResponse.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    console.error('Get rules error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rules
 * Create a new rule
 * Required permission: rule.create
 */
export async function POST(request: NextRequest) {
  try {
    const authCheck = await requirePermission(request, 'rule', 'create');

    if (!authCheck.authorized) {
      return NextResponse.json(
        { success: false, error: authCheck.error },
        { status: authCheck.error?.includes('Unauthorized') ? 401 : 403 }
      );
    }

    const body = await request.json();
    const sanitizedBody = sanitizeObject(body);

    // Validate input
    const validatedData = createRuleSchema.parse(sanitizedBody);

    // Create rule
    const rule = await RulesService.createRule(validatedData, authCheck.context.user!.id);

    return NextResponse.json(
      {
        success: true,
        data: rule,
        message: 'Rule created successfully',
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
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.error('Create rule error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

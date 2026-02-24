import { NextRequest, NextResponse } from 'next/server';
import { RulesService } from '@/modules/rules/rules.service';
import { requirePermission } from '@/modules/rbac/guards';
import { updateRuleSchema } from '@/modules/rules/validation';
import { idParamSchema, sanitizeObject } from '@/modules/rbac/validation';
import { ZodError } from 'zod';
import { prisma } from '@/lib/db/prisma';

/**
 * GET /api/rules/[id]
 * Get rule by ID
 * Required permission: rule.read
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = idParamSchema.parse(params);

    const authCheck = await requirePermission(request, 'rule', 'read');

    if (!authCheck.authorized) {
      return NextResponse.json(
        { success: false, error: authCheck.error },
        { status: authCheck.error?.includes('Unauthorized') ? 401 : 403 }
      );
    }

    const rule = await prisma.rule.findUnique({
      where: { id },
      include: {
        childRules: {
          orderBy: { version: 'desc' },
          take: 5,
        },
      },
    });

    if (!rule) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid rule ID' },
        { status: 400 }
      );
    }

    console.error('Get rule error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/rules/[id]
 * Update rule (creates new version)
 * Required permission: rule.update
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = idParamSchema.parse(params);

    const authCheck = await requirePermission(request, 'rule', 'update');

    if (!authCheck.authorized) {
      return NextResponse.json(
        { success: false, error: authCheck.error },
        { status: authCheck.error?.includes('Unauthorized') ? 401 : 403 }
      );
    }

    const body = await request.json();
    const sanitizedBody = sanitizeObject(body);

    // Validate input
    const validatedData = updateRuleSchema.parse(sanitizedBody);

    // Update rule (creates new version)
    const rule = await RulesService.updateRule(id, validatedData, authCheck.context.user!.id);

    return NextResponse.json({
      success: true,
      data: rule,
      message: 'Rule updated successfully (new version created)',
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
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.error('Update rule error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rules/[id]
 * Deactivate rule
 * Required permission: rule.delete
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = idParamSchema.parse(params);

    const authCheck = await requirePermission(request, 'rule', 'delete');

    if (!authCheck.authorized) {
      return NextResponse.json(
        { success: false, error: authCheck.error },
        { status: authCheck.error?.includes('Unauthorized') ? 401 : 403 }
      );
    }

    await RulesService.toggleRuleStatus(id, false, authCheck.context.user!.id);

    return NextResponse.json({
      success: true,
      message: 'Rule deactivated successfully',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid rule ID' },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.error('Delete rule error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

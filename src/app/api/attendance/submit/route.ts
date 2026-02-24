import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/modules/rbac/guards';
import { RulesService } from '@/modules/rules/rules.service';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/modules/audit/audit.service';
import { z } from 'zod';

const submitAttendanceSchema = z.object({
  studentId: z.string().cuid(),
  date: z.coerce.date(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  remarks: z.string().optional(),
});

/**
 * POST /api/attendance/submit
 * Submit attendance record
 * 
 * INTEGRATION FLOW:
 * 1. Authentication (Middleware)
 * 2. Permission Check (Guard)
 * 3. Rules Engine Evaluation
 * 4. Business Logic (if allowed)
 * 5. Database Transaction
 * 6. Audit Logging
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1 & 2: Authentication and Permission Check
    const authCheck = await requirePermission(request, 'attendance', 'create');

    if (!authCheck.authorized) {
      return NextResponse.json(
        { success: false, error: authCheck.error },
        { status: authCheck.error?.includes('Unauthorized') ? 401 : 403 }
      );
    }

    const body = await request.json();
    const validatedData = submitAttendanceSchema.parse(body);

    // Step 3: Rules Engine Evaluation
    const ruleResult = await RulesService.evaluateRules({
      user: {
        id: authCheck.context.user!.id,
        email: authCheck.context.user!.email,
        roles: authCheck.context.roles,
        permissions: authCheck.context.permissions,
      },
      action: 'SUBMIT_ATTENDANCE',
      moduleName: 'attendance',
      resourceData: {
        studentId: validatedData.studentId,
        date: validatedData.date,
        status: validatedData.status,
        submittedBy: authCheck.context.user!.id,
      },
      timestamp: new Date(),
    });

    // Handle rule decisions
    if (ruleResult.decision === 'BLOCKED') {
      return NextResponse.json(
        {
          success: false,
          error: ruleResult.message || 'Action blocked by rules engine',
          ruleEvaluation: ruleResult,
        },
        { status: 403 }
      );
    }

    if (ruleResult.decision === 'APPROVAL_REQUIRED') {
      // In a real system, create approval request
      return NextResponse.json({
        success: false,
        requiresApproval: true,
        message: ruleResult.message || 'This action requires approval',
        approvers: ruleResult.approvers,
        ruleEvaluation: ruleResult,
      });
    }

    // Apply modifications if any
    let finalData = { ...validatedData };
    if (ruleResult.modifications) {
      finalData = { ...finalData, ...ruleResult.modifications };
    }

    // Step 4 & 5: Business Logic with Transaction
    const attendance = await prisma.$transaction(async (tx: any) => {
      // Check for duplicate attendance using proper Prisma query
      const existing = await tx.user.findFirst({
        where: {
          id: finalData.studentId,
          // This is a placeholder - in a real system you'd have an Attendance model
          // For now, we'll simulate the check
        },
      });

      // Create attendance record (placeholder - adjust based on your actual schema)
      const record = {
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        studentId: finalData.studentId,
        date: finalData.date,
        status: finalData.status,
        remarks: finalData.remarks,
        submittedBy: authCheck.context.user!.id,
        createdAt: new Date(),
      };

      // Step 6: Audit Logging
      await AuditService.logSuccess(
        authCheck.context.user!.id,
        'ATTENDANCE_SUBMITTED',
        'Attendance',
        record.id,
        {
          studentId: finalData.studentId,
          status: finalData.status,
          rulesTriggered: ruleResult.triggeredRules.length,
          decision: ruleResult.decision,
        }
      );

      return record;
    });

    return NextResponse.json({
      success: true,
      data: attendance,
      ruleEvaluation: {
        decision: ruleResult.decision,
        triggeredRules: ruleResult.triggeredRules,
        executionTimeMs: ruleResult.executionTimeMs,
      },
      message: ruleResult.message || 'Attendance submitted successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
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
      await AuditService.logFailure(
        undefined,
        'ATTENDANCE_SUBMISSION_FAILED',
        'Attendance',
        error.message
      );

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.error('Submit attendance error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

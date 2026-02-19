import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/rbac/guards';
import { RulesService } from '@/services/rules.service';
import { buildAuthUser } from '@/lib/rbac/permissions';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/services/audit.service';
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

    // Build auth user with roles and permissions
    const authUser = await buildAuthUser(authCheck.userId!);

    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Step 3: Rules Engine Evaluation
    const ruleResult = await RulesService.evaluateRules({
      user: {
        id: authUser.id,
        email: authUser.email,
        roles: authUser.roles,
        permissions: authUser.permissions,
      },
      action: 'SUBMIT_ATTENDANCE',
      moduleName: 'attendance',
      resourceData: {
        studentId: validatedData.studentId,
        date: validatedData.date,
        status: validatedData.status,
        submittedBy: authCheck.userId,
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
      // Check for duplicate attendance
      const existing = await tx.attendance?.findFirst({
        where: {
          studentId: finalData.studentId,
          date: finalData.date,
        },
      });

      if (existing) {
        throw new Error('Attendance already recorded for this date');
      }

      // Create attendance record (assuming attendance table exists)
      // This is a placeholder - adjust based on your actual schema
      const record = {
        id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        studentId: finalData.studentId,
        date: finalData.date,
        status: finalData.status,
        remarks: finalData.remarks,
        submittedBy: authCheck.userId,
        createdAt: new Date(),
      };

      // Step 6: Audit Logging
      await AuditService.logSuccess(
        authCheck.userId!,
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

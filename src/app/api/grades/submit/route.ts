import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/rbac/guards';
import { RulesService } from '@/services/rules.service';
import { buildAuthUser } from '@/lib/rbac/permissions';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/services/audit.service';
import { z } from 'zod';

const submitGradeSchema = z.object({
  studentId: z.string().cuid(),
  courseId: z.string().cuid(),
  examType: z.enum(['MIDTERM', 'FINAL', 'QUIZ', 'ASSIGNMENT']),
  score: z.number().min(0).max(100),
  maxScore: z.number().min(0).max(100),
  remarks: z.string().optional(),
});

/**
 * POST /api/grades/submit
 * Submit grade record
 * 
 * INTEGRATION FLOW WITH RULES ENGINE:
 * 1. Authentication & Authorization
 * 2. Rules Engine Evaluation
 * 3. Transaction-safe Business Logic
 * 4. Audit Logging
 * 
 * EXAMPLE RULES THAT MIGHT APPLY:
 * - Block grade submission after deadline
 * - Require approval for grade changes
 * - Warn if grade is significantly different from average
 * - Modify grade if it exceeds maximum allowed
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication & Authorization
    const authCheck = await requirePermission(request, 'grade', 'create');

    if (!authCheck.authorized) {
      return NextResponse.json(
        { success: false, error: authCheck.error },
        { status: authCheck.error?.includes('Unauthorized') ? 401 : 403 }
      );
    }

    const body = await request.json();
    const validatedData = submitGradeSchema.parse(body);

    // Build auth user
    const authUser = await buildAuthUser(authCheck.userId!);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Calculate percentage
    const percentage = (validatedData.score / validatedData.maxScore) * 100;

    // Rules Engine Evaluation
    const ruleResult = await RulesService.evaluateRules({
      user: {
        id: authUser.id,
        email: authUser.email,
        roles: authUser.roles,
        permissions: authUser.permissions,
      },
      action: 'SUBMIT_GRADE',
      moduleName: 'grades',
      resourceData: {
        studentId: validatedData.studentId,
        courseId: validatedData.courseId,
        examType: validatedData.examType,
        score: validatedData.score,
        maxScore: validatedData.maxScore,
        percentage,
        submittedBy: authCheck.userId,
        submittedAt: new Date(),
      },
      timestamp: new Date(),
    });

    // Handle BLOCKED decision
    if (ruleResult.decision === 'BLOCKED') {
      await AuditService.logFailure(
        authCheck.userId!,
        'GRADE_SUBMISSION_BLOCKED',
        'Grade',
        ruleResult.message || 'Blocked by rules engine',
        undefined,
        { triggeredRules: ruleResult.triggeredRules }
      );

      return NextResponse.json(
        {
          success: false,
          error: ruleResult.message || 'Grade submission blocked by rules',
          ruleEvaluation: {
            decision: ruleResult.decision,
            triggeredRules: ruleResult.triggeredRules,
          },
        },
        { status: 403 }
      );
    }

    // Handle APPROVAL_REQUIRED decision
    if (ruleResult.decision === 'APPROVAL_REQUIRED') {
      // Create pending approval record
      const pendingApproval = {
        id: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'GRADE_SUBMISSION',
        requestedBy: authCheck.userId,
        data: validatedData,
        approvers: ruleResult.approvers,
        status: 'PENDING',
        createdAt: new Date(),
      };

      await AuditService.logSuccess(
        authCheck.userId!,
        'GRADE_APPROVAL_REQUESTED',
        'Grade',
        pendingApproval.id,
        {
          studentId: validatedData.studentId,
          courseId: validatedData.courseId,
          approvers: ruleResult.approvers,
        }
      );

      return NextResponse.json({
        success: false,
        requiresApproval: true,
        message: ruleResult.message || 'Grade submission requires approval',
        approvalRequest: pendingApproval,
        ruleEvaluation: {
          decision: ruleResult.decision,
          triggeredRules: ruleResult.triggeredRules,
        },
      });
    }

    // Apply modifications from rules
    let finalData = { ...validatedData };
    if (ruleResult.modifications) {
      finalData = { ...finalData, ...ruleResult.modifications };
    }

    // Transaction-safe grade submission
    const grade = await prisma.$transaction(async (tx: any) => {
      // Check for existing grade
      const existing = await tx.grade?.findFirst({
        where: {
          studentId: finalData.studentId,
          courseId: finalData.courseId,
          examType: finalData.examType,
        },
      });

      if (existing) {
        throw new Error('Grade already exists for this exam');
      }

      // Create grade record (placeholder - adjust to your schema)
      const record = {
        id: `grade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        studentId: finalData.studentId,
        courseId: finalData.courseId,
        examType: finalData.examType,
        score: finalData.score,
        maxScore: finalData.maxScore,
        percentage,
        remarks: finalData.remarks,
        submittedBy: authCheck.userId,
        createdAt: new Date(),
      };

      // Audit logging
      await AuditService.logSuccess(
        authCheck.userId!,
        'GRADE_SUBMITTED',
        'Grade',
        record.id,
        {
          studentId: finalData.studentId,
          courseId: finalData.courseId,
          score: finalData.score,
          percentage,
          rulesTriggered: ruleResult.triggeredRules.length,
          decision: ruleResult.decision,
          wasModified: !!ruleResult.modifications,
        }
      );

      return record;
    });

    return NextResponse.json({
      success: true,
      data: grade,
      ruleEvaluation: {
        decision: ruleResult.decision,
        triggeredRules: ruleResult.triggeredRules,
        executionTimeMs: ruleResult.executionTimeMs,
        wasModified: !!ruleResult.modifications,
      },
      message: ruleResult.message || 'Grade submitted successfully',
      warning: ruleResult.decision === 'WARNING' ? ruleResult.message : undefined,
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
        'GRADE_SUBMISSION_FAILED',
        'Grade',
        error.message
      );

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    console.error('Submit grade error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

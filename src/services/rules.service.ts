import { prisma } from '@/lib/db/prisma';
import {
  RuleEvaluationContext,
  RuleEvaluationResult,
  RuleCondition,
  RuleAction,
  CreateRuleDTO,
  UpdateRuleDTO,
} from '@/types';
import { AuditService } from './audit.service';

/**
 * Rules Engine Service - Centralized rule evaluation and management
 * This service governs all business logic across modules
 */
export class RulesService {
  /**
   * Evaluate rules for a given context
   * This is the core function that all modules must call
   */
  static async evaluateRules(
    context: RuleEvaluationContext
  ): Promise<RuleEvaluationResult> {
    const startTime = Date.now();

    try {
      // Fetch active rules for the module, sorted by priority
      const rules = await prisma.rule.findMany({
        where: {
          moduleName: context.moduleName,
          isActive: true,
          effectiveFrom: {
            lte: context.timestamp || new Date(),
          },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: context.timestamp || new Date() } },
          ],
        },
        orderBy: {
          priority: 'asc', // Lower number = higher priority
        },
      });

      // Check for rule exceptions
      const hasException = await this.checkRuleException(context.user.id, rules.map(r => r.id));
      if (hasException) {
        return this.createResult('ALLOWED', [], startTime, 'User has rule exception');
      }

      const triggeredRules: Array<{
        ruleId: string;
        ruleName: string;
        severity: string;
        action: string;
      }> = [];

      let finalDecision: RuleEvaluationResult['decision'] = 'ALLOWED';
      let finalMessage = '';
      let modifications: Record<string, any> = {};
      let requiresApproval = false;
      let approvers: string[] = [];

      // Evaluate each rule in priority order
      for (const rule of rules) {
        const conditionMet = await this.evaluateCondition(
          rule.conditionPayload as any,
          context
        );

        // Log rule evaluation
        await this.logRuleEvaluation(
          rule.id,
          context,
          conditionMet,
          rule.actionType,
          finalDecision,
          Date.now() - startTime
        );

        if (conditionMet) {
          triggeredRules.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severityLevel,
            action: rule.actionType,
          });

          const actionPayload = rule.actionPayload as any as RuleAction;

          // Process action based on type
          switch (rule.actionType) {
            case 'BLOCK':
              // Blocking rule stops all further processing
              finalDecision = 'BLOCKED';
              finalMessage = actionPayload?.message || `Action blocked by rule: ${rule.name}`;
              
              // Log blocking action
              await AuditService.logFailure(
                context.user.id,
                `RULE_BLOCKED_${context.action}`,
                context.moduleName,
                finalMessage,
                undefined,
                { ruleId: rule.id, ruleName: rule.name }
              );

              return this.createResult(
                finalDecision,
                triggeredRules,
                startTime,
                finalMessage
              );

            case 'MODIFY':
              if (finalDecision === 'ALLOWED') {
                finalDecision = 'MODIFIED';
              }
              if (actionPayload?.modifications) {
                modifications = { ...modifications, ...actionPayload.modifications };
              }
              finalMessage = actionPayload?.message || `Action modified by rule: ${rule.name}`;
              break;

            case 'WARN':
              if (finalDecision === 'ALLOWED') {
                finalDecision = 'WARNING';
              }
              finalMessage = actionPayload?.message || `Warning from rule: ${rule.name}`;
              break;

            case 'REQUIRE_APPROVAL':
              finalDecision = 'APPROVAL_REQUIRED';
              requiresApproval = true;
              if (actionPayload?.approvers) {
                approvers = [...approvers, ...actionPayload.approvers];
              }
              finalMessage = actionPayload?.message || `Approval required by rule: ${rule.name}`;
              break;

            case 'ALLOW':
              // Explicit allow - continue evaluation
              break;
          }
        }
      }

      const result = this.createResult(
        finalDecision,
        triggeredRules,
        startTime,
        finalMessage,
        modifications,
        requiresApproval,
        approvers
      );

      // Log successful evaluation
      await AuditService.logSuccess(
        context.user.id,
        `RULE_EVALUATION_${context.action}`,
        context.moduleName,
        undefined,
        {
          decision: finalDecision,
          triggeredRules: triggeredRules.length,
          executionTimeMs: result.executionTimeMs,
        }
      );

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Log error
      await AuditService.logFailure(
        context.user.id,
        `RULE_EVALUATION_ERROR_${context.action}`,
        context.moduleName,
        error instanceof Error ? error.message : 'Unknown error'
      );

      return {
        decision: 'ERROR',
        message: 'Rule evaluation failed',
        triggeredRules: [],
        executionTimeMs: executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Evaluate a single condition
   */
  private static async evaluateCondition(
    condition: RuleCondition,
    context: RuleEvaluationContext
  ): Promise<boolean> {
    try {
      switch (condition.type) {
        case 'expression':
          return this.evaluateExpression(condition, context);

        case 'threshold':
          return this.evaluateThreshold(condition, context);

        case 'time_based':
          return this.evaluateTimeBased(condition, context);

        case 'role_based':
          return this.evaluateRoleBased(condition, context);

        case 'permission_based':
          return this.evaluatePermissionBased(condition, context);

        case 'composite':
          return this.evaluateComposite(condition, context);

        default:
          return false;
      }
    } catch (error) {
      console.error('Condition evaluation error:', error);
      return false;
    }
  }

  /**
   * Evaluate expression-based condition
   */
  private static evaluateExpression(
    condition: RuleCondition,
    context: RuleEvaluationContext
  ): boolean {
    if (!condition.expression) return false;

    try {
      // Create safe evaluation context
      const evalContext = {
        user: context.user,
        data: context.resourceData || {},
        action: context.action,
        timestamp: context.timestamp || new Date(),
      };

      // Simple expression evaluation (in production, use a proper expression parser)
      // For now, we'll use a simplified approach
      const expression = condition.expression;
      
      // Example: "data.attendance_percentage >= 75"
      // This is a simplified implementation - use a proper expression parser in production
      return this.safeEvaluate(expression, evalContext);
    } catch (error) {
      console.error('Expression evaluation error:', error);
      return false;
    }
  }

  /**
   * Safe expression evaluation
   */
  private static safeEvaluate(expression: string, context: any): boolean {
    try {
      // Replace context variables
      let processedExpression = expression;
      
      // Handle data.field references
      const dataMatches = expression.match(/data\.(\w+)/g);
      if (dataMatches) {
        dataMatches.forEach(match => {
          const field = match.split('.')[1];
          const value = context.data[field];
          processedExpression = processedExpression.replace(
            match,
            typeof value === 'string' ? `"${value}"` : String(value)
          );
        });
      }

      // Handle user.field references
      const userMatches = expression.match(/user\.(\w+)/g);
      if (userMatches) {
        userMatches.forEach(match => {
          const field = match.split('.')[1];
          const value = context.user[field];
          processedExpression = processedExpression.replace(
            match,
            typeof value === 'string' ? `"${value}"` : String(value)
          );
        });
      }

      // Use Function constructor for safe evaluation (limited scope)
      const func = new Function(`return ${processedExpression}`);
      return Boolean(func());
    } catch (error) {
      console.error('Safe evaluation error:', error);
      return false;
    }
  }

  /**
   * Evaluate threshold-based condition
   */
  private static evaluateThreshold(
    condition: RuleCondition,
    context: RuleEvaluationContext
  ): boolean {
    if (!condition.field || !condition.operator || condition.value === undefined) {
      return false;
    }

    const fieldValue = context.resourceData?.[condition.field];
    if (fieldValue === undefined) return false;

    switch (condition.operator) {
      case 'eq':
        return fieldValue === condition.value;
      case 'ne':
        return fieldValue !== condition.value;
      case 'gt':
        return fieldValue > condition.value;
      case 'gte':
        return fieldValue >= condition.value;
      case 'lt':
        return fieldValue < condition.value;
      case 'lte':
        return fieldValue <= condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'nin':
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'between':
        if (Array.isArray(condition.value) && condition.value.length === 2) {
          return fieldValue >= condition.value[0] && fieldValue <= condition.value[1];
        }
        return false;
      default:
        return false;
    }
  }

  /**
   * Evaluate time-based condition
   */
  private static evaluateTimeBased(
    condition: RuleCondition,
    context: RuleEvaluationContext
  ): boolean {
    const now = context.timestamp || new Date();

    if (condition.timeRange) {
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const [startHour, startMin] = condition.timeRange.start.split(':').map(Number);
      const [endHour, endMin] = condition.timeRange.end.split(':').map(Number);
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      return currentTime >= startTime && currentTime <= endTime;
    }

    if (condition.dateRange) {
      const start = new Date(condition.dateRange.start);
      const end = new Date(condition.dateRange.end);
      return now >= start && now <= end;
    }

    return false;
  }

  /**
   * Evaluate role-based condition
   */
  private static evaluateRoleBased(
    condition: RuleCondition,
    context: RuleEvaluationContext
  ): boolean {
    if (!condition.roles || condition.roles.length === 0) return false;

    return condition.roles.some(role => context.user.roles.includes(role));
  }

  /**
   * Evaluate permission-based condition
   */
  private static evaluatePermissionBased(
    condition: RuleCondition,
    context: RuleEvaluationContext
  ): boolean {
    if (!condition.permissions || condition.permissions.length === 0) return false;

    return condition.permissions.some(permission =>
      context.user.permissions.includes(permission)
    );
  }

  /**
   * Evaluate composite condition (multiple conditions with AND/OR logic)
   */
  private static async evaluateComposite(
    condition: RuleCondition,
    context: RuleEvaluationContext
  ): Promise<boolean> {
    if (!condition.conditions || condition.conditions.length === 0) return false;

    const results = await Promise.all(
      condition.conditions.map(c => this.evaluateCondition(c, context))
    );

    if (condition.logic === 'OR') {
      return results.some(r => r);
    } else {
      // Default to AND
      return results.every(r => r);
    }
  }

  /**
   * Check if user has exception for any of the rules
   */
  private static async checkRuleException(
    userId: string,
    ruleIds: string[]
  ): Promise<boolean> {
    const exception = await prisma.ruleException.findFirst({
      where: {
        userId,
        ruleId: { in: ruleIds },
        isActive: true,
        effectiveFrom: { lte: new Date() },
        effectiveTo: { gte: new Date() },
      },
    });

    return !!exception;
  }

  /**
   * Log rule evaluation
   */
  private static async logRuleEvaluation(
    ruleId: string,
    context: RuleEvaluationContext,
    conditionMet: boolean,
    actionTaken: string,
    decision: string,
    executionTimeMs: number
  ): Promise<void> {
    try {
      await prisma.ruleLog.create({
        data: {
          ruleId,
          userId: context.user.id,
          moduleName: context.moduleName,
          action: context.action,
          resourceData: context.resourceData || {},
          conditionMet,
          actionTaken: actionTaken as any,
          decision: decision as any,
          executionTimeMs,
        },
      });
    } catch (error) {
      console.error('Failed to log rule evaluation:', error);
    }
  }

  /**
   * Create evaluation result
   */
  private static createResult(
    decision: RuleEvaluationResult['decision'],
    triggeredRules: RuleEvaluationResult['triggeredRules'],
    startTime: number,
    message?: string,
    modifications?: Record<string, any>,
    requiresApproval?: boolean,
    approvers?: string[]
  ): RuleEvaluationResult {
    return {
      decision,
      message,
      triggeredRules,
      modifications,
      requiresApproval,
      approvers,
      executionTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Create a new rule
   */
  static async createRule(data: CreateRuleDTO, createdBy: string): Promise<any> {
    const rule = await prisma.rule.create({
      data: {
        name: data.name,
        moduleName: data.moduleName,
        description: data.description,
        category: data.category,
        conditionType: data.conditionType,
        conditionPayload: data.conditionPayload as any,
        actionType: data.actionType,
        actionPayload: data.actionPayload as any,
        severityLevel: data.severityLevel || 'MEDIUM',
        priority: data.priority || 100,
        isActive: data.isActive !== undefined ? data.isActive : true,
        effectiveFrom: data.effectiveFrom || new Date(),
        effectiveTo: data.effectiveTo,
        createdBy,
      },
    });

    await AuditService.logSuccess(
      createdBy,
      'RULE_CREATED',
      'Rule',
      rule.id,
      { name: data.name, moduleName: data.moduleName }
    );

    return rule;
  }

  /**
   * Update a rule (creates new version)
   */
  static async updateRule(
    ruleId: string,
    data: UpdateRuleDTO,
    updatedBy: string
  ): Promise<any> {
    const existingRule = await prisma.rule.findUnique({
      where: { id: ruleId },
    });

    if (!existingRule) {
      throw new Error('Rule not found');
    }

    // Create new version
    const newVersion = await prisma.rule.create({
      data: {
        name: data.name || existingRule.name,
        moduleName: existingRule.moduleName,
        description: data.description || existingRule.description,
        category: existingRule.category,
        conditionType: existingRule.conditionType,
        conditionPayload: (data.conditionPayload as any) || existingRule.conditionPayload,
        actionType: existingRule.actionType,
        actionPayload: (data.actionPayload as any) || existingRule.actionPayload,
        severityLevel: data.severityLevel || existingRule.severityLevel,
        priority: data.priority !== undefined ? data.priority : existingRule.priority,
        isActive: data.isActive !== undefined ? data.isActive : existingRule.isActive,
        effectiveFrom: data.effectiveFrom || existingRule.effectiveFrom,
        effectiveTo: data.effectiveTo,
        version: existingRule.version + 1,
        parentRuleId: ruleId,
        createdBy: updatedBy,
      },
    });

    // Deactivate old version
    await prisma.rule.update({
      where: { id: ruleId },
      data: { isActive: false },
    });

    await AuditService.logSuccess(
      updatedBy,
      'RULE_UPDATED',
      'Rule',
      newVersion.id,
      { oldVersion: existingRule.version, newVersion: newVersion.version }
    );

    return newVersion;
  }

  /**
   * Get rules by module
   */
  static async getRulesByModule(moduleName: string): Promise<any[]> {
    return prisma.rule.findMany({
      where: {
        moduleName,
        isActive: true,
      },
      orderBy: {
        priority: 'asc',
      },
    });
  }

  /**
   * Get rule metrics
   */
  static async getRuleMetrics(startDate?: Date, endDate?: Date): Promise<any> {
    const where: any = {};
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const logs = await prisma.ruleLog.findMany({ where });

    const metrics = {
      totalEvaluations: logs.length,
      allowedCount: logs.filter(l => l.decision === 'ALLOWED').length,
      blockedCount: logs.filter(l => l.decision === 'BLOCKED').length,
      modifiedCount: logs.filter(l => l.decision === 'MODIFIED').length,
      warningCount: logs.filter(l => l.decision === 'WARNING').length,
      approvalRequiredCount: logs.filter(l => l.decision === 'APPROVAL_REQUIRED').length,
      errorCount: logs.filter(l => l.decision === 'ERROR').length,
      averageExecutionTimeMs: logs.reduce((sum, l) => sum + l.executionTimeMs, 0) / logs.length || 0,
    };

    return metrics;
  }

  /**
   * Activate/Deactivate rule
   */
  static async toggleRuleStatus(
    ruleId: string,
    isActive: boolean,
    updatedBy: string
  ): Promise<void> {
    await prisma.rule.update({
      where: { id: ruleId },
      data: { isActive },
    });

    await AuditService.logSuccess(
      updatedBy,
      isActive ? 'RULE_ACTIVATED' : 'RULE_DEACTIVATED',
      'Rule',
      ruleId
    );
  }
}

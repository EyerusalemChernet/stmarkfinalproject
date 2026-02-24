import { prisma } from '@/lib/db/prisma';
import {
  RuleEvaluationContext,
  RuleEvaluationResult,
  RuleCondition,
  RuleAction,
  CreateRuleDTO,
  UpdateRuleDTO,
} from '@/types';
import { AuditService } from '@/modules/audit/audit.service';

/**
 * In-memory cache for active rules by module
 */
const rulesCache = new Map<string, { rules: any[]; lastUpdated: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Rules Engine Service - Centralized rule evaluation and management
 * This service governs all business logic across modules
 * Enhanced with caching, deterministic evaluation, and improved error handling
 */
export class RulesService {
  /**
   * Get cached rules for a module or fetch from database
   */
  private static async getCachedRules(moduleName: string): Promise<any[]> {
    const cached = rulesCache.get(moduleName);
    const now = Date.now();

    // Return cached rules if they're still valid
    if (cached && (now - cached.lastUpdated) < CACHE_TTL) {
      return cached.rules;
    }

    // Fetch fresh rules from database
    const rules = await prisma.rule.findMany({
      where: {
        moduleName,
        isActive: true,
        effectiveFrom: {
          lte: new Date(),
        },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: new Date() } },
        ],
      },
      orderBy: [
        { priority: 'asc' }, // Lower number = higher priority
        { createdAt: 'asc' }, // Deterministic ordering for same priority
      ],
    });

    // Update cache
    rulesCache.set(moduleName, {
      rules,
      lastUpdated: now,
    });

    return rules;
  }

  /**
   * Clear cache for a specific module or all modules
   */
  static clearCache(moduleName?: string): void {
    if (moduleName) {
      rulesCache.delete(moduleName);
    } else {
      rulesCache.clear();
    }
  }

  /**
   * Evaluate rules for a given context with enhanced error handling and caching
   */
  static async evaluateRules(
    context: RuleEvaluationContext
  ): Promise<RuleEvaluationResult> {
    const startTime = Date.now();

    try {
      // Validate input context
      if (!context.user?.id || !context.moduleName || !context.action) {
        throw new Error('Invalid evaluation context: missing required fields');
      }

      // Fetch cached active rules for the module
      const rules = await this.getCachedRules(context.moduleName);

      if (rules.length === 0) {
        return this.createResult('ALLOWED', [], startTime, 'No active rules found');
      }

      // Check for rule exceptions
      const hasException = await this.checkRuleException(context.user.id, rules.map((r: any) => r.id));
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

      // Evaluate each rule in deterministic priority order
      for (const rule of rules) {
        try {
          // Check if rule is still effective (additional safety check)
          const now = context.timestamp || new Date();
          if (rule.effectiveFrom > now || (rule.effectiveTo && rule.effectiveTo < now)) {
            continue;
          }

          const conditionMet = await this.evaluateCondition(
            rule.conditionPayload as any,
            context
          );

          // Log rule evaluation (non-blocking)
          this.logRuleEvaluation(
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

            // Process action based on type with deterministic conflict resolution
            switch (rule.actionType) {
              case 'BLOCK':
                // Blocking rule stops all further processing (highest priority action)
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

              case 'REQUIRE_APPROVAL':
                // Approval required takes precedence over modifications and warnings
                if (finalDecision !== 'BLOCKED') {
                  finalDecision = 'APPROVAL_REQUIRED';
                  requiresApproval = true;
                  if (actionPayload?.approvers) {
                    approvers = [...new Set([...approvers, ...actionPayload.approvers])];
                  }
                  finalMessage = actionPayload?.message || `Approval required by rule: ${rule.name}`;
                }
                break;

              case 'MODIFY':
                // Modifications are cumulative and take precedence over warnings
                if (finalDecision !== 'BLOCKED' && finalDecision !== 'APPROVAL_REQUIRED') {
                  finalDecision = 'MODIFIED';
                }
                if (actionPayload?.modifications) {
                  modifications = { ...modifications, ...actionPayload.modifications };
                }
                if (!finalMessage) {
                  finalMessage = actionPayload?.message || `Action modified by rule: ${rule.name}`;
                }
                break;

              case 'WARN':
                // Warnings are lowest priority
                if (finalDecision === 'ALLOWED') {
                  finalDecision = 'WARNING';
                  finalMessage = actionPayload?.message || `Warning from rule: ${rule.name}`;
                }
                break;

              case 'ALLOW':
                // Explicit allow - continue evaluation but don't change decision
                break;

              default:
                console.warn(`Unknown action type: ${rule.actionType} for rule ${rule.id}`);
                break;
            }
          }
        } catch (ruleError) {
          console.error(`Error evaluating rule ${rule.id}:`, ruleError);
          // Continue with other rules instead of failing completely
          await AuditService.logFailure(
            context.user.id,
            `RULE_EVALUATION_ERROR`,
            context.moduleName,
            `Error in rule ${rule.name}: ${ruleError instanceof Error ? ruleError.message : 'Unknown error'}`,
            rule.id
          );
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
        context.user?.id,
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
   * Evaluate a single condition with improved error handling
   */
  private static async evaluateCondition(
    condition: RuleCondition,
    context: RuleEvaluationContext
  ): Promise<boolean> {
    try {
      if (!condition || !condition.type) {
        console.warn('Invalid condition: missing type');
        return false;
      }

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
          console.warn(`Unknown condition type: ${condition.type}`);
          return false;
      }
    } catch (error) {
      console.error('Condition evaluation error:', error);
      return false;
    }
  }

  /**
   * Evaluate expression-based condition with improved safety
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

      // Use improved safe evaluation
      return this.safeEvaluate(condition.expression, evalContext);
    } catch (error) {
      console.error('Expression evaluation error:', error);
      return false;
    }
  }

  /**
   * Enhanced safe expression evaluation with better error handling
   */
  private static safeEvaluate(expression: string, context: any): boolean {
    try {
      // Sanitize expression to prevent code injection
      const sanitizedExpression = expression
        .replace(/[^a-zA-Z0-9\s\.\(\)\[\]<>=!&|+\-*/%"'_]/g, '')
        .trim();

      if (!sanitizedExpression) {
        return false;
      }

      // Replace context variables with safe approach
      let processedExpression = sanitizedExpression;
      
      // Handle data.field references
      const dataMatches = sanitizedExpression.match(/data\.(\w+)/g);
      if (dataMatches) {
        dataMatches.forEach(match => {
          const field = match.split('.')[1];
          const value = context.data?.[field];
          if (value !== undefined) {
            const safeValue = typeof value === 'string' ? `"${value.replace(/"/g, '\\"')}"` : String(value);
            processedExpression = processedExpression.replace(match, safeValue);
          } else {
            processedExpression = processedExpression.replace(match, 'null');
          }
        });
      }

      // Handle user.field references
      const userMatches = sanitizedExpression.match(/user\.(\w+)/g);
      if (userMatches) {
        userMatches.forEach(match => {
          const field = match.split('.')[1];
          const value = context.user?.[field];
          if (value !== undefined) {
            const safeValue = typeof value === 'string' ? `"${value.replace(/"/g, '\\"')}"` : String(value);
            processedExpression = processedExpression.replace(match, safeValue);
          } else {
            processedExpression = processedExpression.replace(match, 'null');
          }
        });
      }

      // Use Function constructor for safe evaluation (limited scope)
      const func = new Function(`"use strict"; return (${processedExpression})`);
      const result = func();
      return Boolean(result);
    } catch (error) {
      console.error('Safe evaluation error:', error);
      return false;
    }
  }

  /**
   * Evaluate threshold-based condition with enhanced validation
   */
  private static evaluateThreshold(
    condition: RuleCondition,
    context: RuleEvaluationContext
  ): boolean {
    if (!condition.field || !condition.operator || condition.value === undefined) {
      return false;
    }

    const fieldValue = context.resourceData?.[condition.field];
    if (fieldValue === undefined || fieldValue === null) return false;

    try {
      switch (condition.operator) {
        case 'eq':
          return fieldValue === condition.value;
        case 'ne':
          return fieldValue !== condition.value;
        case 'gt':
          return Number(fieldValue) > Number(condition.value);
        case 'gte':
          return Number(fieldValue) >= Number(condition.value);
        case 'lt':
          return Number(fieldValue) < Number(condition.value);
        case 'lte':
          return Number(fieldValue) <= Number(condition.value);
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(fieldValue);
        case 'nin':
          return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
        case 'contains':
          return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
        case 'between':
          if (Array.isArray(condition.value) && condition.value.length === 2) {
            const numValue = Number(fieldValue);
            return numValue >= Number(condition.value[0]) && numValue <= Number(condition.value[1]);
          }
          return false;
        default:
          return false;
      }
    } catch (error) {
      console.error('Threshold evaluation error:', error);
      return false;
    }
  }

  /**
   * Evaluate time-based condition with improved date handling
   */
  private static evaluateTimeBased(
    condition: RuleCondition,
    context: RuleEvaluationContext
  ): boolean {
    const now = context.timestamp || new Date();

    try {
      if (condition.timeRange) {
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const [startHour, startMin] = condition.timeRange.start.split(':').map(Number);
        const [endHour, endMin] = condition.timeRange.end.split(':').map(Number);
        
        if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
          return false;
        }
        
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        return currentTime >= startTime && currentTime <= endTime;
      }

      if (condition.dateRange) {
        const start = new Date(condition.dateRange.start);
        const end = new Date(condition.dateRange.end);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return false;
        }
        
        return now >= start && now <= end;
      }

      return false;
    } catch (error) {
      console.error('Time-based evaluation error:', error);
      return false;
    }
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
   * Evaluate composite condition with improved error handling
   */
  private static async evaluateComposite(
    condition: RuleCondition,
    context: RuleEvaluationContext
  ): Promise<boolean> {
    if (!condition.conditions || condition.conditions.length === 0) return false;

    try {
      const results = await Promise.all(
        condition.conditions.map(c => this.evaluateCondition(c, context))
      );

      if (condition.logic === 'OR') {
        return results.some(r => r);
      } else {
        // Default to AND
        return results.every(r => r);
      }
    } catch (error) {
      console.error('Composite condition evaluation error:', error);
      return false;
    }
  }

  /**
   * Check if user has exception for any of the rules
   */
  private static async checkRuleException(
    userId: string,
    ruleIds: string[]
  ): Promise<boolean> {
    if (ruleIds.length === 0) return false;

    try {
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
    } catch (error) {
      console.error('Rule exception check error:', error);
      return false;
    }
  }

  /**
   * Log rule evaluation (non-blocking)
   */
  private static async logRuleEvaluation(
    ruleId: string,
    context: RuleEvaluationContext,
    conditionMet: boolean,
    actionTaken: string,
    decision: string,
    executionTimeMs: number
  ): Promise<void> {
    setImmediate(async () => {
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
    });
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
   * Create a new rule with cache invalidation
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

    // Clear cache for the module
    this.clearCache(data.moduleName);

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
   * Update a rule (creates new version) with cache invalidation
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

    // Clear cache for the module
    this.clearCache(existingRule.moduleName);

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
   * Get rule metrics with enhanced analytics
   */
  static async getRuleMetrics(startDate?: Date, endDate?: Date): Promise<any> {
    const where: any = {};
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [logs, rules] = await Promise.all([
      prisma.ruleLog.findMany({ where }),
      prisma.rule.findMany({
        where: { isActive: true },
        select: { moduleName: true, severityLevel: true },
      }),
    ]);

    const metrics = {
      totalEvaluations: logs.length,
      allowedCount: logs.filter((l: any) => l.decision === 'ALLOWED').length,
      blockedCount: logs.filter((l: any) => l.decision === 'BLOCKED').length,
      modifiedCount: logs.filter((l: any) => l.decision === 'MODIFIED').length,
      warningCount: logs.filter((l: any) => l.decision === 'WARNING').length,
      approvalRequiredCount: logs.filter((l: any) => l.decision === 'APPROVAL_REQUIRED').length,
      errorCount: logs.filter((l: any) => l.decision === 'ERROR').length,
      averageExecutionTimeMs: logs.reduce((sum: any, l: any) => sum + l.executionTimeMs, 0) / logs.length || 0,
      rulesByModule: rules.reduce((acc: Record<string, number>, rule: any) => {
        acc[rule.moduleName] = (acc[rule.moduleName] || 0) + 1;
        return acc;
      }, {}),
      rulesBySeverity: rules.reduce((acc: Record<string, number>, rule: any) => {
        acc[rule.severityLevel] = (acc[rule.severityLevel] || 0) + 1;
        return acc;
      }, {}),
    };

    return metrics;
  }

  /**
   * Activate/Deactivate rule with cache invalidation
   */
  static async toggleRuleStatus(
    ruleId: string,
    isActive: boolean,
    updatedBy: string
  ): Promise<void> {
    const rule = await prisma.rule.findUnique({
      where: { id: ruleId },
      select: { moduleName: true },
    });

    if (!rule) {
      throw new Error('Rule not found');
    }

    await prisma.rule.update({
      where: { id: ruleId },
      data: { isActive },
    });

    // Clear cache for the module
    this.clearCache(rule.moduleName);

    await AuditService.logSuccess(
      updatedBy,
      isActive ? 'RULE_ACTIVATED' : 'RULE_DEACTIVATED',
      'Rule',
      ruleId
    );
  }

  /**
   * Bulk operations for rules with cache management
   */
  static async bulkUpdateRules(
    updates: Array<{ ruleId: string; isActive?: boolean; priority?: number }>,
    updatedBy: string
  ): Promise<void> {
    const affectedModules = new Set<string>();

    await prisma.$transaction(async (tx: any) => {
      for (const update of updates) {
        const rule = await tx.rule.findUnique({
          where: { id: update.ruleId },
          select: { moduleName: true },
        });

        if (rule) {
          affectedModules.add(rule.moduleName);
          
          await tx.rule.update({
            where: { id: update.ruleId },
            data: {
              isActive: update.isActive,
              priority: update.priority,
            },
          });
        }
      }
    });

    // Clear cache for all affected modules
    affectedModules.forEach(moduleName => this.clearCache(moduleName));

    await AuditService.logSuccess(
      updatedBy,
      'RULES_BULK_UPDATED',
      'Rule',
      undefined,
      { updatedCount: updates.length, affectedModules: Array.from(affectedModules) }
    );
  }
}

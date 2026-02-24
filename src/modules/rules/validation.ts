import { z } from 'zod';

/**
 * Rules Engine Schemas
 */
export const ruleConditionSchema = z.object({
  type: z.enum(['expression', 'threshold', 'time_based', 'role_based', 'permission_based', 'composite']),
  expression: z.string().optional(),
  field: z.string().optional(),
  operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'contains', 'between']).optional(),
  value: z.any().optional(),
  conditions: z.array(z.any()).optional(), // Recursive type
  logic: z.enum(['AND', 'OR']).optional(),
  timeRange: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }).optional(),
  dateRange: z.object({
    start: z.coerce.date(),
    end: z.coerce.date(),
  }).optional(),
  roles: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
});

export const ruleActionSchema = z.object({
  type: z.enum(['allow', 'block', 'modify', 'warn', 'require_approval']),
  message: z.string().optional(),
  modifications: z.record(z.any()).optional(),
  approvers: z.array(z.string()).optional(),
  notifyUsers: z.array(z.string()).optional(),
});

export const createRuleSchema = z.object({
  name: z.string().min(3, 'Rule name must be at least 3 characters').max(200),
  moduleName: z.string().min(2, 'Module name is required'),
  description: z.string().max(1000).optional(),
  category: z.enum(['ACADEMIC', 'FINANCE', 'HR', 'ATTENDANCE', 'DISCIPLINE', 'LIBRARY', 'TRANSPORT', 'HOSTEL', 'GENERAL']),
  conditionType: z.enum(['EXPRESSION', 'THRESHOLD', 'TIME_BASED', 'ROLE_BASED', 'PERMISSION_BASED', 'COMPOSITE']),
  conditionPayload: ruleConditionSchema,
  actionType: z.enum(['ALLOW', 'BLOCK', 'MODIFY', 'WARN', 'REQUIRE_APPROVAL']),
  actionPayload: ruleActionSchema.optional(),
  severityLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  priority: z.number().int().min(1).max(1000).default(100),
  isActive: z.boolean().default(true),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional(),
});

export const updateRuleSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  description: z.string().max(1000).optional(),
  conditionPayload: ruleConditionSchema.optional(),
  actionPayload: ruleActionSchema.optional(),
  severityLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  priority: z.number().int().min(1).max(1000).optional(),
  isActive: z.boolean().optional(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional(),
});

export const ruleEvaluationSchema = z.object({
  action: z.string().min(1),
  moduleName: z.string().min(1),
  resourceData: z.record(z.any()).optional(),
});

import { z } from 'zod';

/**
 * Authentication Schemas
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
});

/**
 * User Management Schemas
 */
export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  roleIds: z.array(z.string().cuid()).optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  firstName: z.string().min(1, 'First name is required').max(100).optional(),
  lastName: z.string().min(1, 'Last name is required').max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING']).optional(),
});

/**
 * Role Management Schemas
 */
export const createRoleSchema = z.object({
  name: z
    .string()
    .min(2, 'Role name must be at least 2 characters')
    .max(50, 'Role name must not exceed 50 characters')
    .regex(/^[A-Z_]+$/, 'Role name must be uppercase with underscores only'),
  description: z.string().max(500).optional(),
  permissionIds: z.array(z.string().cuid()).optional(),
});

export const updateRoleSchema = z.object({
  name: z
    .string()
    .min(2, 'Role name must be at least 2 characters')
    .max(50, 'Role name must not exceed 50 characters')
    .regex(/^[A-Z_]+$/, 'Role name must be uppercase with underscores only')
    .optional(),
  description: z.string().max(500).optional(),
});

export const assignRoleSchema = z.object({
  userId: z.string().cuid('Invalid user ID'),
  roleId: z.string().cuid('Invalid role ID'),
  expiresAt: z.string().datetime().optional(),
});

export const assignPermissionsSchema = z.object({
  permissionIds: z.array(z.string().cuid('Invalid permission ID')),
});

/**
 * Query Parameter Schemas
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const userFilterSchema = paginationSchema.extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING']).optional(),
  role: z.string().optional(),
  search: z.string().optional(),
});

/**
 * ID Parameter Schema
 */
export const idParamSchema = z.object({
  id: z.string().cuid('Invalid ID format'),
});

/**
 * Sanitize input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim();
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = { ...obj };
  
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeInput(sanitized[key]) as any;
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeObject(sanitized[key]);
    }
  }
  
  return sanitized;
}

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

// Type definitions for the RBAC system

export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  status: string;
  roles: string[];
  permissions: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface PermissionCheck {
  resource: string;
  action: string;
}

export interface AuditLogData {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: 'SUCCESS' | 'FAILURE';
  errorMessage?: string;
}

export interface CreateUserDTO {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  roleIds?: string[];
}

export interface UpdateUserDTO {
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
}

export interface AssignRoleDTO {
  userId: string;
  roleId: string;
  expiresAt?: Date;
}

export interface CreateRoleDTO {
  name: string;
  description?: string;
  permissionIds?: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// RULES ENGINE TYPES
// ============================================

export interface RuleCondition {
  type: 'expression' | 'threshold' | 'time_based' | 'role_based' | 'permission_based' | 'composite';
  expression?: string; // For expression-based conditions
  field?: string; // Field to evaluate
  operator?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'between';
  value?: any; // Value to compare against
  conditions?: RuleCondition[]; // For composite conditions
  logic?: 'AND' | 'OR'; // For composite conditions
  timeRange?: {
    start: string; // Time in HH:mm format
    end: string;
  };
  dateRange?: {
    start: Date;
    end: Date;
  };
  roles?: string[];
  permissions?: string[];
}

export interface RuleAction {
  type: 'allow' | 'block' | 'modify' | 'warn' | 'require_approval';
  message?: string;
  modifications?: Record<string, any>;
  approvers?: string[]; // Role IDs that can approve
  notifyUsers?: string[];
}

export interface RuleEvaluationContext {
  user: {
    id: string;
    email: string;
    roles: string[];
    permissions: string[];
  };
  action: string;
  moduleName: string;
  resourceData?: Record<string, any>;
  timestamp?: Date;
}

export interface RuleEvaluationResult {
  decision: 'ALLOWED' | 'BLOCKED' | 'MODIFIED' | 'WARNING' | 'APPROVAL_REQUIRED' | 'ERROR';
  message?: string;
  triggeredRules: Array<{
    ruleId: string;
    ruleName: string;
    severity: string;
    action: string;
  }>;
  modifications?: Record<string, any>;
  requiresApproval?: boolean;
  approvers?: string[];
  executionTimeMs: number;
  error?: string;
}

export interface CreateRuleDTO {
  name: string;
  moduleName: string;
  description?: string;
  category: 'ACADEMIC' | 'FINANCE' | 'HR' | 'ATTENDANCE' | 'DISCIPLINE' | 'LIBRARY' | 'TRANSPORT' | 'HOSTEL' | 'GENERAL';
  conditionType: 'EXPRESSION' | 'THRESHOLD' | 'TIME_BASED' | 'ROLE_BASED' | 'PERMISSION_BASED' | 'COMPOSITE';
  conditionPayload: RuleCondition;
  actionType: 'ALLOW' | 'BLOCK' | 'MODIFY' | 'WARN' | 'REQUIRE_APPROVAL';
  actionPayload?: RuleAction;
  severityLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  priority?: number;
  isActive?: boolean;
  effectiveFrom?: Date;
  effectiveTo?: Date;
}

export interface UpdateRuleDTO {
  name?: string;
  description?: string;
  conditionPayload?: RuleCondition;
  actionPayload?: RuleAction;
  severityLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  priority?: number;
  isActive?: boolean;
  effectiveFrom?: Date;
  effectiveTo?: Date;
}

export interface RuleMetrics {
  totalEvaluations: number;
  allowedCount: number;
  blockedCount: number;
  modifiedCount: number;
  warningCount: number;
  approvalRequiredCount: number;
  errorCount: number;
  averageExecutionTimeMs: number;
  rulesByModule: Record<string, number>;
  rulesBySeverity: Record<string, number>;
}

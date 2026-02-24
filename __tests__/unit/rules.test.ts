import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RulesService } from '@/modules/rules/rules.service';
import { prisma } from '@/lib/db/prisma';
import { RuleEvaluationContext } from '@/types';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    rule: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    ruleLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    ruleException: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(prisma)),
  },
}));

// Mock Audit Service
jest.mock('@/services/audit.service', () => ({
  AuditService: {
    logSuccess: jest.fn(),
    logFailure: jest.fn(),
  },
}));

describe('Rules Engine Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('evaluateRules', () => {
    const mockContext: RuleEvaluationContext = {
      user: {
        id: 'user123',
        email: 'test@example.com',
        roles: ['TEACHER'],
        permissions: ['attendance.create'],
      },
      action: 'SUBMIT_ATTENDANCE',
      moduleName: 'attendance',
      resourceData: {
        studentId: 'student123',
        date: new Date(),
        status: 'PRESENT',
      },
      timestamp: new Date(),
    };

    it('should allow action when no rules are triggered', async () => {
      (prisma.rule.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.ruleException.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await RulesService.evaluateRules(mockContext);

      expect(result.decision).toBe('ALLOWED');
      expect(result.triggeredRules).toHaveLength(0);
    });

    it('should block action when blocking rule is triggered', async () => {
      const blockingRule = {
        id: 'rule123',
        name: 'Block Test',
        moduleName: 'attendance',
        conditionType: 'THRESHOLD',
        conditionPayload: {
          type: 'threshold',
          field: 'status',
          operator: 'eq',
          value: 'PRESENT',
        },
        actionType: 'BLOCK',
        actionPayload: {
          type: 'block',
          message: 'Action blocked for testing',
        },
        severityLevel: 'HIGH',
        priority: 10,
        isActive: true,
      };

      (prisma.rule.findMany as jest.Mock).mockResolvedValue([blockingRule]);
      (prisma.ruleException.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.ruleLog.create as jest.Mock).mockResolvedValue({});

      const result = await RulesService.evaluateRules(mockContext);

      expect(result.decision).toBe('BLOCKED');
      expect(result.message).toContain('Action blocked');
      expect(result.triggeredRules).toHaveLength(1);
    });

    it('should modify action when modify rule is triggered', async () => {
      const modifyRule = {
        id: 'rule456',
        name: 'Modify Test',
        moduleName: 'attendance',
        conditionType: 'THRESHOLD',
        conditionPayload: {
          type: 'threshold',
          field: 'status',
          operator: 'eq',
          value: 'PRESENT',
        },
        actionType: 'MODIFY',
        actionPayload: {
          type: 'modify',
          message: 'Action modified',
          modifications: {
            status: 'VERIFIED_PRESENT',
          },
        },
        severityLevel: 'MEDIUM',
        priority: 20,
        isActive: true,
      };

      (prisma.rule.findMany as jest.Mock).mockResolvedValue([modifyRule]);
      (prisma.ruleException.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.ruleLog.create as jest.Mock).mockResolvedValue({});

      const result = await RulesService.evaluateRules(mockContext);

      expect(result.decision).toBe('MODIFIED');
      expect(result.modifications).toEqual({ status: 'VERIFIED_PRESENT' });
    });

    it('should require approval when approval rule is triggered', async () => {
      const approvalRule = {
        id: 'rule789',
        name: 'Approval Test',
        moduleName: 'attendance',
        conditionType: 'ROLE_BASED',
        conditionPayload: {
          type: 'role_based',
          roles: ['TEACHER'],
        },
        actionType: 'REQUIRE_APPROVAL',
        actionPayload: {
          type: 'require_approval',
          message: 'Requires approval',
          approvers: ['admin123'],
        },
        severityLevel: 'HIGH',
        priority: 15,
        isActive: true,
      };

      (prisma.rule.findMany as jest.Mock).mockResolvedValue([approvalRule]);
      (prisma.ruleException.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.ruleLog.create as jest.Mock).mockResolvedValue({});

      const result = await RulesService.evaluateRules(mockContext);

      expect(result.decision).toBe('APPROVAL_REQUIRED');
      expect(result.requiresApproval).toBe(true);
      expect(result.approvers).toContain('admin123');
    });

    it('should evaluate rules in priority order', async () => {
      const lowPriorityRule = {
        id: 'rule_low',
        name: 'Low Priority',
        moduleName: 'attendance',
        conditionType: 'THRESHOLD',
        conditionPayload: {
          type: 'threshold',
          field: 'status',
          operator: 'eq',
          value: 'PRESENT',
        },
        actionType: 'WARN',
        actionPayload: { type: 'warn', message: 'Low priority warning' },
        severityLevel: 'LOW',
        priority: 100,
        isActive: true,
      };

      const highPriorityRule = {
        id: 'rule_high',
        name: 'High Priority',
        moduleName: 'attendance',
        conditionType: 'THRESHOLD',
        conditionPayload: {
          type: 'threshold',
          field: 'status',
          operator: 'eq',
          value: 'PRESENT',
        },
        actionType: 'BLOCK',
        actionPayload: { type: 'block', message: 'High priority block' },
        severityLevel: 'HIGH',
        priority: 10,
        isActive: true,
      };

      // Return rules in wrong order - service should sort by priority
      (prisma.rule.findMany as jest.Mock).mockResolvedValue([
        lowPriorityRule,
        highPriorityRule,
      ]);
      (prisma.ruleException.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.ruleLog.create as jest.Mock).mockResolvedValue({});

      const result = await RulesService.evaluateRules(mockContext);

      // High priority blocking rule should be evaluated first
      expect(result.decision).toBe('BLOCKED');
      expect(result.message).toContain('High priority');
    });

    it('should skip evaluation if user has exception', async () => {
      const blockingRule = {
        id: 'rule123',
        name: 'Block Test',
        moduleName: 'attendance',
        conditionType: 'THRESHOLD',
        conditionPayload: { type: 'threshold', field: 'status', operator: 'eq', value: 'PRESENT' },
        actionType: 'BLOCK',
        actionPayload: { type: 'block', message: 'Blocked' },
        severityLevel: 'HIGH',
        priority: 10,
        isActive: true,
      };

      (prisma.rule.findMany as jest.Mock).mockResolvedValue([blockingRule]);
      (prisma.ruleException.findFirst as jest.Mock).mockResolvedValue({
        id: 'exception123',
        userId: 'user123',
        ruleId: 'rule123',
        isActive: true,
      });

      const result = await RulesService.evaluateRules(mockContext);

      expect(result.decision).toBe('ALLOWED');
      expect(result.message).toContain('exception');
    });
  });

  describe('Condition Evaluation', () => {
    it('should evaluate threshold conditions correctly', async () => {
      const context: RuleEvaluationContext = {
        user: {
          id: 'user123',
          email: 'test@example.com',
          roles: ['TEACHER'],
          permissions: [],
        },
        action: 'SUBMIT_GRADE',
        moduleName: 'grades',
        resourceData: {
          percentage: 85,
        },
      };

      const rule = {
        id: 'rule_threshold',
        name: 'Threshold Test',
        moduleName: 'grades',
        conditionType: 'THRESHOLD',
        conditionPayload: {
          type: 'threshold',
          field: 'percentage',
          operator: 'gte',
          value: 80,
        },
        actionType: 'ALLOW',
        actionPayload: { type: 'allow' },
        severityLevel: 'LOW',
        priority: 50,
        isActive: true,
      };

      (prisma.rule.findMany as jest.Mock).mockResolvedValue([rule]);
      (prisma.ruleException.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.ruleLog.create as jest.Mock).mockResolvedValue({});

      const result = await RulesService.evaluateRules(context);

      expect(result.decision).toBe('ALLOWED');
      expect(result.triggeredRules).toHaveLength(1);
    });

    it('should evaluate role-based conditions correctly', async () => {
      const context: RuleEvaluationContext = {
        user: {
          id: 'user123',
          email: 'test@example.com',
          roles: ['ADMIN'],
          permissions: [],
        },
        action: 'DELETE_USER',
        moduleName: 'users',
      };

      const rule = {
        id: 'rule_role',
        name: 'Role Test',
        moduleName: 'users',
        conditionType: 'ROLE_BASED',
        conditionPayload: {
          type: 'role_based',
          roles: ['ADMIN', 'SUPER_ADMIN'],
        },
        actionType: 'ALLOW',
        actionPayload: { type: 'allow' },
        severityLevel: 'HIGH',
        priority: 10,
        isActive: true,
      };

      (prisma.rule.findMany as jest.Mock).mockResolvedValue([rule]);
      (prisma.ruleException.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.ruleLog.create as jest.Mock).mockResolvedValue({});

      const result = await RulesService.evaluateRules(context);

      expect(result.decision).toBe('ALLOWED');
      expect(result.triggeredRules).toHaveLength(1);
    });
  });

  describe('Rule Management', () => {
    it('should create rule successfully', async () => {
      const ruleData = {
        name: 'Test Rule',
        moduleName: 'test',
        category: 'GENERAL' as const,
        conditionType: 'THRESHOLD' as const,
        conditionPayload: {
          type: 'threshold' as const,
          field: 'value',
          operator: 'gt' as const,
          value: 10,
        },
        actionType: 'BLOCK' as const,
      };

      (prisma.rule.create as jest.Mock).mockResolvedValue({
        id: 'new_rule',
        ...ruleData,
      });

      const result = await RulesService.createRule(ruleData, 'admin123');

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Rule');
    });

    it('should create new version when updating rule', async () => {
      const existingRule = {
        id: 'rule123',
        name: 'Old Rule',
        version: 1,
        moduleName: 'test',
        category: 'GENERAL',
        conditionType: 'THRESHOLD',
        conditionPayload: {},
        actionType: 'BLOCK',
        actionPayload: {},
        severityLevel: 'MEDIUM',
        priority: 100,
        isActive: true,
        effectiveFrom: new Date(),
        createdBy: 'admin123',
      };

      (prisma.rule.findUnique as jest.Mock).mockResolvedValue(existingRule);
      (prisma.rule.create as jest.Mock).mockResolvedValue({
        ...existingRule,
        id: 'rule123_v2',
        version: 2,
        name: 'Updated Rule',
      });
      (prisma.rule.update as jest.Mock).mockResolvedValue({});

      const result = await RulesService.updateRule(
        'rule123',
        { name: 'Updated Rule' },
        'admin123'
      );

      expect(result.version).toBe(2);
      expect(result.name).toBe('Updated Rule');
    });
  });
});

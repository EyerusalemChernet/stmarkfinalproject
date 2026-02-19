# Rules & Regulations Engine Documentation

## Overview

The Rules & Regulations Engine is a centralized, production-grade system that governs business logic across all modules in the School Management System. It provides dynamic, configurable rules that can be evaluated at runtime without code changes.

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────┐
│                    API Request                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Authentication Middleware                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Permission Guard                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              RULES ENGINE EVALUATION                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 1. Fetch Active Rules (by module, priority)     │  │
│  │ 2. Check Rule Exceptions                        │  │
│  │ 3. Evaluate Conditions (in priority order)      │  │
│  │ 4. Apply Actions (ALLOW/BLOCK/MODIFY/WARN)     │  │
│  │ 5. Log Evaluation Results                       │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Business Logic                              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│         Database Transaction + Audit Log                 │
└─────────────────────────────────────────────────────────┘
```

## Database Schema

### Rule Model

```prisma
model Rule {
  id              String        @id @default(cuid())
  name            String
  moduleName      String        // Module this rule applies to
  description     String?
  category        RuleCategory  // ACADEMIC, FINANCE, HR, etc.
  
  // Condition Configuration
  conditionType   ConditionType // EXPRESSION, THRESHOLD, TIME_BASED, etc.
  conditionPayload Json         // Flexible JSON for conditions
  
  // Action Configuration
  actionType      ActionType    // ALLOW, BLOCK, MODIFY, WARN, REQUIRE_APPROVAL
  actionPayload   Json?         // Additional action parameters
  
  // Metadata
  severityLevel   SeverityLevel // LOW, MEDIUM, HIGH, CRITICAL
  priority        Int           // Lower = higher priority
  isActive        Boolean
  
  // Time-bound
  effectiveFrom   DateTime
  effectiveTo     DateTime?
  
  // Versioning
  version         Int
  parentRuleId    String?
  
  // Audit
  createdBy       String
  createdAt       DateTime
  updatedAt       DateTime
}
```

### RuleLog Model

```prisma
model RuleLog {
  id              String       @id @default(cuid())
  ruleId          String
  userId          String?
  moduleName      String
  action          String
  resourceData    Json?
  conditionMet    Boolean
  actionTaken     ActionType
  decision        RuleDecision
  executionTimeMs Int
  metadata        Json?
  errorMessage    String?
  createdAt       DateTime
}
```

## Rule Types

### 1. Expression-Based Rules

Evaluate JavaScript-like expressions against context data.

**Example:**
```json
{
  "type": "expression",
  "expression": "(new Date() - new Date(data.date)) > (24 * 60 * 60 * 1000)"
}
```

**Use Cases:**
- Complex date calculations
- Multi-field comparisons
- Custom business logic

### 2. Threshold-Based Rules

Compare field values against thresholds.

**Example:**
```json
{
  "type": "threshold",
  "field": "percentage",
  "operator": "lt",
  "value": 40
}
```

**Operators:**
- `eq` - Equal
- `ne` - Not equal
- `gt` - Greater than
- `gte` - Greater than or equal
- `lt` - Less than
- `lte` - Less than or equal
- `in` - In array
- `nin` - Not in array
- `contains` - String contains
- `between` - Between two values

### 3. Time-Based Rules

Evaluate based on time or date ranges.

**Example:**
```json
{
  "type": "time_based",
  "timeRange": {
    "start": "08:00",
    "end": "18:00"
  }
}
```

**Use Cases:**
- School hours restrictions
- Deadline enforcement
- Seasonal rules

### 4. Role-Based Rules

Check if user has specific roles.

**Example:**
```json
{
  "type": "role_based",
  "roles": ["TEACHER", "ADMIN"]
}
```

### 5. Permission-Based Rules

Check if user has specific permissions.

**Example:**
```json
{
  "type": "permission_based",
  "permissions": ["grade.create", "grade.update"]
}
```

### 6. Composite Rules

Combine multiple conditions with AND/OR logic.

**Example:**
```json
{
  "type": "composite",
  "logic": "AND",
  "conditions": [
    {
      "type": "role_based",
      "roles": ["STUDENT"]
    },
    {
      "type": "time_based",
      "timeRange": { "start": "08:00", "end": "18:00" }
    }
  ]
}
```

## Action Types

### 1. ALLOW

Explicitly allow the action to proceed.

```json
{
  "type": "allow"
}
```

### 2. BLOCK

Block the action completely.

```json
{
  "type": "block",
  "message": "Action blocked: Deadline has passed"
}
```

### 3. MODIFY

Modify the data before processing.

```json
{
  "type": "modify",
  "message": "Grade capped at maximum",
  "modifications": {
    "percentage": 100,
    "score": "maxScore"
  }
}
```

### 4. WARN

Allow action but show warning.

```json
{
  "type": "warn",
  "message": "Warning: This is a failing grade"
}
```

### 5. REQUIRE_APPROVAL

Require approval before proceeding.

```json
{
  "type": "require_approval",
  "message": "Grade changes require approval",
  "approvers": ["role_admin_id"]
}
```

## Integration Guide

### Step 1: Import Required Services

```typescript
import { RulesService } from '@/services/rules.service';
import { buildAuthUser } from '@/lib/rbac/permissions';
import { AuditService } from '@/services/audit.service';
```

### Step 2: Build Evaluation Context

```typescript
const authUser = await buildAuthUser(userId);

const context = {
  user: {
    id: authUser.id,
    email: authUser.email,
    roles: authUser.roles,
    permissions: authUser.permissions,
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
```

### Step 3: Evaluate Rules

```typescript
const ruleResult = await RulesService.evaluateRules(context);
```

### Step 4: Handle Decision

```typescript
// Handle BLOCKED
if (ruleResult.decision === 'BLOCKED') {
  return NextResponse.json(
    { success: false, error: ruleResult.message },
    { status: 403 }
  );
}

// Handle APPROVAL_REQUIRED
if (ruleResult.decision === 'APPROVAL_REQUIRED') {
  // Create approval request
  return NextResponse.json({
    success: false,
    requiresApproval: true,
    approvers: ruleResult.approvers,
  });
}

// Apply modifications
let finalData = { ...originalData };
if (ruleResult.modifications) {
  finalData = { ...finalData, ...ruleResult.modifications };
}
```

### Step 5: Execute Business Logic in Transaction

```typescript
const result = await prisma.$transaction(async (tx) => {
  // Your business logic here
  const record = await tx.attendance.create({
    data: finalData,
  });

  // Audit logging
  await AuditService.logSuccess(
    userId,
    'ATTENDANCE_SUBMITTED',
    'Attendance',
    record.id,
    { rulesTriggered: ruleResult.triggeredRules.length }
  );

  return record;
});
```

## Complete Integration Example

```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication & Authorization
    const authCheck = await requirePermission(request, 'attendance', 'create');
    if (!authCheck.authorized) {
      return unauthorizedResponse(authCheck.error);
    }

    // 2. Validate Input
    const body = await request.json();
    const validatedData = submitAttendanceSchema.parse(body);

    // 3. Build Auth User
    const authUser = await buildAuthUser(authCheck.userId!);

    // 4. Evaluate Rules
    const ruleResult = await RulesService.evaluateRules({
      user: {
        id: authUser.id,
        email: authUser.email,
        roles: authUser.roles,
        permissions: authUser.permissions,
      },
      action: 'SUBMIT_ATTENDANCE',
      moduleName: 'attendance',
      resourceData: validatedData,
      timestamp: new Date(),
    });

    // 5. Handle Rule Decisions
    if (ruleResult.decision === 'BLOCKED') {
      return NextResponse.json(
        { success: false, error: ruleResult.message },
        { status: 403 }
      );
    }

    if (ruleResult.decision === 'APPROVAL_REQUIRED') {
      return NextResponse.json({
        success: false,
        requiresApproval: true,
        approvers: ruleResult.approvers,
      });
    }

    // 6. Apply Modifications
    let finalData = { ...validatedData };
    if (ruleResult.modifications) {
      finalData = { ...finalData, ...ruleResult.modifications };
    }

    // 7. Execute Business Logic in Transaction
    const attendance = await prisma.$transaction(async (tx) => {
      const record = await tx.attendance.create({
        data: {
          ...finalData,
          submittedBy: authCheck.userId,
        },
      });

      await AuditService.logSuccess(
        authCheck.userId!,
        'ATTENDANCE_SUBMITTED',
        'Attendance',
        record.id,
        { decision: ruleResult.decision }
      );

      return record;
    });

    // 8. Return Success Response
    return NextResponse.json({
      success: true,
      data: attendance,
      ruleEvaluation: {
        decision: ruleResult.decision,
        triggeredRules: ruleResult.triggeredRules,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
```

## Creating Rules

### Via API

```bash
curl -X POST http://localhost:3000/api/rules \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Block Late Attendance",
    "moduleName": "attendance",
    "category": "ATTENDANCE",
    "conditionType": "EXPRESSION",
    "conditionPayload": {
      "type": "expression",
      "expression": "(new Date() - new Date(data.date)) > (24 * 60 * 60 * 1000)"
    },
    "actionType": "BLOCK",
    "actionPayload": {
      "type": "block",
      "message": "Cannot submit attendance after 24 hours"
    },
    "severityLevel": "HIGH",
    "priority": 10
  }'
```

### Via Seed Data

```typescript
await prisma.rule.create({
  data: {
    name: 'Low Grade Warning',
    moduleName: 'grades',
    category: 'ACADEMIC',
    conditionType: 'THRESHOLD',
    conditionPayload: {
      type: 'threshold',
      field: 'percentage',
      operator: 'lt',
      value: 40,
    },
    actionType: 'WARN',
    actionPayload: {
      type: 'warn',
      message: 'Warning: This is a failing grade',
    },
    severityLevel: 'MEDIUM',
    priority: 50,
    isActive: true,
    createdBy: adminId,
  },
});
```

## Rule Priority

Rules are evaluated in priority order (lower number = higher priority).

**Recommended Priority Ranges:**
- `1-10`: Critical security rules (authentication, authorization)
- `11-30`: Business-critical rules (deadlines, approvals)
- `31-60`: Data validation rules
- `61-90`: Warning rules
- `91-100`: Informational rules

## Rule Versioning

When a rule is updated, a new version is created:

1. New rule created with incremented version number
2. `parentRuleId` points to previous version
3. Old version is deactivated
4. Complete audit trail maintained

**Benefits:**
- Track rule changes over time
- Rollback capability
- Compliance and auditing

## Rule Exceptions

Grant temporary exceptions to specific users:

```typescript
await prisma.ruleException.create({
  data: {
    ruleId: 'rule123',
    userId: 'user456',
    reason: 'Medical emergency',
    approvedBy: 'admin789',
    effectiveFrom: new Date(),
    effectiveTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    isActive: true,
  },
});
```

## Performance Considerations

### 1. Indexing

All critical fields are indexed:
- `moduleName` - Fast rule lookup by module
- `isActive` - Filter active rules
- `priority` - Efficient sorting
- `effectiveFrom`, `effectiveTo` - Time-based filtering

### 2. Caching (Future Enhancement)

Consider caching:
- Active rules per module (Redis)
- Rule evaluation results for identical contexts
- User permissions and roles

### 3. Execution Time Tracking

Every evaluation logs execution time:
```typescript
executionTimeMs: number
```

Monitor and optimize slow rules.

## Security

### 1. Permission-Based Access

Only authorized users can manage rules:
- `rule.create` - Create new rules
- `rule.update` - Update rules
- `rule.delete` - Deactivate rules
- `rule.read` - View rules

### 2. Audit Trail

All rule operations are logged:
- Rule creation
- Rule updates (versioning)
- Rule activation/deactivation
- Rule evaluations
- Rule exceptions

### 3. Input Validation

All rule data validated with Zod schemas:
- Condition payload structure
- Action payload structure
- Field types and ranges

### 4. Expression Safety

Expression evaluation uses limited scope:
- No access to global objects
- No file system access
- No network access
- Timeout protection

## Design Decisions

### Why JSON-Based Condition Payload?

**Advantages:**
1. **Flexibility**: Support any condition structure without schema changes
2. **Extensibility**: Add new condition types without migrations
3. **Versioning**: Easy to evolve condition formats
4. **Storage**: PostgreSQL JSON type with indexing support
5. **Validation**: Zod schemas validate structure at runtime

**Trade-offs:**
- Less type safety at database level
- Requires runtime validation
- More complex queries

**Mitigation:**
- Strong TypeScript types
- Comprehensive Zod validation
- Extensive testing

### How Rule Evaluation Scales

**Current Implementation:**
- Fetches rules per module (not all rules)
- Evaluates in priority order
- Stops on blocking rules
- Logs asynchronously

**Scaling Strategies:**
1. **Caching**: Cache active rules per module
2. **Lazy Loading**: Load rules on-demand
3. **Parallel Evaluation**: Evaluate independent rules in parallel
4. **Rule Compilation**: Pre-compile expressions
5. **Sharding**: Separate rule evaluation service

**Performance Targets:**
- < 50ms for simple rules
- < 200ms for complex composite rules
- < 500ms for worst-case scenarios

### How Architecture Prevents Duplication

**Centralization:**
- Single source of truth for business rules
- No scattered if-statements across codebase
- Consistent rule evaluation

**Reusability:**
- Same rule can apply to multiple actions
- Composite rules combine existing conditions
- Rule templates for common patterns

**Maintainability:**
- Update rules without code changes
- Version control for rule changes
- Clear audit trail

## SRS Requirements Mapping

### FR-RR-01: Dynamic Rule Configuration

✅ **Implemented:**
- Rules stored in database
- JSON-based flexible conditions
- No code changes required
- API for rule management

### FR-RR-02: Rule Evaluation Engine

✅ **Implemented:**
- `RulesService.evaluateRules()`
- Priority-based evaluation
- Multiple condition types
- Action execution

### FR-RR-03: Rule Versioning

✅ **Implemented:**
- Version field in Rule model
- Parent-child relationship
- Update creates new version
- Complete history maintained

### FR-RR-04: Audit Logging

✅ **Implemented:**
- RuleLog table
- Evaluation results logged
- Performance metrics tracked
- Integration with AuditLog

## Testing

### Unit Tests

```typescript
describe('Rules Engine', () => {
  it('should block action when blocking rule triggered', async () => {
    const result = await RulesService.evaluateRules(context);
    expect(result.decision).toBe('BLOCKED');
  });

  it('should evaluate rules in priority order', async () => {
    // Test implementation
  });

  it('should handle rule exceptions', async () => {
    // Test implementation
  });
});
```

### Integration Tests

```bash
# Test attendance submission with rules
curl -X POST http://localhost:3000/api/attendance/submit \
  -H "Authorization: Bearer TOKEN" \
  -d '{"studentId": "...", "date": "...", "status": "PRESENT"}'
```

## Monitoring

### Key Metrics

1. **Rule Evaluation Count**: Total evaluations per module
2. **Decision Distribution**: ALLOWED vs BLOCKED vs MODIFIED
3. **Execution Time**: Average and P95 execution time
4. **Error Rate**: Failed evaluations
5. **Rule Trigger Rate**: How often each rule triggers

### Dashboards

Query RuleLog table for metrics:

```sql
-- Evaluation count by module
SELECT moduleName, COUNT(*) as count
FROM rule_logs
WHERE createdAt > NOW() - INTERVAL '24 hours'
GROUP BY moduleName;

-- Decision distribution
SELECT decision, COUNT(*) as count
FROM rule_logs
WHERE createdAt > NOW() - INTERVAL '24 hours'
GROUP BY decision;

-- Average execution time
SELECT AVG(executionTimeMs) as avg_time
FROM rule_logs
WHERE createdAt > NOW() - INTERVAL '24 hours';
```

## Best Practices

1. **Keep Rules Simple**: Complex rules are harder to debug
2. **Use Descriptive Names**: Clear rule names aid understanding
3. **Set Appropriate Priorities**: Critical rules should have low priority numbers
4. **Test Thoroughly**: Test all rule conditions and actions
5. **Monitor Performance**: Track execution times
6. **Document Rules**: Add clear descriptions
7. **Version Carefully**: Test new versions before activation
8. **Use Exceptions Sparingly**: Exceptions should be temporary
9. **Regular Audits**: Review and clean up unused rules
10. **Gradual Rollout**: Test rules in staging first

## Troubleshooting

### Rule Not Triggering

1. Check if rule is active: `isActive = true`
2. Verify effective dates: `effectiveFrom` and `effectiveTo`
3. Check module name matches
4. Verify condition logic
5. Check rule priority

### Slow Rule Evaluation

1. Check execution time in RuleLog
2. Simplify complex expressions
3. Reduce number of active rules
4. Add caching
5. Optimize condition evaluation

### Unexpected Blocking

1. Check RuleLog for triggered rules
2. Verify rule conditions
3. Check for rule exceptions
4. Review rule priority order
5. Check audit logs

## Future Enhancements

1. **Rule Templates**: Pre-built rules for common scenarios
2. **Rule Testing UI**: Test rules before activation
3. **Rule Analytics**: Advanced metrics and insights
4. **Rule Recommendations**: AI-suggested rules
5. **Rule Conflicts Detection**: Identify conflicting rules
6. **Rule Performance Optimization**: Automatic optimization
7. **Rule Marketplace**: Share rules across institutions
8. **Visual Rule Builder**: Drag-and-drop rule creation

## Conclusion

The Rules & Regulations Engine provides a powerful, flexible, and scalable way to manage business logic across the School Management System. By centralizing rules in the database and providing a robust evaluation engine, it enables dynamic configuration without code changes while maintaining security, performance, and auditability.

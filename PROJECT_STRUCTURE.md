# School Management System - RBAC Module Architecture

## Project Structure
```
school-management-system/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts
│   │   │   │   ├── logout/route.ts
│   │   │   │   └── refresh/route.ts
│   │   │   ├── users/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/route.ts
│   │   │   └── roles/
│   │   │       ├── route.ts
│   │   │       └── [id]/permissions/route.ts
│   │   └── middleware.ts
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── jwt.ts
│   │   │   ├── password.ts
│   │   │   └── session.ts
│   │   ├── rbac/
│   │   │   ├── permissions.ts
│   │   │   ├── guards.ts
│   │   │   └── middleware.ts
│   │   ├── db/
│   │   │   └── prisma.ts
│   │   └── validation/
│   │       └── schemas.ts
│   ├── services/
│   │   ├── user.service.ts
│   │   ├── role.service.ts
│   │   ├── auth.service.ts
│   │   └── audit.service.ts
│   └── types/
│       └── index.ts
└── __tests__/
    ├── unit/
    │   ├── auth.test.ts
    │   ├── rbac.test.ts
    │   └── services.test.ts
    └── integration/
        └── api.test.ts
```

## Design Decisions

### 1. RBAC Architecture
- **Many-to-Many Relationships**: Users can have multiple roles, roles can have multiple permissions
- **Permission-Based Guards**: Authorization checks permissions, not roles directly
- **Granular Permissions**: Fine-grained control (e.g., "user.create", "user.read", "user.update", "user.delete")

### 2. Security Layers
- **Authentication Layer**: JWT with refresh tokens
- **Authorization Layer**: Permission-based middleware
- **Validation Layer**: Zod schemas for input validation
- **Audit Layer**: Comprehensive logging of all actions

### 3. Database Design
- **Soft Deletes**: Users marked inactive instead of deleted
- **Audit Trail**: Complete history of changes
- **Optimized Indexes**: On frequently queried fields
- **Cascading Rules**: Proper cleanup on deletions

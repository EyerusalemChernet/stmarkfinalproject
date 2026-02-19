# School Management System - RBAC Module

## Overview

This is an enterprise-grade Role-Based Access Control (RBAC) module designed for a School Management System. Built with Next.js, PostgreSQL, and Prisma ORM, it implements production-ready authentication and authorization with comprehensive security features.

## Features

### 🔐 Authentication
- Secure password hashing using bcrypt (12 rounds)
- JWT-based authentication with access and refresh tokens
- Token expiration and rotation
- Session management with device tracking
- Secure logout and logout-all functionality

### 🛡️ Authorization (RBAC)
- Granular permission-based access control
- Many-to-many role-permission mapping
- Permission guards: `requirePermission()`, `requireAnyPermission()`, `requireAllPermissions()`
- Middleware-based route protection
- Prevention of privilege escalation
- Prevention of horizontal access control violations

### 📊 Database Design
- Optimized Prisma schema with proper indexing
- Unique constraints and foreign keys
- Cascading rules for data integrity
- Soft delete for users (status field)
- Composite unique constraints

### 🔍 Audit Logging
- Comprehensive audit trail for all actions
- Tracks: who, what, when, where, status
- Failed login attempt tracking
- Resource history tracking
- User activity monitoring

### ✅ Input Validation
- Zod schemas for all inputs
- XSS prevention through sanitization
- Strong password requirements
- Email and username validation

### 🧪 Testing
- Unit tests for authentication
- Unit tests for RBAC system
- Service layer tests
- Mock implementations for isolated testing

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Validation**: Zod
- **Testing**: Jest
- **Language**: TypeScript

## Project Structure

```
school-management-system/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Seed data
├── src/
│   ├── app/
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # Authentication endpoints
│   │   │   ├── users/         # User management endpoints
│   │   │   └── roles/         # Role management endpoints
│   │   └── middleware.ts      # Global middleware
│   ├── lib/
│   │   ├── auth/              # Authentication utilities
│   │   ├── rbac/              # RBAC utilities
│   │   ├── db/                # Database client
│   │   └── validation/        # Validation schemas
│   ├── services/              # Business logic layer
│   └── types/                 # TypeScript types
└── __tests__/                 # Test files
```

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Database

Create a PostgreSQL database and update the `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/school_management"
JWT_SECRET="your-super-secret-jwt-key"
JWT_REFRESH_SECRET="your-super-secret-refresh-key"
```

### 3. Generate Prisma Client

```bash
npm run db:generate
```

### 4. Push Database Schema

```bash
npm run db:push
```

### 5. Seed Database

```bash
npm run db:seed
```

This will create:
- 4 default roles (SUPER_ADMIN, ADMIN, TEACHER, STUDENT)
- 18 permissions
- 4 test users with different roles

### 6. Run Development Server

```bash
npm run dev
```

## Test Credentials

After seeding, you can use these credentials:

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@school.edu | Admin@123 |
| Admin | admin@school.edu | Admin@123 |
| Teacher | teacher@school.edu | Admin@123 |
| Student | student@school.edu | Admin@123 |

## API Endpoints

### Authentication

#### POST /api/auth/login
Login with email and password.

**Request:**
```json
{
  "email": "admin@school.edu",
  "password": "Admin@123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "admin@school.edu",
      "username": "admin",
      "firstName": "John",
      "lastName": "Admin"
    },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc...",
      "expiresIn": 900
    }
  }
}
```

#### POST /api/auth/logout
Logout current session.

**Headers:**
```
Authorization: Bearer <access_token>
```

#### POST /api/auth/refresh
Refresh access token.

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

### User Management

#### GET /api/users
Get all users (requires `user.list` permission).

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 10)
- `status` (ACTIVE, INACTIVE, SUSPENDED, PENDING)
- `role` (role name)
- `search` (search in email, username, name)

#### POST /api/users
Create a new user (requires `user.create` permission).

**Request:**
```json
{
  "email": "newuser@school.edu",
  "username": "newuser",
  "password": "SecurePass123!",
  "firstName": "New",
  "lastName": "User",
  "roleIds": ["role_id_here"]
}
```

#### GET /api/users/[id]
Get user by ID (requires `user.read` permission).

#### PATCH /api/users/[id]
Update user (requires `user.update` permission).

#### DELETE /api/users/[id]
Delete user - soft delete (requires `user.delete` permission).

### Role Management

#### GET /api/roles
Get all roles (requires `role.read` permission).

#### POST /api/roles
Create a new role (requires `role.create` permission).

#### PUT /api/roles/[id]/permissions
Assign permissions to role (requires `permission.assign` permission).

## Permission System

### Permission Format

Permissions follow the format: `resource.action`

Examples:
- `user.create`
- `user.read`
- `user.update`
- `user.delete`
- `role.assign`

### Using Permission Guards

#### In API Routes

```typescript
import { requirePermission } from '@/lib/rbac/guards';

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'user', 'read');
  
  if (!authCheck.authorized) {
    return NextResponse.json(
      { error: authCheck.error },
      { status: 403 }
    );
  }
  
  // Your logic here
  const userId = authCheck.userId;
}
```

#### Multiple Permissions

```typescript
import { requireAnyPermission, requireAllPermissions } from '@/lib/rbac/guards';

// User needs ANY of these permissions
const authCheck = await requireAnyPermission(request, [
  { resource: 'user', action: 'read' },
  { resource: 'user', action: 'update' }
]);

// User needs ALL of these permissions
const authCheck = await requireAllPermissions(request, [
  { resource: 'user', action: 'read' },
  { resource: 'audit', action: 'read' }
]);
```

#### Higher-Order Function

```typescript
import { withPermission } from '@/lib/rbac/guards';

export const GET = withPermission('user', 'read', async (request, userId) => {
  // Your logic here - already authorized
  return NextResponse.json({ data: 'success' });
});
```

## Security Features

### 1. Password Security
- Minimum 8 characters
- Must contain uppercase, lowercase, number, and special character
- Hashed with bcrypt (12 rounds)
- Never stored or returned in plain text

### 2. JWT Security
- Short-lived access tokens (15 minutes)
- Long-lived refresh tokens (7 days)
- Tokens include session ID for revocation
- Secure token verification

### 3. Input Validation
- All inputs validated with Zod schemas
- XSS prevention through sanitization
- SQL injection prevention through Prisma

### 4. Access Control
- Permission-based authorization
- Prevents privilege escalation
- Prevents horizontal access violations
- Session validation on each request

### 5. Audit Logging
- All actions logged with context
- Failed attempts tracked
- IP address and user agent recorded
- Immutable audit trail

## Testing

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Generate Coverage Report

```bash
npm run test:coverage
```

### Test Structure

```
__tests__/
├── unit/
│   ├── auth.test.ts       # Authentication tests
│   ├── rbac.test.ts       # RBAC system tests
│   └── services.test.ts   # Service layer tests
└── integration/
    └── api.test.ts        # API endpoint tests
```

## Database Schema

### Core Tables

- **users**: User accounts with authentication data
- **roles**: Role definitions
- **permissions**: Permission definitions
- **user_roles**: Many-to-many user-role mapping
- **role_permissions**: Many-to-many role-permission mapping
- **sessions**: Active user sessions
- **audit_logs**: Comprehensive audit trail

### Key Features

- Composite unique constraints
- Proper indexing for performance
- Cascading deletes where appropriate
- Soft delete support
- Timestamp tracking

## Design Decisions

### 1. Permission-Based Over Role-Based Checks

Instead of checking roles directly:
```typescript
// ❌ Bad
if (user.role === 'ADMIN') { }

// ✅ Good
if (await hasPermission(userId, 'user', 'create')) { }
```

This allows flexible role definitions without code changes.

### 2. Separation of Concerns

- **Services**: Business logic
- **API Routes**: HTTP handling
- **Guards**: Authorization logic
- **Validation**: Input validation

### 3. Audit Everything

Every action is logged for compliance and debugging.

### 4. Fail Secure

Default to denying access unless explicitly permitted.

### 5. Soft Deletes

Users are marked inactive instead of deleted to preserve audit trails.

## Production Deployment

### Environment Variables

Ensure these are set in production:

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="<strong-random-secret>"
JWT_REFRESH_SECRET="<strong-random-secret>"
NODE_ENV="production"
```

### Security Checklist

- [ ] Change all default secrets
- [ ] Use strong database passwords
- [ ] Enable HTTPS
- [ ] Set up rate limiting
- [ ] Configure CORS properly
- [ ] Enable database backups
- [ ] Set up monitoring and alerts
- [ ] Review and test all permissions
- [ ] Implement IP whitelisting if needed
- [ ] Set up log aggregation

### Database Migrations

For production, use migrations instead of `db:push`:

```bash
npx prisma migrate deploy
```

## Academic Evaluation Criteria

This module demonstrates:

1. **Enterprise Architecture**: Clean separation of concerns, scalable structure
2. **Security Best Practices**: Multiple layers of security, OWASP compliance
3. **Database Design**: Normalized schema, proper indexing, referential integrity
4. **Code Quality**: TypeScript, proper typing, documentation
5. **Testing**: Comprehensive unit tests, mocking, coverage
6. **RBAC Implementation**: Proper permission-based access control
7. **Audit Logging**: Complete audit trail for compliance
8. **API Design**: RESTful endpoints, proper status codes, error handling
9. **Validation**: Input validation, sanitization, error messages
10. **Documentation**: Comprehensive README, inline comments, examples

## License

MIT

## Author

Final Year Project - School Management System

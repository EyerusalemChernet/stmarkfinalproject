# Quick Reference Guide

## Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema to database
npm run db:seed          # Seed database with test data
npm run db:studio        # Open Prisma Studio GUI

# Testing
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report

# Linting
npm run lint             # Run ESLint
```

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@school.edu | Admin@123 |
| Admin | admin@school.edu | Admin@123 |
| Teacher | teacher@school.edu | Admin@123 |
| Student | student@school.edu | Admin@123 |

## API Endpoints

### Authentication
```
POST   /api/auth/login      # Login
POST   /api/auth/logout     # Logout
POST   /api/auth/refresh    # Refresh token
```

### Users
```
GET    /api/users           # List users
POST   /api/users           # Create user
GET    /api/users/:id       # Get user
PATCH  /api/users/:id       # Update user
DELETE /api/users/:id       # Delete user
```

### Roles
```
GET    /api/roles           # List roles
POST   /api/roles           # Create role
PUT    /api/roles/:id/permissions  # Assign permissions
```

## Permission Format

```
resource.action

Examples:
- user.create
- user.read
- user.update
- user.delete
- role.assign
```

## Using Permission Guards

### In API Routes

```typescript
import { requirePermission } from '@/lib/rbac/guards';

export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'user', 'read');
  
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: 403 });
  }
  
  const userId = authCheck.userId;
  // Your logic here
}
```

### Multiple Permissions

```typescript
// User needs ANY of these
await requireAnyPermission(request, [
  { resource: 'user', action: 'read' },
  { resource: 'user', action: 'update' }
]);

// User needs ALL of these
await requireAllPermissions(request, [
  { resource: 'user', action: 'read' },
  { resource: 'audit', action: 'read' }
]);
```

### Higher-Order Function

```typescript
import { withPermission } from '@/lib/rbac/guards';

export const GET = withPermission('user', 'read', async (request, userId) => {
  // Already authorized
  return NextResponse.json({ data: 'success' });
});
```

## Common Code Snippets

### Create User

```typescript
import { UserService } from '@/services/user.service';

const user = await UserService.createUser({
  email: 'user@school.edu',
  username: 'username',
  password: 'SecurePass123!',
  firstName: 'First',
  lastName: 'Last',
  roleIds: ['role_id_here']
}, createdBy);
```

### Assign Role

```typescript
await UserService.assignRole(
  userId,
  roleId,
  assignedBy,
  expiresAt // optional
);
```

### Check Permission

```typescript
import { hasPermission } from '@/lib/rbac/permissions';

const canCreate = await hasPermission(userId, 'user', 'create');
```

### Log Audit

```typescript
import { AuditService } from '@/services/audit.service';

await AuditService.logSuccess(
  userId,
  'USER_CREATED',
  'User',
  newUserId,
  { email: 'user@school.edu' }
);
```

## Environment Variables

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/db"
JWT_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret"
NODE_ENV="development"
PORT=3000
BCRYPT_ROUNDS=12
```

## Database Schema Quick View

```
users
├── id (PK)
├── email (unique)
├── username (unique)
├── passwordHash
├── status
└── timestamps

roles
├── id (PK)
├── name (unique)
├── description
└── isSystem

permissions
├── id (PK)
├── resource
├── action
└── @@unique([resource, action])

user_roles (junction)
├── userId (FK)
├── roleId (FK)
└── @@unique([userId, roleId])

role_permissions (junction)
├── roleId (FK)
├── permissionId (FK)
└── @@unique([roleId, permissionId])

sessions
├── id (PK)
├── userId (FK)
├── token
├── refreshToken
└── expiresAt

audit_logs
├── id (PK)
├── userId (FK)
├── action
├── resource
├── status
└── createdAt
```

## Testing Examples

### Test Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@school.edu", "password": "Admin@123"}'
```

### Test Protected Endpoint

```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Test Permission Denial

```bash
# Login as student
# Try to create user (should fail with 403)
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer STUDENT_TOKEN" \
  -d '{...}'
```

## Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql  # Linux
brew services list                # macOS

# Verify DATABASE_URL in .env
```

### Port Already in Use
```bash
# Change port in .env
PORT=3001

# Or kill process
lsof -ti:3000 | xargs kill -9  # macOS/Linux
```

### Prisma Generate Failed
```bash
# Clear and regenerate
rm -rf node_modules
npm install
npm run db:generate
```

### JWT Token Invalid
```bash
# Check JWT_SECRET in .env
# Ensure token hasn't expired (15 min)
# Use refresh token to get new access token
```

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/          # Authentication endpoints
│   │   ├── users/         # User management
│   │   └── roles/         # Role management
│   └── middleware.ts      # Global middleware
├── lib/
│   ├── auth/              # Auth utilities
│   ├── rbac/              # RBAC utilities
│   ├── db/                # Database client
│   └── validation/        # Validation schemas
├── services/              # Business logic
└── types/                 # TypeScript types
```

## Default Roles & Permissions

### SUPER_ADMIN
- All permissions

### ADMIN
- user.* (all user permissions)
- role.* (all role permissions)
- audit.read

### TEACHER
- student.* (all student permissions)

### STUDENT
- student.read (own data only)

## Security Checklist

- [x] Password hashing (bcrypt)
- [x] JWT authentication
- [x] Permission-based authorization
- [x] Input validation (Zod)
- [x] XSS prevention (sanitization)
- [x] SQL injection prevention (Prisma)
- [x] Audit logging
- [x] Session management
- [x] Token expiration
- [x] Soft delete

## Performance Tips

1. **Use Indexes**: Already configured in schema
2. **Select Only Needed Fields**: Use Prisma `select`
3. **Pagination**: Always paginate large lists
4. **Cache Permissions**: Consider Redis for production
5. **Connection Pooling**: Prisma handles automatically

## Production Deployment

```bash
# 1. Set environment variables
export DATABASE_URL="..."
export JWT_SECRET="..."
export NODE_ENV="production"

# 2. Install dependencies
npm ci --only=production

# 3. Generate Prisma client
npx prisma generate

# 4. Run migrations
npx prisma migrate deploy

# 5. Build application
npm run build

# 6. Start server
npm start
```

## Useful Prisma Commands

```bash
# View database
npx prisma studio

# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Reset database
npx prisma migrate reset

# Generate client
npx prisma generate

# Format schema
npx prisma format
```

## HTTP Status Codes

- `200` - OK (successful GET, PATCH, DELETE)
- `201` - Created (successful POST)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error
```json
{
  "success": false,
  "error": "Error message",
  "details": [ ... ]
}
```

## Next Steps

1. Customize permissions for your modules
2. Add more roles as needed
3. Implement frontend UI
4. Add more API endpoints
5. Setup CI/CD pipeline
6. Add monitoring and logging
7. Deploy to production

## Resources

- [Prisma Docs](https://www.prisma.io/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [JWT.io](https://jwt.io)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## Support

- Check README.md for detailed documentation
- Review DESIGN_DECISIONS.md for architecture
- See API_EXAMPLES.md for testing examples
- Read SETUP_GUIDE.md for installation help

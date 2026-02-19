# Complete Setup Guide

This guide will walk you through setting up the RBAC module from scratch.

## Prerequisites

Before you begin, ensure you have:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **PostgreSQL** (v14 or higher) - [Download](https://www.postgresql.org/download/)
- **npm** or **yarn** package manager
- **Git** (optional, for version control)
- A code editor (VS Code recommended)

## Step-by-Step Setup

### 1. Install Node.js

Check if Node.js is installed:

```bash
node --version
npm --version
```

If not installed, download from [nodejs.org](https://nodejs.org/)

### 2. Install PostgreSQL

#### Windows
Download installer from [postgresql.org](https://www.postgresql.org/download/windows/)

#### macOS
```bash
brew install postgresql@14
brew services start postgresql@14
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 3. Create Database

```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE school_management;

# Create user (optional)
CREATE USER school_admin WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE school_management TO school_admin;

# Exit
\q
```

### 4. Clone/Create Project

If you have the code:
```bash
cd path/to/project
```

If starting fresh, create directory:
```bash
mkdir school-management-rbac
cd school-management-rbac
```

### 5. Install Dependencies

```bash
npm install
```

This will install:
- Next.js
- Prisma
- bcrypt
- jsonwebtoken
- zod
- And all other dependencies

### 6. Configure Environment Variables

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Database Connection
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/school_management"

# JWT Secrets (IMPORTANT: Change these!)
JWT_SECRET="your-super-secret-jwt-key-min-32-characters-long"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-min-32-characters-long"

# Application
NODE_ENV="development"
PORT=3000

# Security
BCRYPT_ROUNDS=12
```

**Generate Strong Secrets:**

```bash
# On Linux/macOS
openssl rand -base64 32

# On Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 7. Setup Prisma

Generate Prisma Client:

```bash
npm run db:generate
```

Push schema to database:

```bash
npm run db:push
```

This creates all tables in your database.

### 8. Seed Database

Populate with initial data:

```bash
npm run db:seed
```

This creates:
- 4 roles (SUPER_ADMIN, ADMIN, TEACHER, STUDENT)
- 18 permissions
- 4 test users

**Test Credentials:**
- Super Admin: `superadmin@school.edu` / `Admin@123`
- Admin: `admin@school.edu` / `Admin@123`
- Teacher: `teacher@school.edu` / `Admin@123`
- Student: `student@school.edu` / `Admin@123`

### 9. Start Development Server

```bash
npm run dev
```

Server starts at: `http://localhost:3000`

### 10. Verify Installation

Test the API:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@school.edu",
    "password": "Admin@123"
  }'
```

You should receive a JSON response with tokens.

## Troubleshooting

### Issue: Database Connection Failed

**Error:**
```
Error: Can't reach database server at `localhost:5432`
```

**Solutions:**
1. Check if PostgreSQL is running:
   ```bash
   # macOS
   brew services list
   
   # Linux
   sudo systemctl status postgresql
   
   # Windows
   # Check Services app
   ```

2. Verify connection string in `.env`
3. Check PostgreSQL port (default: 5432)
4. Ensure database exists:
   ```bash
   psql -U postgres -l
   ```

### Issue: Prisma Generate Failed

**Error:**
```
Error: Generator "client" failed
```

**Solutions:**
1. Delete `node_modules` and reinstall:
   ```bash
   rm -rf node_modules
   npm install
   ```

2. Clear Prisma cache:
   ```bash
   npx prisma generate --force
   ```

### Issue: Port Already in Use

**Error:**
```
Error: Port 3000 is already in use
```

**Solutions:**
1. Change port in `.env`:
   ```env
   PORT=3001
   ```

2. Or kill process using port 3000:
   ```bash
   # macOS/Linux
   lsof -ti:3000 | xargs kill -9
   
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

### Issue: bcrypt Installation Failed

**Error:**
```
Error: node-gyp rebuild failed
```

**Solutions:**

**Windows:**
```bash
npm install --global windows-build-tools
npm install bcrypt
```

**macOS:**
```bash
xcode-select --install
npm install bcrypt
```

**Linux:**
```bash
sudo apt-get install build-essential
npm install bcrypt
```

### Issue: JWT Secret Not Set

**Error:**
```
Error: JWT_SECRET is not defined
```

**Solution:**
Ensure `.env` file exists and contains:
```env
JWT_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret-key"
```

## Database Management

### View Database with Prisma Studio

```bash
npm run db:studio
```

Opens GUI at `http://localhost:5555`

### Reset Database

```bash
# Drop all tables and recreate
npx prisma db push --force-reset

# Reseed
npm run db:seed
```

### Create Migration

```bash
npx prisma migrate dev --name migration_name
```

### Apply Migrations (Production)

```bash
npx prisma migrate deploy
```

## Running Tests

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

Coverage report will be in `coverage/` directory.

## Development Tools

### VS Code Extensions (Recommended)

1. **Prisma** - Syntax highlighting for Prisma schema
2. **ESLint** - Code linting
3. **Prettier** - Code formatting
4. **REST Client** - Test API endpoints
5. **Thunder Client** - Alternative to Postman

### Useful Commands

```bash
# Format code
npm run lint

# Build for production
npm run build

# Start production server
npm run start

# View database
npm run db:studio

# Generate Prisma types
npm run db:generate
```

## Production Deployment

### 1. Environment Setup

Create production `.env`:

```env
DATABASE_URL="postgresql://user:pass@production-host:5432/db"
JWT_SECRET="<strong-random-secret-64-chars>"
JWT_REFRESH_SECRET="<strong-random-secret-64-chars>"
NODE_ENV="production"
```

### 2. Build Application

```bash
npm run build
```

### 3. Run Migrations

```bash
npx prisma migrate deploy
```

### 4. Start Server

```bash
npm start
```

### 5. Use Process Manager

**PM2:**
```bash
npm install -g pm2
pm2 start npm --name "school-rbac" -- start
pm2 save
pm2 startup
```

### 6. Setup Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 7. Enable HTTPS

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Docker Setup (Optional)

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/school_management
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
    depends_on:
      - db

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=school_management
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Run with Docker

```bash
docker-compose up -d
```

## Monitoring and Logging

### Setup Logging

Install Winston:

```bash
npm install winston
```

Create `src/lib/logger.ts`:

```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}
```

### Health Check Endpoint

Create `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
```

## Backup and Recovery

### Backup Database

```bash
# Create backup
pg_dump -U postgres school_management > backup.sql

# With timestamp
pg_dump -U postgres school_management > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database

```bash
psql -U postgres school_management < backup.sql
```

### Automated Backups (Cron)

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * pg_dump -U postgres school_management > /backups/backup_$(date +\%Y\%m\%d).sql
```

## Next Steps

1. **Customize Permissions**: Add permissions for your specific modules
2. **Add More Roles**: Create roles for your school's needs
3. **Implement Frontend**: Build React/Next.js UI
4. **Add More Features**: Extend with additional modules
5. **Setup CI/CD**: Automate testing and deployment
6. **Add Monitoring**: Setup error tracking (Sentry, etc.)

## Getting Help

- Check `README.md` for API documentation
- Review `DESIGN_DECISIONS.md` for architecture details
- See `API_EXAMPLES.md` for testing examples
- Open an issue on GitHub (if applicable)

## Checklist

- [ ] Node.js installed
- [ ] PostgreSQL installed and running
- [ ] Database created
- [ ] Dependencies installed
- [ ] `.env` file configured
- [ ] Prisma generated
- [ ] Database schema pushed
- [ ] Database seeded
- [ ] Development server running
- [ ] API tested successfully
- [ ] Tests passing

Congratulations! Your RBAC module is now set up and ready for development! 🎉

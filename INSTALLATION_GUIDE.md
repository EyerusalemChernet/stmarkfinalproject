# Installation Guide - Complete Setup

## Prerequisites

1. **Node.js** (v18 or higher)
2. **PostgreSQL** (v14 or higher)
3. **npm** or **yarn**

## Step-by-Step Installation

### 1. Install Dependencies

```bash
# Install all dependencies
npm install

# If you get any peer dependency warnings, run:
npm install --legacy-peer-deps
```

### 2. Setup Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your actual values:
# DATABASE_URL="postgresql://username:password@localhost:5432/school_management"
# JWT_SECRET="your-super-secret-jwt-key-min-32-characters"
# JWT_REFRESH_SECRET="your-super-secret-refresh-key-min-32-characters"
```

### 3. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (creates tables)
npm run db:push

# Seed database with sample data
npm run db:seed
```

### 4. Build and Test

```bash
# Build the project
npm run build

# Run tests
npm test

# Start development server
npm run dev
```

## Troubleshooting

### Issue: "Cannot find module 'zod'"
**Solution**: Run `npm install` to install all dependencies

### Issue: "Cannot find module 'next/server'"
**Solution**: Make sure Next.js is installed: `npm install next@latest`

### Issue: Database connection errors
**Solution**: 
1. Make sure PostgreSQL is running
2. Check DATABASE_URL in .env file
3. Create the database if it doesn't exist

### Issue: TypeScript errors
**Solution**: 
1. Run `npm run db:generate` to generate Prisma types
2. Restart your TypeScript server in VS Code
3. Check tsconfig.json is properly configured

## Verification

After installation, verify everything works:

```bash
# 1. Check if server starts
npm run dev

# 2. Test API endpoint
curl http://localhost:3000/api/health

# 3. Test authentication
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@school.edu", "password": "Admin@123"}'
```

## Development Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema changes
npm run db:seed          # Seed with sample data
npm run db:studio        # Open Prisma Studio

# Testing
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
```

## Project Structure

```
school-management-system/
├── prisma/              # Database schema and migrations
├── src/
│   ├── app/api/         # API routes
│   ├── lib/             # Utilities and helpers
│   ├── services/        # Business logic
│   └── types/           # TypeScript types
├── __tests__/           # Test files
└── docs/                # Documentation
```

## Next Steps

1. Customize the rules in the database
2. Add your own business logic
3. Implement frontend UI
4. Deploy to production

## Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Review the error logs
3. Ensure all dependencies are installed
4. Verify environment variables are set correctly
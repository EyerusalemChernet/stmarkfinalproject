# API Testing Examples

This document provides practical examples for testing the RBAC API using cURL, Postman, or any HTTP client.

## Base URL

```
http://localhost:3000
```

## Authentication Examples

### 1. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@school.edu",
    "password": "Admin@123"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx...",
      "email": "admin@school.edu",
      "username": "admin",
      "firstName": "John",
      "lastName": "Admin",
      "status": "ACTIVE"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900
    }
  },
  "message": "Login successful"
}
```

**Save the accessToken for subsequent requests!**

### 2. Refresh Token

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN_HERE"
  }'
```

### 3. Logout

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

## User Management Examples

### 1. List All Users

```bash
curl -X GET "http://localhost:3000/api/users?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

**With Filters:**
```bash
# Filter by status
curl -X GET "http://localhost:3000/api/users?status=ACTIVE" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"

# Search users
curl -X GET "http://localhost:3000/api/users?search=john" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"

# Filter by role
curl -X GET "http://localhost:3000/api/users?role=TEACHER" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "email": "admin@school.edu",
      "username": "admin",
      "firstName": "John",
      "lastName": "Admin",
      "status": "ACTIVE",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLoginAt": "2024-01-15T10:30:00.000Z",
      "roles": [
        {
          "role": {
            "id": "clx...",
            "name": "ADMIN"
          }
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 4,
    "totalPages": 1
  }
}
```

### 2. Get User by ID

```bash
curl -X GET http://localhost:3000/api/users/USER_ID_HERE \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

### 3. Create New User

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newteacher@school.edu",
    "username": "newteacher",
    "password": "SecurePass123!",
    "firstName": "Jane",
    "lastName": "Doe",
    "roleIds": ["ROLE_ID_HERE"]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "email": "newteacher@school.edu",
    "username": "newteacher",
    "firstName": "Jane",
    "lastName": "Doe",
    "status": "ACTIVE",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "message": "User created successfully"
}
```

### 4. Update User

```bash
curl -X PATCH http://localhost:3000/api/users/USER_ID_HERE \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "status": "ACTIVE"
  }'
```

### 5. Delete User (Soft Delete)

```bash
curl -X DELETE http://localhost:3000/api/users/USER_ID_HERE \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

## Role Management Examples

### 1. List All Roles

```bash
curl -X GET http://localhost:3000/api/roles \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "name": "ADMIN",
      "description": "Administrative access to manage users and roles",
      "isSystem": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "permissions": [
        {
          "permission": {
            "id": "clx...",
            "resource": "user",
            "action": "create",
            "description": "Create new users"
          }
        }
      ],
      "_count": {
        "users": 1
      }
    }
  ]
}
```

### 2. Create New Role

```bash
curl -X POST http://localhost:3000/api/roles \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "LIBRARIAN",
    "description": "Manages library resources",
    "permissionIds": ["PERMISSION_ID_1", "PERMISSION_ID_2"]
  }'
```

### 3. Assign Permissions to Role

```bash
curl -X PUT http://localhost:3000/api/roles/ROLE_ID_HERE/permissions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "permissionIds": [
      "PERMISSION_ID_1",
      "PERMISSION_ID_2",
      "PERMISSION_ID_3"
    ]
  }'
```

## Error Response Examples

### 1. Unauthorized (No Token)

```json
{
  "success": false,
  "error": "Authentication required"
}
```

### 2. Forbidden (Insufficient Permissions)

```json
{
  "success": false,
  "error": "Forbidden - Missing permission: user.create"
}
```

### 3. Validation Error

```json
{
  "success": false,
  "error": "Validation error",
  "details": [
    {
      "code": "too_small",
      "minimum": 8,
      "type": "string",
      "inclusive": true,
      "exact": false,
      "message": "Password must be at least 8 characters",
      "path": ["password"]
    }
  ]
}
```

### 4. Resource Not Found

```json
{
  "success": false,
  "error": "User not found"
}
```

## Postman Collection

### Environment Variables

Create a Postman environment with:

```json
{
  "baseUrl": "http://localhost:3000",
  "accessToken": "",
  "refreshToken": ""
}
```

### Pre-request Script for Authentication

Add this to your collection's pre-request script:

```javascript
// Automatically add token to requests
if (pm.environment.get("accessToken")) {
  pm.request.headers.add({
    key: "Authorization",
    value: "Bearer " + pm.environment.get("accessToken")
  });
}
```

### Test Script for Login

Add this to the login request's test script:

```javascript
// Save tokens after login
if (pm.response.code === 200) {
  const response = pm.response.json();
  pm.environment.set("accessToken", response.data.tokens.accessToken);
  pm.environment.set("refreshToken", response.data.tokens.refreshToken);
}
```

## Testing Permission System

### Test 1: Admin Can Create Users

```bash
# Login as admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@school.edu", "password": "Admin@123"}'

# Create user (should succeed)
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@school.edu",
    "username": "testuser",
    "password": "Test123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Expected**: Success (200)

### Test 2: Student Cannot Create Users

```bash
# Login as student
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "student@school.edu", "password": "Admin@123"}'

# Try to create user (should fail)
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@school.edu",
    "username": "testuser",
    "password": "Test123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Expected**: Forbidden (403)

### Test 3: Unauthorized Access

```bash
# Try to access without token
curl -X GET http://localhost:3000/api/users
```

**Expected**: Unauthorized (401)

### Test 4: Invalid Token

```bash
# Try with invalid token
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer invalid_token_here"
```

**Expected**: Unauthorized (401)

## Testing Audit Logs

After performing actions, you can query audit logs (if you implement the endpoint):

```bash
curl -X GET "http://localhost:3000/api/audit?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

## Performance Testing

### Load Test with Apache Bench

```bash
# Test login endpoint
ab -n 1000 -c 10 -p login.json -T application/json \
  http://localhost:3000/api/auth/login
```

Where `login.json` contains:
```json
{"email": "admin@school.edu", "password": "Admin@123"}
```

### Load Test with wrk

```bash
wrk -t12 -c400 -d30s \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/users
```

## Security Testing

### Test 1: SQL Injection Attempt

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@school.edu OR 1=1--",
    "password": "anything"
  }'
```

**Expected**: Login fails (Prisma prevents SQL injection)

### Test 2: XSS Attempt

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@school.edu",
    "username": "test",
    "password": "Test123!",
    "firstName": "<script>alert(\"XSS\")</script>",
    "lastName": "User"
  }'
```

**Expected**: Script tags removed by sanitization

### Test 3: Weak Password

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@school.edu",
    "username": "test",
    "password": "weak",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Expected**: Validation error (400)

## Automated Testing Script

Create a bash script `test-api.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"

echo "Testing RBAC API..."

# Test 1: Login
echo "1. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@school.edu", "password": "Admin@123"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.tokens.accessToken')

if [ "$TOKEN" != "null" ]; then
  echo "✓ Login successful"
else
  echo "✗ Login failed"
  exit 1
fi

# Test 2: List users
echo "2. Testing list users..."
USERS_RESPONSE=$(curl -s -X GET $BASE_URL/api/users \
  -H "Authorization: Bearer $TOKEN")

SUCCESS=$(echo $USERS_RESPONSE | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
  echo "✓ List users successful"
else
  echo "✗ List users failed"
fi

# Test 3: Unauthorized access
echo "3. Testing unauthorized access..."
UNAUTH_RESPONSE=$(curl -s -X GET $BASE_URL/api/users)

ERROR=$(echo $UNAUTH_RESPONSE | jq -r '.error')

if [ "$ERROR" != "null" ]; then
  echo "✓ Unauthorized access blocked"
else
  echo "✗ Unauthorized access not blocked"
fi

echo "Tests completed!"
```

Run with:
```bash
chmod +x test-api.sh
./test-api.sh
```

## Conclusion

These examples cover:
- Authentication flow
- User management operations
- Role management operations
- Permission testing
- Error handling
- Security testing
- Performance testing

Use these as a starting point for comprehensive API testing of your RBAC module.

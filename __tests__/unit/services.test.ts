import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UserService } from '@/services/user.service';
import { RoleService } from '@/services/role.service';
import { prisma } from '@/lib/db/prisma';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    userRole: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    rolePermission: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

// Mock audit service
jest.mock('@/services/audit.service', () => ({
  AuditService: {
    logSuccess: jest.fn(),
    logFailure: jest.fn(),
  },
}));

// Mock password hashing
jest.mock('@/lib/auth/password', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed_password'),
}));

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const mockUserData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 'user123',
        ...mockUserData,
        passwordHash: 'hashed_password',
        status: 'ACTIVE',
      });

      const result = await UserService.createUser(mockUserData, 'admin123');

      expect(result).toBeDefined();
      expect(result.email).toBe(mockUserData.email);
      expect(result.passwordHash).toBeUndefined(); // Password should not be returned
    });

    it('should throw error if email already exists', async () => {
      const mockUserData = {
        email: 'existing@example.com',
        username: 'testuser',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing123',
        email: 'existing@example.com',
      });

      await expect(
        UserService.createUser(mockUserData, 'admin123')
      ).rejects.toThrow('Email already exists');
    });

    it('should throw error if username already exists', async () => {
      const mockUserData = {
        email: 'test@example.com',
        username: 'existinguser',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
      };

      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // Email check
        .mockResolvedValueOnce({ id: 'existing123', username: 'existinguser' }); // Username check

      await expect(
        UserService.createUser(mockUserData, 'admin123')
      ).rejects.toThrow('Username already exists');
    });
  });

  describe('getUserById', () => {
    it('should return user without password', async () => {
      const mockUser = {
        id: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashed_password',
        firstName: 'Test',
        lastName: 'User',
        roles: [],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await UserService.getUserById('user123');

      expect(result).toBeDefined();
      expect(result.passwordHash).toBeUndefined();
      expect(result.email).toBe(mockUser.email);
    });

    it('should return null for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await UserService.getUserById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('assignRole', () => {
    it('should assign role to user successfully', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user123' });
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({ id: 'role123', name: 'ADMIN' });
      (prisma.userRole.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.userRole.create as jest.Mock).mockResolvedValue({});

      await expect(
        UserService.assignRole('user123', 'role123', 'admin123')
      ).resolves.not.toThrow();
    });

    it('should throw error if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        UserService.assignRole('nonexistent', 'role123', 'admin123')
      ).rejects.toThrow('User not found');
    });

    it('should throw error if role not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user123' });
      (prisma.role.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        UserService.assignRole('user123', 'nonexistent', 'admin123')
      ).rejects.toThrow('Role not found');
    });

    it('should throw error if role already assigned', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user123' });
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({ id: 'role123' });
      (prisma.userRole.findUnique as jest.Mock).mockResolvedValue({ id: 'assignment123' });

      await expect(
        UserService.assignRole('user123', 'role123', 'admin123')
      ).rejects.toThrow('Role already assigned to user');
    });
  });
});

describe('RoleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRole', () => {
    it('should create a new role successfully', async () => {
      const mockRoleData = {
        name: 'CUSTOM_ROLE',
        description: 'Custom role for testing',
      };

      (prisma.role.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.role.create as jest.Mock).mockResolvedValue({
        id: 'role123',
        ...mockRoleData,
        isSystem: false,
      });

      const result = await RoleService.createRole(mockRoleData, 'admin123');

      expect(result).toBeDefined();
      expect(result.name).toBe(mockRoleData.name);
    });

    it('should throw error if role name already exists', async () => {
      const mockRoleData = {
        name: 'EXISTING_ROLE',
        description: 'Existing role',
      };

      (prisma.role.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing123',
        name: 'EXISTING_ROLE',
      });

      await expect(
        RoleService.createRole(mockRoleData, 'admin123')
      ).rejects.toThrow('Role name already exists');
    });
  });

  describe('deleteRole', () => {
    it('should delete non-system role successfully', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({
        id: 'role123',
        name: 'CUSTOM_ROLE',
        isSystem: false,
      });
      (prisma.role.delete as jest.Mock).mockResolvedValue({});

      await expect(
        RoleService.deleteRole('role123', 'admin123')
      ).resolves.not.toThrow();
    });

    it('should throw error when deleting system role', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({
        id: 'role123',
        name: 'SUPER_ADMIN',
        isSystem: true,
      });

      await expect(
        RoleService.deleteRole('role123', 'admin123')
      ).rejects.toThrow('Cannot delete system roles');
    });

    it('should throw error if role not found', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        RoleService.deleteRole('nonexistent', 'admin123')
      ).rejects.toThrow('Role not found');
    });
  });
});

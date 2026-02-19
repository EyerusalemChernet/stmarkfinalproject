import { prisma } from '@/lib/db/prisma';
import { CreateRoleDTO } from '@/types';
import { AuditService } from './audit.service';

/**
 * Role Service - Handles all role management operations
 */
export class RoleService {
  /**
   * Create a new role
   */
  static async createRole(
    data: CreateRoleDTO,
    createdBy: string
  ): Promise<any> {
    // Check if role name already exists
    const existingRole = await prisma.role.findUnique({
      where: { name: data.name },
    });

    if (existingRole) {
      throw new Error('Role name already exists');
    }

    // Create role
    const role = await prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        isSystem: false,
      },
    });

    // Assign permissions if provided
    if (data.permissionIds && data.permissionIds.length > 0) {
      await Promise.all(
        data.permissionIds.map((permissionId) =>
          prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId,
            },
          })
        )
      );
    }

    // Log role creation
    await AuditService.logSuccess(
      createdBy,
      'ROLE_CREATED',
      'Role',
      role.id,
      { name: data.name }
    );

    return role;
  }

  /**
   * Get role by ID
   */
  static async getRoleById(roleId: string): Promise<any | null> {
    return prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get all roles
   */
  static async getRoles(): Promise<any[]> {
    return prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Update role
   */
  static async updateRole(
    roleId: string,
    data: { name?: string; description?: string },
    updatedBy: string
  ): Promise<any> {
    // Check if role exists
    const existingRole = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!existingRole) {
      throw new Error('Role not found');
    }

    // Prevent updating system roles
    if (existingRole.isSystem) {
      throw new Error('Cannot update system roles');
    }

    // Check for name uniqueness if name is being updated
    if (data.name && data.name !== existingRole.name) {
      const nameExists = await prisma.role.findUnique({
        where: { name: data.name },
      });

      if (nameExists) {
        throw new Error('Role name already exists');
      }
    }

    // Update role
    const role = await prisma.role.update({
      where: { id: roleId },
      data,
    });

    // Log role update
    await AuditService.logSuccess(
      updatedBy,
      'ROLE_UPDATED',
      'Role',
      roleId,
      { changes: data }
    );

    return role;
  }

  /**
   * Delete role
   */
  static async deleteRole(roleId: string, deletedBy: string): Promise<void> {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    // Prevent deleting system roles
    if (role.isSystem) {
      throw new Error('Cannot delete system roles');
    }

    // Delete role (cascade will handle user_roles and role_permissions)
    await prisma.role.delete({
      where: { id: roleId },
    });

    // Log role deletion
    await AuditService.logSuccess(
      deletedBy,
      'ROLE_DELETED',
      'Role',
      roleId,
      { name: role.name }
    );
  }

  /**
   * Assign permissions to role
   */
  static async assignPermissions(
    roleId: string,
    permissionIds: string[],
    assignedBy: string
  ): Promise<void> {
    // Check if role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    // Remove existing permissions
    await prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    // Assign new permissions
    await Promise.all(
      permissionIds.map((permissionId) =>
        prisma.rolePermission.create({
          data: {
            roleId,
            permissionId,
          },
        })
      )
    );

    // Log permission assignment
    await AuditService.logSuccess(
      assignedBy,
      'PERMISSIONS_ASSIGNED',
      'Role',
      roleId,
      { permissionIds, roleName: role.name }
    );
  }

  /**
   * Get all permissions
   */
  static async getAllPermissions(): Promise<any[]> {
    return prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  /**
   * Get permissions grouped by resource
   */
  static async getPermissionsGrouped(): Promise<Record<string, any[]>> {
    const permissions = await this.getAllPermissions();

    return permissions.reduce((acc, permission) => {
      if (!acc[permission.resource]) {
        acc[permission.resource] = [];
      }
      acc[permission.resource].push(permission);
      return acc;
    }, {} as Record<string, any[]>);
  }
}

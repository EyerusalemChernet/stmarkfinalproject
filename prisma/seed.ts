import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ============================================
  // 1. CREATE PERMISSIONS
  // ============================================
  console.log('Creating permissions...');
  
  const permissions = [
    // User Management
    { resource: 'user', action: 'create', description: 'Create new users' },
    { resource: 'user', action: 'read', description: 'View user details' },
    { resource: 'user', action: 'update', description: 'Update user information' },
    { resource: 'user', action: 'delete', description: 'Delete users' },
    { resource: 'user', action: 'list', description: 'List all users' },
    
    // Role Management
    { resource: 'role', action: 'create', description: 'Create new roles' },
    { resource: 'role', action: 'read', description: 'View role details' },
    { resource: 'role', action: 'update', description: 'Update role information' },
    { resource: 'role', action: 'delete', description: 'Delete roles' },
    { resource: 'role', action: 'assign', description: 'Assign roles to users' },
    
    // Permission Management
    { resource: 'permission', action: 'read', description: 'View permissions' },
    { resource: 'permission', action: 'assign', description: 'Assign permissions to roles' },
    
    // Audit Logs
    { resource: 'audit', action: 'read', description: 'View audit logs' },
    
    // Student Management (for future modules)
    { resource: 'student', action: 'create', description: 'Create student records' },
    { resource: 'student', action: 'read', description: 'View student details' },
    { resource: 'student', action: 'update', description: 'Update student information' },
    { resource: 'student', action: 'delete', description: 'Delete student records' },
  ];

  const createdPermissions = await Promise.all(
    permissions.map(p => 
      prisma.permission.upsert({
        where: { resource_action: { resource: p.resource, action: p.action } },
        update: {},
        create: p,
      })
    )
  );

  console.log(`✅ Created ${createdPermissions.length} permissions`);

  // ============================================
  // 2. CREATE ROLES
  // ============================================
  console.log('Creating roles...');

  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SUPER_ADMIN' },
    update: {},
    create: {
      name: 'SUPER_ADMIN',
      description: 'Full system access with all permissions',
      isSystem: true,
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Administrative access to manage users and roles',
      isSystem: true,
    },
  });

  const teacherRole = await prisma.role.upsert({
    where: { name: 'TEACHER' },
    update: {},
    create: {
      name: 'TEACHER',
      description: 'Teacher access to manage students and classes',
      isSystem: false,
    },
  });

  const studentRole = await prisma.role.upsert({
    where: { name: 'STUDENT' },
    update: {},
    create: {
      name: 'STUDENT',
      description: 'Student access to view own information',
      isSystem: false,
    },
  });

  console.log('✅ Created roles');

  // ============================================
  // 3. ASSIGN PERMISSIONS TO ROLES
  // ============================================
  console.log('Assigning permissions to roles...');

  // Super Admin gets ALL permissions
  const allPermissions = await prisma.permission.findMany();
  await Promise.all(
    allPermissions.map(p =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdminRole.id,
            permissionId: p.id,
          },
        },
        update: {},
        create: {
          roleId: superAdminRole.id,
          permissionId: p.id,
        },
      })
    )
  );

  // Admin gets user and role management permissions
  const adminPermissions = await prisma.permission.findMany({
    where: {
      OR: [
        { resource: 'user' },
        { resource: 'role' },
        { resource: 'audit', action: 'read' },
      ],
    },
  });

  await Promise.all(
    adminPermissions.map(p =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: p.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: p.id,
        },
      })
    )
  );

  // Teacher gets student management permissions
  const teacherPermissions = await prisma.permission.findMany({
    where: {
      resource: 'student',
    },
  });

  await Promise.all(
    teacherPermissions.map(p =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: teacherRole.id,
            permissionId: p.id,
          },
        },
        update: {},
        create: {
          roleId: teacherRole.id,
          permissionId: p.id,
        },
      })
    )
  );

  // Student gets read-only access to student resource
  const studentPermissions = await prisma.permission.findMany({
    where: {
      resource: 'student',
      action: 'read',
    },
  });

  await Promise.all(
    studentPermissions.map(p =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: studentRole.id,
            permissionId: p.id,
          },
        },
        update: {},
        create: {
          roleId: studentRole.id,
          permissionId: p.id,
        },
      })
    )
  );

  console.log('✅ Assigned permissions to roles');

  // ============================================
  // 4. CREATE USERS
  // ============================================
  console.log('Creating users...');

  const hashedPassword = await bcrypt.hash('Admin@123', 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@school.edu' },
    update: {},
    create: {
      email: 'superadmin@school.edu',
      username: 'superadmin',
      passwordHash: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      status: 'ACTIVE',
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@school.edu' },
    update: {},
    create: {
      email: 'admin@school.edu',
      username: 'admin',
      passwordHash: hashedPassword,
      firstName: 'John',
      lastName: 'Admin',
      status: 'ACTIVE',
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@school.edu' },
    update: {},
    create: {
      email: 'teacher@school.edu',
      username: 'teacher',
      passwordHash: hashedPassword,
      firstName: 'Jane',
      lastName: 'Teacher',
      status: 'ACTIVE',
    },
  });

  const student = await prisma.user.upsert({
    where: { email: 'student@school.edu' },
    update: {},
    create: {
      email: 'student@school.edu',
      username: 'student',
      passwordHash: hashedPassword,
      firstName: 'Bob',
      lastName: 'Student',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Created users');

  // ============================================
  // 5. ASSIGN ROLES TO USERS
  // ============================================
  console.log('Assigning roles to users...');

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: superAdmin.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: superAdmin.id,
      roleId: superAdminRole.id,
      assignedBy: 'SYSTEM',
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: admin.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      roleId: adminRole.id,
      assignedBy: superAdmin.id,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: teacher.id,
        roleId: teacherRole.id,
      },
    },
    update: {},
    create: {
      userId: teacher.id,
      roleId: teacherRole.id,
      assignedBy: admin.id,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: student.id,
        roleId: studentRole.id,
      },
    },
    update: {},
    create: {
      userId: student.id,
      roleId: studentRole.id,
      assignedBy: admin.id,
    },
  });

  console.log('✅ Assigned roles to users');

  // ============================================
  // 6. CREATE SAMPLE RULES
  // ============================================
  console.log('Creating sample rules...');

  // Rule 1: Block attendance submission after 24 hours
  await prisma.rule.upsert({
    where: { id: 'rule_attendance_deadline' },
    update: {},
    create: {
      id: 'rule_attendance_deadline',
      name: 'Attendance Submission Deadline',
      moduleName: 'attendance',
      description: 'Block attendance submission if more than 24 hours have passed',
      category: 'ATTENDANCE',
      conditionType: 'EXPRESSION',
      conditionPayload: {
        type: 'expression',
        expression: '(new Date() - new Date(data.date)) > (24 * 60 * 60 * 1000)',
      },
      actionType: 'BLOCK',
      actionPayload: {
        type: 'block',
        message: 'Cannot submit attendance after 24 hours. Please contact administrator.',
      },
      severityLevel: 'HIGH',
      priority: 10,
      isActive: true,
      createdBy: superAdmin.id,
    },
  });

  // Rule 2: Require approval for grade changes
  await prisma.rule.upsert({
    where: { id: 'rule_grade_change_approval' },
    update: {},
    create: {
      id: 'rule_grade_change_approval',
      name: 'Grade Change Requires Approval',
      moduleName: 'grades',
      description: 'Any grade modification requires department head approval',
      category: 'ACADEMIC',
      conditionType: 'EXPRESSION',
      conditionPayload: {
        type: 'expression',
        expression: 'data.isModification === true',
      },
      actionType: 'REQUIRE_APPROVAL',
      actionPayload: {
        type: 'require_approval',
        message: 'Grade changes require department head approval',
        approvers: [adminRole.id],
      },
      severityLevel: 'CRITICAL',
      priority: 5,
      isActive: true,
      createdBy: superAdmin.id,
    },
  });

  // Rule 3: Warn if grade is below 40%
  await prisma.rule.upsert({
    where: { id: 'rule_low_grade_warning' },
    update: {},
    create: {
      id: 'rule_low_grade_warning',
      name: 'Low Grade Warning',
      moduleName: 'grades',
      description: 'Warn when submitting a failing grade',
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
        message: 'Warning: This is a failing grade. Please verify before submission.',
      },
      severityLevel: 'MEDIUM',
      priority: 50,
      isActive: true,
      createdBy: superAdmin.id,
    },
  });

  // Rule 4: Block attendance submission outside school hours
  await prisma.rule.upsert({
    where: { id: 'rule_attendance_time_restriction' },
    update: {},
    create: {
      id: 'rule_attendance_time_restriction',
      name: 'Attendance Time Restriction',
      moduleName: 'attendance',
      description: 'Only allow attendance submission during school hours (8 AM - 6 PM)',
      category: 'ATTENDANCE',
      conditionType: 'TIME_BASED',
      conditionPayload: {
        type: 'time_based',
        timeRange: {
          start: '08:00',
          end: '18:00',
        },
      },
      actionType: 'ALLOW',
      actionPayload: {
        type: 'allow',
      },
      severityLevel: 'MEDIUM',
      priority: 20,
      isActive: false, // Disabled by default
      createdBy: superAdmin.id,
    },
  });

  // Rule 5: Require teacher role for grade submission
  await prisma.rule.upsert({
    where: { id: 'rule_grade_teacher_only' },
    update: {},
    create: {
      id: 'rule_grade_teacher_only',
      name: 'Teachers Only Can Submit Grades',
      moduleName: 'grades',
      description: 'Only users with TEACHER or ADMIN role can submit grades',
      category: 'ACADEMIC',
      conditionType: 'ROLE_BASED',
      conditionPayload: {
        type: 'role_based',
        roles: ['TEACHER', 'ADMIN', 'SUPER_ADMIN'],
      },
      actionType: 'ALLOW',
      actionPayload: {
        type: 'allow',
      },
      severityLevel: 'HIGH',
      priority: 1,
      isActive: true,
      createdBy: superAdmin.id,
    },
  });

  // Rule 6: Cap maximum grade at 100
  await prisma.rule.upsert({
    where: { id: 'rule_grade_max_cap' },
    update: {},
    create: {
      id: 'rule_grade_max_cap',
      name: 'Maximum Grade Cap',
      moduleName: 'grades',
      description: 'Automatically cap grades at 100 if they exceed maximum',
      category: 'ACADEMIC',
      conditionType: 'THRESHOLD',
      conditionPayload: {
        type: 'threshold',
        field: 'percentage',
        operator: 'gt',
        value: 100,
      },
      actionType: 'MODIFY',
      actionPayload: {
        type: 'modify',
        message: 'Grade automatically capped at 100%',
        modifications: {
          percentage: 100,
          score: 'maxScore', // Special value to set score = maxScore
        },
      },
      severityLevel: 'LOW',
      priority: 15,
      isActive: true,
      createdBy: superAdmin.id,
    },
  });

  // Rule 7: Composite rule - Block weekend attendance for students
  await prisma.rule.upsert({
    where: { id: 'rule_no_weekend_attendance' },
    update: {},
    create: {
      id: 'rule_no_weekend_attendance',
      name: 'No Weekend Attendance',
      moduleName: 'attendance',
      description: 'Block attendance submission on weekends for students',
      category: 'ATTENDANCE',
      conditionType: 'COMPOSITE',
      conditionPayload: {
        type: 'composite',
        logic: 'AND',
        conditions: [
          {
            type: 'expression',
            expression: '[0, 6].includes(new Date(data.date).getDay())', // Sunday or Saturday
          },
          {
            type: 'role_based',
            roles: ['STUDENT'],
          },
        ],
      },
      actionType: 'BLOCK',
      actionPayload: {
        type: 'block',
        message: 'Attendance cannot be submitted on weekends',
      },
      severityLevel: 'MEDIUM',
      priority: 25,
      isActive: false, // Disabled by default
      createdBy: superAdmin.id,
    },
  });

  console.log('✅ Created 7 sample rules');

  // ============================================
  // 7. CREATE RULE PERMISSIONS
  // ============================================
  console.log('Creating rule permissions...');

  const rulePermissions = [
    { resource: 'rule', action: 'create', description: 'Create new rules' },
    { resource: 'rule', action: 'read', description: 'View rules' },
    { resource: 'rule', action: 'update', description: 'Update rules' },
    { resource: 'rule', action: 'delete', description: 'Delete rules' },
    { resource: 'rule', action: 'evaluate', description: 'Evaluate rules' },
  ];

  const createdRulePermissions = await Promise.all(
    rulePermissions.map(p =>
      prisma.permission.upsert({
        where: { resource_action: { resource: p.resource, action: p.action } },
        update: {},
        create: p,
      })
    )
  );

  // Assign rule permissions to SUPER_ADMIN
  await Promise.all(
    createdRulePermissions.map(p =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdminRole.id,
            permissionId: p.id,
          },
        },
        update: {},
        create: {
          roleId: superAdminRole.id,
          permissionId: p.id,
        },
      })
    )
  );

  // Assign read permission to ADMIN
  const readRulePermission = createdRulePermissions.find(p => p.action === 'read');
  if (readRulePermission) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: readRulePermission.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: readRulePermission.id,
      },
    });
  }

  console.log('✅ Created rule permissions and assigned to roles');

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📋 Test Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Super Admin:');
  console.log('  Email: superadmin@school.edu');
  console.log('  Password: Admin@123');
  console.log('\nAdmin:');
  console.log('  Email: admin@school.edu');
  console.log('  Password: Admin@123');
  console.log('\nTeacher:');
  console.log('  Email: teacher@school.edu');
  console.log('  Password: Admin@123');
  console.log('\nStudent:');
  console.log('  Email: student@school.edu');
  console.log('  Password: Admin@123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

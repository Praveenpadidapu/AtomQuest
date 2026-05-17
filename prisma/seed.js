import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Clean DB
  await prisma.auditLog.deleteMany();
  await prisma.checkIn.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.goalSheet.deleteMany();
  await prisma.performanceCycle.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash('password123', 10);

  // 0. Create Performance Cycle
  await prisma.performanceCycle.create({
    data: {
      year: '2024',
      isActive: true,
      q1StartDate: new Date('2024-01-01'),
      q1EndDate: new Date('2024-03-31'),
      q1Status: 'CLOSED',
      q2StartDate: new Date('2024-04-01'),
      q2EndDate: new Date('2024-06-30'),
      q2Status: 'ACTIVE',
      q3StartDate: new Date('2024-07-01'),
      q3EndDate: new Date('2024-09-30'),
      q3Status: 'UPCOMING',
      q4StartDate: new Date('2024-10-01'),
      q4EndDate: new Date('2024-12-31'),
      q4Status: 'UPCOMING',
    }
  });

  // 1. Create Admin
  const admin = await prisma.user.create({
    data: {
      name: 'System Admin',
      email: 'admin@atomquest.com',
      role: 'ADMIN',
      password: hashedPassword,
    },
  });

  // 2. Create Manager
  const manager = await prisma.user.create({
    data: {
      name: 'Bob Manager',
      email: 'manager1@atomquest.com',
      role: 'MANAGER',
      password: hashedPassword,
    },
  });

  // 3. Create Employees
  const employee1 = await prisma.user.create({
    data: {
      name: 'Alice Employee',
      email: 'employee1@atomquest.com',
      role: 'EMPLOYEE',
      managerId: manager.id,
      password: hashedPassword,
    },
  });

  const employee2 = await prisma.user.create({
    data: {
      name: 'Charlie Employee',
      email: 'employee2@atomquest.com',
      role: 'EMPLOYEE',
      managerId: manager.id,
      password: hashedPassword,
    },
  });

  // Create Mock Goal Sheet for Alice (Approved & Locked)
  const aliceGoalSheet = await prisma.goalSheet.create({
    data: {
      userId: employee1.id,
      cycleYear: '2024',
      status: 'LOCKED',
      submittedAt: new Date(),
      goals: {
        create: [
          {
            title: 'Improve Frontend Performance',
            description: 'Reduce LCP to under 1.5s',
            thrustArea: 'Productivity',
            uomType: 'NUMERIC',
            target: '1.5',
            weightage: 50,
            status: 'ON_TRACK',
            actualAchievement: '1.8',
            progress: 80,
          },
          {
            title: 'Complete React Certification',
            description: 'Pass the advanced React certification exam',
            thrustArea: 'Learning & Development',
            uomType: 'TIMELINE',
            target: '2024-06-30',
            weightage: 50,
            status: 'COMPLETED',
            actualAchievement: '2024-05-15',
            progress: 100,
          }
        ]
      },
      checkIns: {
        create: [
          {
            quarter: 'Q1',
            employeeComment: 'Made good progress on the certification. Still working on frontend performance optimizations.',
            managerComment: 'Keep up the good work Alice, focus on the performance metrics for Q2.',
          }
        ]
      }
    }
  });

  console.log('Seed completed successfully with credential-based users.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

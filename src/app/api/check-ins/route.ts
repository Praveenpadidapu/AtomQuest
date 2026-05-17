import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { goalSheetId, employeeComment, managerComment, goals } = body;
    let { quarter } = body;

    if (!goalSheetId) {
      return NextResponse.json({ error: 'GoalSheet ID is required' }, { status: 400 });
    }

    // Dynamically look up active quarter if not passed
    if (!quarter) {
      const activeCycle = await prisma.performanceCycle.findFirst({
        where: { isActive: true }
      });
      quarter = 'Q1';
      if (activeCycle) {
        if (activeCycle.q2Status === 'ACTIVE') quarter = 'Q2';
        else if (activeCycle.q3Status === 'ACTIVE') quarter = 'Q3';
        else if (activeCycle.q4Status === 'ACTIVE') quarter = 'Q4';
      }
    }

    // Process check-in (upsert based on goalSheetId and quarter)
    const checkIn = await prisma.checkIn.findFirst({
      where: { goalSheetId, quarter }
    });

    if (checkIn) {
      await prisma.checkIn.update({
        where: { id: checkIn.id },
        data: {
          employeeComment: employeeComment !== undefined ? employeeComment : checkIn.employeeComment,
          managerComment: managerComment !== undefined ? managerComment : checkIn.managerComment,
        }
      });
    } else {
      await prisma.checkIn.create({
        data: {
          goalSheetId,
          quarter,
          employeeComment,
          managerComment,
        }
      });
    }

    // Update goals if provided
    if (goals && Array.isArray(goals)) {
      for (const goal of goals) {
        if (goal.id) {
          await prisma.goal.update({
            where: { id: goal.id },
            data: {
              actualAchievement: goal.actualAchievement,
              progress: goal.progress,
              status: goal.status,
            }
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save check-in:', error);
    return NextResponse.json({ error: 'Failed to save check-in' }, { status: 500 });
  }
}

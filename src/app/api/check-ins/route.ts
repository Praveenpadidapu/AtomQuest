import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { goalSheetId, quarter, employeeComment, managerComment, goals } = body;

    if (!goalSheetId) {
      return NextResponse.json({ error: 'GoalSheet ID is required' }, { status: 400 });
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

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, cycleYear, status, goals } = body;

    // Validation
    if (!userId || !goals || goals.length === 0) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const totalWeight = goals.reduce((acc: number, g: any) => acc + Number(g.weightage), 0);
    if (totalWeight !== 100) {
      return NextResponse.json({ error: 'Total weightage must equal 100' }, { status: 400 });
    }

    if (goals.length > 8) {
      return NextResponse.json({ error: 'Maximum 8 goals allowed' }, { status: 400 });
    }

    const goalSheet = await prisma.goalSheet.create({
      data: {
        userId,
        cycleYear,
        status,
        submittedAt: status === 'PENDING_APPROVAL' ? new Date() : null,
        goals: {
          create: goals.map((g: any) => ({
            title: g.title,
            description: g.description,
            thrustArea: g.thrustArea,
            uomType: g.uomType,
            target: g.target,
            weightage: Number(g.weightage),
            status: 'NOT_STARTED',
          }))
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        entity: 'GoalSheet',
        entityId: goalSheet.id,
        action: 'CREATED',
        changedBy: userId,
        details: `Goal sheet created with status ${status}`
      }
    });

    return NextResponse.json(goalSheet);
  } catch (error) {
    console.error('Failed to create goal sheet:', error);
    return NextResponse.json({ error: 'Failed to create goal sheet' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, userId, status, goals } = body;

    // Delete existing goals and recreate them (simpler for this demo)
    await prisma.goal.deleteMany({
      where: { goalSheetId: id }
    });

    const goalSheet = await prisma.goalSheet.update({
      where: { id },
      data: {
        status,
        submittedAt: status === 'PENDING_APPROVAL' ? new Date() : null,
        goals: {
          create: goals.map((g: any) => ({
            title: g.title,
            description: g.description,
            thrustArea: g.thrustArea,
            uomType: g.uomType,
            target: g.target,
            weightage: Number(g.weightage),
            status: 'NOT_STARTED',
          }))
        }
      }
    });

    await prisma.auditLog.create({
      data: {
        entity: 'GoalSheet',
        entityId: goalSheet.id,
        action: 'UPDATED',
        changedBy: userId,
        details: `Goal sheet updated to status ${status}`
      }
    });

    return NextResponse.json(goalSheet);
  } catch (error) {
    console.error('Failed to update goal sheet:', error);
    return NextResponse.json({ error: 'Failed to update goal sheet' }, { status: 500 });
  }
}

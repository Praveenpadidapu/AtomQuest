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
    const { goals, status } = body;
    const userId = (session.user as any).id;

    // Validation
    if (!goals || goals.length === 0) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const totalWeight = goals.reduce((acc: number, g: any) => acc + Number(g.weightage), 0);
    if (totalWeight !== 100) {
      return NextResponse.json({ error: 'Total weightage must equal 100' }, { status: 400 });
    }

    if (goals.length > 8) {
      return NextResponse.json({ error: 'Maximum 8 goals allowed' }, { status: 400 });
    }

    // Get active performance cycle dynamically
    const activeCycle = await prisma.performanceCycle.findFirst({
      where: { isActive: true }
    });
    const cycleYear = activeCycle?.year || '2024';

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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, goals } = body;
    const userId = (session.user as any).id;

    // Delete existing goals and recreate them
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

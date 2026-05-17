import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const managerId = searchParams.get('managerId');

    if (!managerId) {
      return NextResponse.json({ error: 'Manager ID is required' }, { status: 400 });
    }

    // Get all goal sheets for users managed by this manager
    const goalSheets = await prisma.goalSheet.findMany({
      where: {
        user: { managerId },
        status: { in: ['PENDING_APPROVAL', 'APPROVED', 'LOCKED'] }
      },
      include: {
        user: { select: { name: true, email: true } },
        goals: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(goalSheets);
  } catch (error) {
    console.error('Failed to fetch approvals:', error);
    return NextResponse.json({ error: 'Failed to fetch approvals' }, { status: 500 });
  }
}

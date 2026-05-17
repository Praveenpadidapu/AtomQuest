import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    // Dynamically query active cycle
    const activeCycle = await prisma.performanceCycle.findFirst({
      where: { isActive: true }
    });
    const cycleYear = activeCycle?.year || '2024';

    const goalSheet = await prisma.goalSheet.findFirst({
      where: { userId, cycleYear },
      include: {
        goals: true,
        checkIns: true,
      }
    });

    return NextResponse.json(goalSheet);
  } catch (error) {
    console.error('Failed to fetch goal sheet:', error);
    return NextResponse.json({ error: 'Failed to fetch goal sheet' }, { status: 500 });
  }
}

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

    const managerId = (session.user as any).id;

    const goalSheets = await prisma.goalSheet.findMany({
      where: {
        user: {
          managerId: managerId
        }
      },
      include: {
        user: true,
        goals: true,
        checkIns: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(goalSheets);
  } catch (error) {
    console.error('Failed to fetch approvals:', error);
    return NextResponse.json({ error: 'Failed to fetch approvals' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const goalSheet = await prisma.goalSheet.findFirst({
      where: { userId, cycleYear: '2024' },
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

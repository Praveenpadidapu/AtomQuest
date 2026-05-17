import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const goalSheet = await prisma.goalSheet.findUnique({
      where: { id },
      include: {
        user: true,
        goals: true,
        checkIns: true,
      }
    });

    if (!goalSheet) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(goalSheet);
  } catch (error) {
    console.error('Failed to fetch goal sheet:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

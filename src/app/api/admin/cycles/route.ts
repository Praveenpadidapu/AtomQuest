import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if ((session?.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cycles = await prisma.performanceCycle.findMany({
      orderBy: { year: 'desc' }
    });

    return NextResponse.json(cycles);
  } catch (error) {
    console.error('Failed to fetch cycles:', error);
    return NextResponse.json({ error: 'Failed to fetch cycles' }, { status: 500 });
  }
}

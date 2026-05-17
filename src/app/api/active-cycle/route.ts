import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const activeCycle = await prisma.performanceCycle.findFirst({
      where: { isActive: true }
    });

    if (!activeCycle) {
      return NextResponse.json({
        year: '2024',
        activeQuarter: 'Q2',
        cycle: null
      });
    }

    let activeQuarter = 'Q1';
    if (activeCycle.q2Status === 'ACTIVE') activeQuarter = 'Q2';
    else if (activeCycle.q3Status === 'ACTIVE') activeQuarter = 'Q3';
    else if (activeCycle.q4Status === 'ACTIVE') activeQuarter = 'Q4';

    return NextResponse.json({
      year: activeCycle.year,
      activeQuarter,
      cycle: activeCycle
    });
  } catch (error) {
    console.error('Failed to get active cycle:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import Papa from 'papaparse';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const goals = await prisma.goal.findMany({
      include: {
        goalSheet: {
          include: {
            user: true,
            checkIns: true,
          }
        }
      }
    });

    const exportData = goals.map(g => ({
      'Employee Name': g.goalSheet.user.name,
      'Email': g.goalSheet.user.email,
      'Goal Cycle': g.goalSheet.cycleYear,
      'Goal Title': g.title,
      'Thrust Area': g.thrustArea,
      'UoM Type': g.uomType,
      'Target': g.target,
      'Actual Achievement': g.actualAchievement || 'N/A',
      'Weightage (%)': g.weightage,
      'Progress (%)': g.progress || 0,
      'Status': g.status,
      'Last Checked In': g.goalSheet.checkIns.length > 0 ? g.goalSheet.checkIns[0].quarter : 'N/A'
    }));

    const csv = Papa.unparse(exportData);

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="goal_achievements.csv"'
      }
    });
  } catch (error) {
    console.error('Failed to generate report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

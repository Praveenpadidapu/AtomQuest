'use client';

import { GoalSheetForm } from '@/components/goals/GoalSheetForm';
import { Target } from 'lucide-react';

export default function NewGoalSheetPage() {
  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="flex-gap mb-8">
        <Target size={32} color="var(--primary-color)" />
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Create Goal Sheet</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>Draft your goals for the 2024 cycle.</p>
        </div>
      </div>
      
      <GoalSheetForm />
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { CheckSquare, Save, Target } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { calculateProgress } from '@/utils/progress';
import { use } from 'react';

export default function EmployeeCheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [goalSheet, setGoalSheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { register, control, handleSubmit, reset, watch } = useForm<{ goals: any[], employeeComment: string }>({
    defaultValues: { goals: [], employeeComment: '' }
  });

  const { fields } = useFieldArray({ name: 'goals', control });
  const watchGoals = watch('goals');

  useEffect(() => {
    fetch(`/api/goalsheets/${resolvedParams.id}`)
      .then(res => res.json())
      .then(data => {
        setGoalSheet(data);
        reset({ 
          goals: data.goals.map((g: any) => ({
            ...g,
            actualAchievement: g.actualAchievement || '',
            status: g.status || 'NOT_STARTED'
          })),
          employeeComment: data.checkIns?.[0]?.employeeComment || ''
        });
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [resolvedParams.id, reset]);

  if (loading) return <div className="text-secondary">Loading check-in...</div>;
  if (!goalSheet) return <div className="text-danger">Goal sheet not found.</div>;
  if (goalSheet.userId !== user?.id && user?.role !== 'MANAGER') {
    return <div className="text-danger">Unauthorized</div>;
  }

  const isLocked = goalSheet.status !== 'LOCKED';
  
  if (isLocked) {
    return <div className="text-danger">Goal sheet must be approved and locked before check-ins can occur.</div>;
  }

  const onSubmit = async (data: any) => {
    setSubmitting(true);
    try {
      const payload = {
        goalSheetId: resolvedParams.id,
        quarter: 'Q2', // Hardcoded for demo purposes
        employeeComment: data.employeeComment,
        goals: data.goals.map((g: any) => ({
          id: g.id,
          actualAchievement: g.actualAchievement,
          status: g.status,
          progress: calculateProgress(g.uomType, g.target, g.actualAchievement)
        }))
      };

      const res = await fetch('/api/check-ins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert('Check-in saved successfully!');
        router.push('/dashboard');
      } else {
        alert('Failed to save check-in.');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred.');
    }
    setSubmitting(false);
  };

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <div className="flex-gap mb-8">
        <CheckSquare size={32} color="var(--accent-color)" />
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Quarterly Check-in</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>Update your progress for Q2 2024</p>
        </div>
      </div>

      <form className="glass-card" onSubmit={handleSubmit(onSubmit)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {fields.map((field: any, index: number) => {
            const currentActual = watchGoals[index]?.actualAchievement;
            const progress = calculateProgress(field.uomType, field.target, currentActual);
            
            return (
              <div key={field.id} className="glass-panel" style={{ padding: '1.5rem' }}>
                <div className="flex-between mb-4">
                  <h3 className="font-semibold text-lg">{field.title}</h3>
                  <div className="flex-gap">
                    <span className="badge badge-neutral">Target: {field.target} ({field.uomType})</span>
                    <span className="badge badge-primary">Progress: {progress.toFixed(1)}%</span>
                  </div>
                </div>
                
                <div className="grid-cols-2 mb-4">
                  <div>
                    <label className="label">Actual Achievement</label>
                    <input 
                      {...register(`goals.${index}.actualAchievement`)} 
                      className="input-field" 
                      placeholder="Enter actual value"
                      type={field.uomType === 'TIMELINE' ? 'date' : 'text'}
                    />
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select {...register(`goals.${index}.status`)} className="input-field">
                      <option value="NOT_STARTED">Not Started</option>
                      <option value="ON_TRACK">On Track</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>
                </div>
                
                {/* Visual Progress Bar */}
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary-color)', transition: 'width 0.3s ease' }}></div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
          <h3 className="text-lg font-semibold mb-4">Check-in Summary</h3>
          <label className="label">Employee Comments</label>
          <textarea 
            {...register('employeeComment')} 
            className="input-field" 
            rows={4} 
            placeholder="Summarize your progress, highlight any blockers..." 
          />
        </div>

        <div className="flex-between mt-8 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
          <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            <Save size={18} /> Save Check-in
          </button>
        </div>
      </form>
    </div>
  );
}

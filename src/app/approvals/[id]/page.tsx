'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { FileText, Check, X, Edit2 } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { use } from 'react';

export default function ApprovalReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [goalSheet, setGoalSheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { register, control, handleSubmit, reset, watch, formState: { errors } } = useForm<{ goals: any[] }>({
    defaultValues: { goals: [] }
  });

  const { fields } = useFieldArray({ name: 'goals', control });

  useEffect(() => {
    fetch(`/api/goalsheets/${resolvedParams.id}`)
      .then(res => res.json())
      .then(data => {
        setGoalSheet(data);
        reset({ goals: data.goals });
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [resolvedParams.id, reset]);

  if (loading) return <div className="text-secondary">Loading review...</div>;
  if (!goalSheet) return <div className="text-danger">Goal sheet not found.</div>;

  const watchGoals = watch('goals');
  const currentTotalWeight = watchGoals.reduce((acc: number, goal: any) => acc + (Number(goal.weightage) || 0), 0);
  const isValid = currentTotalWeight === 100;

  const handleAction = async (data: any, action: 'APPROVED' | 'REJECTED') => {
    if (action === 'APPROVED' && !isValid) {
      alert('Total weightage must be exactly 100% to approve.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        id: goalSheet.id,
        userId: user?.id,
        status: action === 'APPROVED' ? 'LOCKED' : 'DRAFT',
        goals: data.goals
      };

      const res = await fetch('/api/goalsheets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push('/approvals');
      } else {
        alert('Failed to process action.');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred.');
    }
    setSubmitting(false);
  };

  const isPending = goalSheet.status === 'PENDING_APPROVAL';

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <div className="flex-between mb-8">
        <div className="flex-gap">
          <FileText size={32} color="var(--primary-color)" />
          <div>
            <h1 className="page-title" style={{ marginBottom: 0 }}>Review Goals</h1>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>{goalSheet.user.name}'s Goal Sheet for 2024</p>
          </div>
        </div>
        <div className={`badge ${isPending ? 'badge-warning' : 'badge-success'}`}>
          {goalSheet.status}
        </div>
      </div>

      <form className="glass-card">
        <div className="flex-between mb-6">
          <h2 className="text-xl font-semibold">Goal Details</h2>
          <span style={{ color: isValid ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: 'bold' }}>
            Total Weightage: {currentTotalWeight}% / 100%
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {fields.map((field: any, index: number) => (
            <div key={field.id} className="glass-panel" style={{ padding: '1.5rem' }}>
              <div className="flex-between mb-4">
                <h3 className="font-semibold text-lg">{field.title}</h3>
                <span className="badge badge-neutral">{field.uomType}</span>
              </div>
              
              <p className="text-secondary mb-4">{field.description}</p>
              
              <div className="grid-cols-2">
                <div>
                  <label className="label">Target</label>
                  <input 
                    {...register(`goals.${index}.target`)} 
                    className="input-field" 
                    disabled={!isPending}
                  />
                </div>
                <div>
                  <label className="label">Weightage (%)</label>
                  <input 
                    type="number" 
                    {...register(`goals.${index}.weightage`)} 
                    className="input-field" 
                    disabled={!isPending}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {isPending && (
          <div className="flex-between mt-8 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => router.back()}
            >
              Cancel
            </button>
            <div className="flex-gap">
              <button 
                type="button" 
                className="btn btn-danger"
                onClick={handleSubmit((data) => handleAction(data, 'REJECTED'))}
                disabled={submitting}
              >
                <X size={18} /> Return for Rework
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleSubmit((data) => handleAction(data, 'APPROVED'))}
                disabled={submitting || !isValid}
              >
                <Check size={18} /> Approve & Lock
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Trash2, Save, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useState } from 'react';

const goalSchema = z.object({
  title: z.string().min(3, 'Title is required'),
  description: z.string().min(5, 'Description is required'),
  thrustArea: z.string().min(1, 'Thrust Area is required'),
  uomType: z.enum(['NUMERIC', 'PERCENTAGE', 'TIMELINE', 'ZERO_BASED']),
  target: z.string().min(1, 'Target is required'),
  weightage: z.coerce.number().min(10, 'Minimum 10% weightage per goal'),
});

const goalSheetSchema = z.object({
  goals: z.array(goalSchema).max(8, 'Maximum 8 goals allowed').min(1, 'At least one goal is required'),
}).refine((data) => {
  const totalWeight = data.goals.reduce((acc, goal) => acc + (goal.weightage || 0), 0);
  return totalWeight === 100;
}, {
  message: 'Total weightage must exactly equal 100%',
  path: ['root'],
});

type GoalSheetFormValues = z.infer<typeof goalSheetSchema>;

export function GoalSheetForm({ initialData = null }: { initialData?: any }) {
  const router = useRouter();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<GoalSheetFormValues>({
    resolver: zodResolver(goalSheetSchema) as any,
    defaultValues: initialData || {
      goals: [{ title: '', description: '', thrustArea: '', uomType: 'NUMERIC', target: '', weightage: 10 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    name: 'goals',
    control,
  });

  const watchGoals = watch('goals');
  const currentTotalWeight = watchGoals.reduce((acc, goal) => acc + (Number(goal.weightage) || 0), 0);

  const onSubmit = async (data: GoalSheetFormValues, status: 'DRAFT' | 'PENDING_APPROVAL') => {
    setSubmitting(true);
    try {
      const payload = {
        ...data,
        userId: user?.id,
        status,
        cycleYear: '2024'
      };

      const res = await fetch('/api/goalsheets', {
        method: initialData ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initialData ? { ...payload, id: initialData.id } : payload),
      });

      if (res.ok) {
        router.push('/dashboard');
      } else {
        alert('Failed to save goal sheet.');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred.');
    }
    setSubmitting(false);
  };

  return (
    <form className="glass-card">
      {errors.root && (
        <div className="badge badge-danger mb-4" style={{ display: 'block', padding: '1rem', borderRadius: '8px' }}>
          {errors.root.message} (Current: {currentTotalWeight}%)
        </div>
      )}
      
      <div className="flex-between mb-4">
        <div>
          <span style={{ color: currentTotalWeight === 100 ? 'var(--success-color)' : 'var(--warning-color)', fontWeight: 'bold' }}>
            Total Weightage: {currentTotalWeight}% / 100%
          </span>
        </div>
        <div>
          <span className="text-secondary">Goals: {fields.length} / 8</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {fields.map((field, index) => (
          <div key={field.id} className="glass-panel" style={{ padding: '1.5rem', position: 'relative' }}>
            <div className="flex-between mb-4">
              <h3 style={{ fontSize: '1.1rem' }}>Goal #{index + 1}</h3>
              {fields.length > 1 && (
                <button type="button" onClick={() => remove(index)} className="btn btn-danger" style={{ padding: '0.5rem' }}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="grid-cols-2">
              <div>
                <label className="label">Title</label>
                <input {...register(`goals.${index}.title`)} className="input-field" placeholder="e.g., Increase Sales" />
                {errors.goals?.[index]?.title && <span className="text-danger" style={{ color: 'var(--danger-color)', fontSize: '0.8rem' }}>{errors.goals[index]?.title?.message}</span>}
              </div>
              <div>
                <label className="label">Thrust Area</label>
                <input {...register(`goals.${index}.thrustArea`)} className="input-field" placeholder="e.g., Growth" />
                {errors.goals?.[index]?.thrustArea && <span className="text-danger" style={{ color: 'var(--danger-color)', fontSize: '0.8rem' }}>{errors.goals[index]?.thrustArea?.message}</span>}
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label className="label">Description</label>
                <textarea {...register(`goals.${index}.description`)} className="input-field" rows={2} placeholder="Goal details..." />
                {errors.goals?.[index]?.description && <span className="text-danger" style={{ color: 'var(--danger-color)', fontSize: '0.8rem' }}>{errors.goals[index]?.description?.message}</span>}
              </div>
              
              <div>
                <label className="label">UoM Type</label>
                <select {...register(`goals.${index}.uomType`)} className="input-field">
                  <option value="NUMERIC">Numeric</option>
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="TIMELINE">Timeline (Date)</option>
                  <option value="ZERO_BASED">Zero-Based</option>
                </select>
              </div>
              <div>
                <label className="label">Target</label>
                <input {...register(`goals.${index}.target`)} className="input-field" placeholder="e.g., 1000000" />
                {errors.goals?.[index]?.target && <span className="text-danger" style={{ color: 'var(--danger-color)', fontSize: '0.8rem' }}>{errors.goals[index]?.target?.message}</span>}
              </div>
              
              <div>
                <label className="label">Weightage (%)</label>
                <input type="number" {...register(`goals.${index}.weightage`)} className="input-field" min="10" max="100" />
                {errors.goals?.[index]?.weightage && <span className="text-danger" style={{ color: 'var(--danger-color)', fontSize: '0.8rem' }}>{errors.goals[index]?.weightage?.message}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-center mt-6">
        <button 
          type="button" 
          onClick={() => append({ title: '', description: '', thrustArea: '', uomType: 'NUMERIC', target: '', weightage: 10 })}
          className="btn btn-secondary"
          disabled={fields.length >= 8}
        >
          <Plus size={18} /> Add Goal
        </button>
      </div>

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
            className="btn btn-secondary"
            onClick={handleSubmit((data) => onSubmit(data, 'DRAFT'))}
            disabled={submitting}
          >
            <Save size={18} /> Save as Draft
          </button>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={handleSubmit((data) => onSubmit(data, 'PENDING_APPROVAL'))}
            disabled={submitting}
          >
            <Send size={18} /> Submit for Approval
          </button>
        </div>
      </div>
    </form>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { CheckSquare } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CheckInsListPage() {
  const { user, isLoading } = useAuth();
  const [goalSheet, setGoalSheet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.id) {
      fetch(`/api/goalsheets/me?userId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          setGoalSheet(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [user]);

  if (loading || isLoading) {
    return <div className="text-secondary p-8">Loading check-ins...</div>;
  }

  return (
    <div className="animate-fade-in max-w-5xl mx-auto p-4">
      <div className="flex-gap mb-8">
        <CheckSquare size={32} color="var(--accent-color)" />
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Quarterly Check-ins</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>Track and update your goal progress.</p>
        </div>
      </div>

      {(!goalSheet || goalSheet.error) ? (
        <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center' }}>
          <CheckSquare size={64} className="mx-auto mb-4 text-secondary" />
          <h2 className="text-xl font-semibold mb-2">No Goal Sheet Available</h2>
          <p className="text-secondary mb-6">You need an approved goal sheet before you can perform check-ins.</p>
          <Link href="/goals" className="btn btn-primary">
            View My Goals
          </Link>
        </div>
      ) : (
        <div className="glass-card">
          <div className="flex-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">2024 Check-in Cycles</h2>
              <p className="text-secondary text-sm mt-1">Goal Sheet Status: {goalSheet.status}</p>
            </div>
          </div>

          <div className="grid-cols-2">
            {['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, index) => {
              const checkInRecord = goalSheet.checkIns?.find((c: any) => c.quarter === quarter);
              const isQ2 = quarter === 'Q2'; // Mocking Q2 as the current active quarter
              
              return (
                <div key={quarter} className="glass-panel p-6" style={{ opacity: index > 1 ? 0.5 : 1 }}>
                  <div className="flex-between mb-4">
                    <h3 className="font-semibold text-lg">{quarter} Check-in</h3>
                    {checkInRecord ? (
                      <span className="badge badge-success">Completed</span>
                    ) : isQ2 ? (
                      <span className="badge badge-primary">Active</span>
                    ) : (
                      <span className="badge badge-neutral">Upcoming</span>
                    )}
                  </div>
                  
                  {checkInRecord ? (
                    <div>
                      <p className="text-sm text-secondary mb-4">Completed. Progress has been recorded.</p>
                      <Link href={`/check-ins/${goalSheet.id}`} className="btn btn-secondary w-full text-center">
                        View / Edit Check-in
                      </Link>
                    </div>
                  ) : isQ2 ? (
                    <div>
                      <p className="text-sm text-secondary mb-4">It is time to log your progress for {quarter}.</p>
                      {goalSheet.status === 'LOCKED' || goalSheet.status === 'APPROVED' ? (
                        <Link href={`/check-ins/${goalSheet.id}`} className="btn btn-primary w-full text-center">
                          Start Check-in
                        </Link>
                      ) : (
                        <button className="btn btn-secondary w-full" disabled title="Goal sheet must be approved first.">
                          Awaiting Approval
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-secondary mb-4">This check-in window is not yet open.</p>
                      <button className="btn btn-secondary w-full" disabled>
                        Not Available
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

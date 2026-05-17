'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Shield, Key, Mail, Loader2 } from 'lucide-react';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err) {
      setError('An error occurred during login');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="flex-center min-h-screen" style={{ background: 'var(--bg-gradient)' }}>
      <div className="glass-card w-full max-w-md animate-fade-in" style={{ padding: '3rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 60%)', zIndex: 0, pointerEvents: 'none' }}></div>
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="flex-center flex-col mb-8 text-center">
            <div className="mb-4 flex-center" style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', color: 'var(--primary-color)' }}>
              <Shield size={32} />
            </div>
            <h1 className="text-2xl font-bold mb-2">AtomQuest Portal</h1>
            <p className="text-secondary text-sm">Sign in to manage your goals and check-ins</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="badge badge-danger text-center w-full block py-2 rounded-lg">
                {error}
              </div>
            )}
            
            <div>
              <label className="label text-sm text-secondary">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field w-full pl-10" 
                  placeholder="Enter your email" 
                  required
                />
              </div>
            </div>

            <div>
              <label className="label text-sm text-secondary">Password</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field w-full pl-10" 
                  placeholder="Enter your password" 
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full mt-4 flex-center" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Sign In'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { EmployeeDetail } from './components/EmployeeDetail';
import { IntuneGuide } from './components/IntuneGuide';
import { PolicyManager } from './components/PolicyManager';
import { Reporting } from './components/Reporting';
import { UserManagement } from './components/UserManagement';
import { SecurityLogs } from './components/SecurityLogs';
import { Layout } from './components/Layout';
import { LogIn, Activity, Mail, Lock, User as UserIcon } from 'lucide-react';
import { User } from './types';

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'employee' | 'guide' | 'policy' | 'reporting' | 'users' | 'security'>('dashboard');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  
  // Auth state
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const res = await fetch('/api/users/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const profile = await res.json();
            setUser({ uid: profile.uid, email: profile.email });
            setUserProfile(profile);
          } else {
            localStorage.removeItem('auth_token');
          }
        } catch (error) {
          console.error('Auth check failed', error);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data.token) {
        localStorage.setItem('auth_token', event.data.token);
        window.location.reload();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmitting(true);

    try {
      const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
      const body = isRegistering ? { email, password, name } : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('auth_token', data.token);
      window.location.reload();
    } catch (error: any) {
      setAuthError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const signInGoogle = async () => {
    try {
      const res = await fetch('/api/auth/google/url');
      const { url } = await res.json();
      window.open(url, 'oauth_popup', 'width=600,height=700');
    } catch (e) {
      console.error(e);
    }
  };

  const signInMicrosoft = async () => {
    try {
      const res = await fetch('/api/auth/microsoft/url');
      const { url } = await res.json();
      window.open(url, 'oauth_popup', 'width=600,height=700');
    } catch (e) {
      console.error(e);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setUserProfile(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <Activity className="w-12 h-12 text-[#141414] mb-4" />
          <p className="font-mono text-xs uppercase tracking-widest text-[#141414]/50">Initializing WorkPulse...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
          <div className="flex items-center gap-3 mb-8">
            <Activity className="w-8 h-8 text-[#141414]" />
            <h1 className="text-2xl font-bold tracking-tighter uppercase italic font-serif">WorkPulse</h1>
          </div>
          <p className="text-sm text-[#141414]/70 mb-8 leading-relaxed">
            Enterprise-grade monitoring dashboard for Intune-deployed Windows agents. 
            Securely track employee productivity and system activity.
          </p>

          {authError && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 text-sm">
              {authError}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4 mb-8">
            {isRegistering && (
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[#141414]/70 mb-2">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#141414]/50" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-[#141414]/20 focus:border-[#141414] outline-none text-sm"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#141414]/70 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#141414]/50" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-[#141414]/20 focus:border-[#141414] outline-none text-sm"
                  placeholder="admin@enterprise.local"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-[#141414]/70 mb-2">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#141414]/50" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-[#141414]/20 focus:border-[#141414] outline-none text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#141414] text-white py-3 px-4 hover:bg-[#141414]/90 transition-colors font-mono text-sm uppercase tracking-wider disabled:opacity-50"
            >
              {isSubmitting ? 'Processing...' : (isRegistering ? 'Create Account' : 'Sign In')}
            </button>
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setAuthError('');
                }}
                className="text-xs text-[#141414]/70 hover:text-[#141414] underline"
              >
                {isRegistering ? 'Already have an account? Sign in' : 'Need an account? Register'}
              </button>
            </div>
          </form>

          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#141414]/20"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest font-mono">
              <span className="bg-white px-2 text-[#141414]/50">Or continue with</span>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={signInGoogle}
              className="w-full flex items-center justify-center gap-2 bg-white text-[#141414] border border-[#141414] py-3 px-4 hover:bg-gray-50 transition-colors font-mono text-sm uppercase tracking-wider"
            >
              <LogIn className="w-4 h-4" />
              Google
            </button>
            <button
              onClick={signInMicrosoft}
              className="w-full flex items-center justify-center gap-2 bg-white text-[#141414] border border-[#141414] py-3 px-4 hover:bg-gray-50 transition-colors font-mono text-sm uppercase tracking-wider"
            >
              <LogIn className="w-4 h-4" />
              Microsoft
            </button>
          </div>
          <div className="mt-8 pt-6 border-t border-[#141414]/10 flex items-center justify-between text-[10px] font-mono text-[#141414]/40 uppercase tracking-widest">
            <span>v1.0.4-stable</span>
            <span>Secure Access Only</span>
          </div>
        </div>
      </div>
    );
  }

  const navigateToEmployee = (id: string) => {
    setSelectedEmployeeId(id);
    setView('employee');
  };

  return (
    <Layout 
      user={user} 
      userProfile={userProfile}
      onLogout={logout} 
      currentView={view} 
      onNavigate={setView}
    >
      {view === 'dashboard' && <Dashboard onSelectEmployee={navigateToEmployee} />}
      {view === 'employee' && selectedEmployeeId && (
        <EmployeeDetail employeeId={selectedEmployeeId} onBack={() => setView('dashboard')} />
      )}
      {view === 'guide' && <IntuneGuide />}
      {view === 'policy' && <PolicyManager />}
      {view === 'reporting' && <Reporting />}
      {view === 'users' && <UserManagement />}
      {view === 'security' && <SecurityLogs />}
    </Layout>
  );
}

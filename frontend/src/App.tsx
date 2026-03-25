import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { EmployeeDetail } from './components/EmployeeDetail';
import { IntuneGuide } from './components/IntuneGuide';
import { PolicyManager } from './components/PolicyManager';
import { Reporting } from './components/Reporting';
import { UserManagement } from './components/UserManagement';
import { SecurityLogs } from './components/SecurityLogs';
import { Layout } from './components/Layout';
import { LogIn, Activity } from 'lucide-react';
import { User } from './types';

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'employee' | 'guide' | 'policy' | 'reporting' | 'users' | 'security'>('dashboard');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

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
          <div className="space-y-4">
            <button
              onClick={signInGoogle}
              className="w-full flex items-center justify-center gap-2 bg-[#141414] text-white py-3 px-4 hover:bg-[#141414]/90 transition-colors font-mono text-sm uppercase tracking-wider"
            >
              <LogIn className="w-4 h-4" />
              Authenticate with Google
            </button>
            <button
              onClick={signInMicrosoft}
              className="w-full flex items-center justify-center gap-2 bg-white text-[#141414] border border-[#141414] py-3 px-4 hover:bg-gray-50 transition-colors font-mono text-sm uppercase tracking-wider"
            >
              <LogIn className="w-4 h-4" />
              Authenticate with Microsoft
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

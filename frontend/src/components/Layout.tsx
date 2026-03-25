import React from 'react';
import { User } from '../types';
import { Activity, Users, Shield, Terminal, LogOut, LayoutDashboard, Settings, BarChart3 } from 'lucide-react';
import { cn } from '../lib/utils';

interface LayoutProps {
  user: any;
  userProfile: User | null;
  onLogout: () => void;
  currentView: 'dashboard' | 'employee' | 'guide' | 'policy' | 'reporting' | 'users' | 'security';
  onNavigate: (view: 'dashboard' | 'employee' | 'guide' | 'policy' | 'reporting' | 'users' | 'security') => void;
  children: React.ReactNode;
}

export function Layout({ user, userProfile, onLogout, currentView, onNavigate, children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#E4E3E0] flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#141414] flex flex-col bg-white">
        <div className="p-6 border-bottom border-[#141414] flex items-center gap-3">
          <Activity className="w-6 h-6 text-[#141414]" />
          <h1 className="text-xl font-bold tracking-tighter uppercase italic font-serif">WorkPulse</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <NavItem 
            icon={<LayoutDashboard className="w-4 h-4" />} 
            label="Dashboard" 
            active={currentView === 'dashboard' || currentView === 'employee'} 
            onClick={() => onNavigate('dashboard')} 
          />
          <NavItem 
            icon={<Terminal className="w-4 h-4" />} 
            label="Agent Deployment" 
            active={currentView === 'guide'} 
            onClick={() => onNavigate('guide')} 
          />
          <NavItem 
            icon={<Settings className="w-4 h-4" />} 
            label="Policy Management" 
            active={currentView === 'policy'} 
            onClick={() => onNavigate('policy')} 
          />
          <NavItem 
            icon={<BarChart3 className="w-4 h-4" />} 
            label="Productivity Reports" 
            active={currentView === 'reporting'} 
            onClick={() => onNavigate('reporting')} 
          />
          <NavItem 
            icon={<Shield className="w-4 h-4" />} 
            label="Security Logs" 
            active={currentView === 'security'} 
            onClick={() => onNavigate('security')} 
          />
          {userProfile?.role === 'admin' && (
            <NavItem 
              icon={<Users className="w-4 h-4" />} 
              label="User Management" 
              active={currentView === 'users'} 
              onClick={() => onNavigate('users')} 
            />
          )}
        </nav>

        <div className="p-4 border-t border-[#141414]">
          <div className="flex items-center gap-3 p-3 bg-[#141414]/5 rounded border border-[#141414]/10 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#141414] flex items-center justify-center text-white text-xs font-mono">
              {user.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono text-[#141414]/50 uppercase truncate">{user.email}</p>
              <p className="text-xs font-bold truncate uppercase tracking-tighter">
                {userProfile?.role || 'User'}
              </p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wider text-[#141414]/60 hover:text-[#141414] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            System Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 border-b border-[#141414] bg-white flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono text-[#141414]/40 uppercase tracking-[0.2em]">System Status:</span>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-mono text-[#141414] uppercase">Operational</span>
            </div>
          </div>
          <div className="text-[10px] font-mono text-[#141414]/40 uppercase tracking-widest">
            {new Date().toLocaleDateString()} // {new Date().toLocaleTimeString()}
          </div>
        </header>
        
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-sm font-mono uppercase tracking-wider transition-all border border-transparent",
        active 
          ? "bg-[#141414] text-white shadow-[4px_4px_0px_0px_rgba(20,20,20,0.2)]" 
          : "text-[#141414]/60 hover:bg-[#141414]/5 hover:text-[#141414]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

import React, { useState, useEffect } from 'react';
import { Employee, ActivityLog } from '../types';
import { Users, Clock, Monitor, AlertCircle, Search, Filter, ChevronRight, Activity, Terminal } from 'lucide-react';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fetchApi } from '../lib/api';

interface DashboardProps {
  onSelectEmployee: (id: string) => void;
}

export function Dashboard({ onSelectEmployee }: DashboardProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [recentLogs, setRecentLogs] = useState<ActivityLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [empData, logData] = await Promise.all([
          fetchApi('/employees'),
          fetchApi('/activity_logs')
        ]);
        setEmployees(empData);
        setRecentLogs(logData);
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      }
    };
    
    loadData();
    const interval = setInterval(loadData, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: employees.length,
    active: employees.filter(e => e.status === 'active').length,
    idle: employees.filter(e => e.status === 'idle').length,
    offline: employees.filter(e => e.status === 'offline').length,
  };

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Monitored" value={stats.total} icon={<Users className="w-5 h-5" />} />
        <StatCard label="Active Now" value={stats.active} icon={<Monitor className="w-5 h-5 text-green-600" />} />
        <StatCard label="Idle State" value={stats.idle} icon={<Clock className="w-5 h-5 text-amber-600" />} />
        <StatCard label="System Offline" value={stats.offline} icon={<AlertCircle className="w-5 h-5 text-red-600" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Employee List */}
        <div className="lg:col-span-2 bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <div className="p-6 border-b border-[#141414] flex items-center justify-between">
            <h2 className="text-sm font-mono uppercase tracking-widest font-bold">Employee Directory</h2>
            <div className="flex items-center gap-4">
              <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#141414]/40" />
              <input 
                type="text" 
                placeholder="Search ID/Name..." 
                className="pl-10 pr-4 py-2 bg-[#141414]/5 border border-[#141414]/10 font-mono text-xs focus:outline-none focus:border-[#141414]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#141414]/5 border-b border-[#141414]">
                  <th className="p-4 text-[10px] font-mono uppercase tracking-widest text-[#141414]/50">Status</th>
                  <th className="p-4 text-[10px] font-mono uppercase tracking-widest text-[#141414]/50">Employee</th>
                  <th className="p-4 text-[10px] font-mono uppercase tracking-widest text-[#141414]/50">Department</th>
                  <th className="p-4 text-[10px] font-mono uppercase tracking-widest text-[#141414]/50">Current App</th>
                  <th className="p-4 text-[10px] font-mono uppercase tracking-widest text-[#141414]/50">Last Seen</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length > 0 ? filteredEmployees.map((emp) => (
                  <tr 
                    key={emp.id} 
                    className="border-b border-[#141414]/10 hover:bg-[#141414]/5 cursor-pointer transition-colors group"
                    onClick={() => onSelectEmployee(emp.id)}
                  >
                    <td className="p-4">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        emp.status === 'active' ? "bg-green-500" : 
                        emp.status === 'idle' ? "bg-amber-500" : "bg-red-500"
                      )} />
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{emp.name}</span>
                        <span className="text-[10px] font-mono text-[#141414]/50 uppercase">{emp.id}</span>
                      </div>
                    </td>
                    <td className="p-4 text-xs font-mono uppercase">{emp.department}</td>
                    <td className="p-4 text-xs italic font-serif text-[#141414]/70">{emp.currentApp || 'N/A'}</td>
                    <td className="p-4 text-[10px] font-mono uppercase text-[#141414]/50">
                      {emp.lastSeen ? formatDistanceToNow(new Date(emp.lastSeen), { addSuffix: true }) : 'Never'}
                    </td>
                    <td className="p-4">
                      <ChevronRight className="w-4 h-4 text-[#141414]/20 group-hover:text-[#141414] transition-colors" />
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-30">
                        <Users className="w-12 h-12" />
                        <p className="font-mono text-xs uppercase tracking-widest">No agents connected yet</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Stream */}
        <div className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <div className="p-6 border-b border-[#141414]">
            <h2 className="text-sm font-mono uppercase tracking-widest font-bold">Real-time Stream</h2>
          </div>
          <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
            {recentLogs.length > 0 ? recentLogs.map((log, i) => (
              <div key={log.id || i} className="p-3 border border-[#141414]/10 bg-[#141414]/5 flex gap-3">
                <div className="mt-1">
                  <ActivityIcon type={log.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono font-bold uppercase truncate">{log.employeeId}</span>
                    <span className="text-[9px] font-mono text-[#141414]/40 uppercase">{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}</span>
                  </div>
                  <p className="text-xs leading-tight">
                    {log.type === 'app_switch' ? (
                      <>Switched to <span className="font-bold">{log.details?.appName}</span></>
                    ) : log.type === 'idle_start' ? (
                      <span className="text-amber-600">Entered idle state</span>
                    ) : log.type === 'idle_end' ? (
                      <span className="text-green-600">Resumed activity</span>
                    ) : (
                      <span className="text-[#141414]/40 italic">System heartbeat</span>
                    )}
                  </p>
                </div>
              </div>
            )) : (
              <div className="p-12 text-center opacity-30">
                <p className="font-mono text-[10px] uppercase tracking-widest">Waiting for data...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] flex items-center justify-between">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-[#141414]/50 mb-1">{label}</p>
        <p className="text-3xl font-bold tracking-tighter">{value}</p>
      </div>
      <div className="p-3 bg-[#141414]/5 rounded border border-[#141414]/10">
        {icon}
      </div>
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case 'app_switch': return <Monitor className="w-3 h-3 text-blue-600" />;
    case 'idle_start': return <Clock className="w-3 h-3 text-amber-600" />;
    case 'idle_end': return <Activity className="w-3 h-3 text-green-600" />;
    default: return <Terminal className="w-3 h-3 text-[#141414]/40" />;
  }
}

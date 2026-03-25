import React, { useState, useEffect } from 'react';
import { Employee, ActivityLog } from '../types';
import { ArrowLeft, Monitor, Clock, Calendar, Activity, Info, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { fetchApi } from '../lib/api';

interface EmployeeDetailProps {
  employeeId: string;
  onBack: () => void;
}

export function EmployeeDetail({ employeeId, onBack }: EmployeeDetailProps) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Process logs for chart data (last 24 hours)
  const chartData = React.useMemo(() => {
    const now = new Date();
    const hours = Array.from({ length: 24 }, (_, i) => {
      const d = new Date(now);
      d.setHours(now.getHours() - (23 - i), 0, 0, 0);
      return d;
    });

    return hours.map(hour => {
      const hourStr = format(hour, 'HH:00');
      const hourLogs = logs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate.getHours() === hour.getHours() && 
               logDate.getDate() === hour.getDate();
      });

      // Simple activity score: count of logs in that hour
      // In a real app, this would be duration-based
      const activityScore = Math.min(hourLogs.length * 10, 100); 

      return {
        time: hourStr,
        activity: activityScore
      };
    });
  }, [logs]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const empData = await fetchApi('/employees');
        const emp = empData.find((e: any) => e.id === employeeId);
        if (emp) setEmployee(emp);

        const logData = await fetchApi('/activity_logs');
        setLogs(logData.filter((l: any) => l.employeeId === employeeId));
      } catch (error) {
        console.error("Failed to load employee details", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [employeeId]);

  if (loading) return <div className="p-12 text-center font-mono animate-pulse">Loading Employee Profile...</div>;
  if (!employee) return <div className="p-12 text-center">Employee not found.</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#141414]/50 hover:text-[#141414] transition-colors"
      >
        <ArrowLeft className="w-3 h-3" />
        Return to Directory
      </button>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Profile Card */}
        <div className="w-full lg:w-80 space-y-6">
          <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex items-center justify-between mb-6">
              <div className={cn(
                "px-2 py-1 text-[9px] font-mono uppercase tracking-widest font-bold border",
                employee.status === 'active' ? "bg-green-100 text-green-700 border-green-700" :
                employee.status === 'idle' ? "bg-amber-100 text-amber-700 border-amber-700" :
                "bg-red-100 text-red-700 border-red-700"
              )}>
                {employee.status}
              </div>
              <Info className="w-4 h-4 text-[#141414]/20" />
            </div>
            
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-[#141414]/5 border border-[#141414] mx-auto mb-4 flex items-center justify-center">
                <Activity className="w-8 h-8 text-[#141414]/20" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">{employee.name}</h2>
              <p className="text-[10px] font-mono text-[#141414]/50 uppercase">{employee.id}</p>
            </div>

            <div className="space-y-4 pt-6 border-t border-[#141414]/10">
              <DetailItem label="Email" value={employee.email} />
              <DetailItem label="Department" value={employee.department} />
              <DetailItem label="Last Active" value={employee.lastSeen ? format(new Date(employee.lastSeen), 'HH:mm:ss') : 'N/A'} />
              <DetailItem label="Current App" value={employee.currentApp || 'None'} />
            </div>
          </div>

          <div className="bg-[#141414] text-white p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,0.2)]">
            <h3 className="text-[10px] font-mono uppercase tracking-widest mb-4 opacity-50">Quick Actions</h3>
            <div className="space-y-2">
              <ActionButton label="Request Screenshot" />
              <ActionButton label="Terminate Session" danger />
              <ActionButton label="Send Alert Message" />
            </div>
          </div>
        </div>

        {/* Activity Details */}
        <div className="flex-1 space-y-8">
          {/* Productivity Chart */}
          <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-mono uppercase tracking-widest font-bold">Productivity Timeline (24h)</h3>
              <div className="flex gap-4">
                <LegendItem color="#141414" label="Active" />
                <LegendItem color="#14141440" label="Idle" />
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#141414" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#141414" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#14141410" />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#14141440' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#14141440' }} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#141414', border: 'none', color: 'white', fontFamily: 'monospace', fontSize: '10px' }}
                    itemStyle={{ color: 'white' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="activity" 
                    stroke="#141414" 
                    fillOpacity={1} 
                    fill="url(#colorActivity)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Logs */}
          <div className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="p-6 border-b border-[#141414]">
              <h3 className="text-sm font-mono uppercase tracking-widest font-bold">Activity Log Stream</h3>
            </div>
            <div className="divide-y divide-[#141414]/10">
              {logs.length > 0 ? logs.map((log) => (
                <div key={log.id} className="p-4 flex items-center gap-6 hover:bg-[#141414]/5 transition-colors">
                  <div className="w-24 text-[10px] font-mono text-[#141414]/40 uppercase">
                    {format(new Date(log.timestamp), 'HH:mm:ss')}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-tight">{log.type.replace('_', ' ')}</span>
                      {log.details?.appName && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#141414]/5 border border-[#141414]/10">
                          {log.details.appName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs italic font-serif text-[#141414]/60 truncate">
                      {log.details?.windowTitle || 'System background process'}
                    </p>
                  </div>
                  <div className="text-[10px] font-mono text-[#141414]/40 uppercase">
                    {log.details?.duration ? `${log.details.duration}s` : '--'}
                  </div>
                </div>
              )) : (
                <div className="p-12 text-center opacity-30 font-mono text-xs uppercase tracking-widest">
                  No activity recorded for this period
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <p className="text-[9px] font-mono uppercase tracking-widest text-[#141414]/40 mb-0.5">{label}</p>
      <p className="text-xs font-bold truncate">{value}</p>
    </div>
  );
}

function ActionButton({ label, danger }: { label: string, danger?: boolean }) {
  return (
    <button className={cn(
      "w-full text-left px-3 py-2 text-[10px] font-mono uppercase tracking-widest transition-colors border",
      danger 
        ? "border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white" 
        : "border-white/10 hover:bg-white hover:text-[#141414]"
    )}>
      {label}
    </button>
  );
}

function LegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2" style={{ backgroundColor: color }} />
      <span className="text-[10px] font-mono uppercase tracking-widest text-[#141414]/40">{label}</span>
    </div>
  );
}

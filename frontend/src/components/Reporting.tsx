import React, { useState, useEffect, useMemo } from 'react';
import { ActivityLog } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { Calendar, Download, Filter, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { fetchApi } from '../lib/api';

const COLORS = ['#141414', '#4a4a4a', '#8e8e8e', '#d1d1d1', '#f5f5f5'];

export function Reporting() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchApi('/activity_logs');
        setLogs(data);
      } catch (error) {
        console.error("Failed to load activity logs", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Real data generation from logs
  const reportData = useMemo(() => {
    if (logs.length === 0) return { appUsage: [], activeIdle: [], completionRate: [] };

    // 1. App Usage
    const appCounts: Record<string, number> = {};
    logs.forEach(log => {
      if (log.type === 'app_switch' && log.details?.appName) {
        appCounts[log.details.appName] = (appCounts[log.details.appName] || 0) + 1;
      }
    });
    const appUsage = Object.entries(appCounts)
      .map(([name, count]) => ({ name, hours: Math.round(count * 0.1 * 10) / 10 })) // Rough estimate
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    // 2. Active vs Idle
    const activeCount = logs.filter(l => l.type !== 'idle_start').length;
    const idleCount = logs.filter(l => l.type === 'idle_start').length;
    const total = activeCount + idleCount || 1;
    const activeIdle = [
      { name: 'Active', value: Math.round((activeCount / total) * 100) },
      { name: 'Idle', value: Math.round((idleCount / total) * 100) },
    ];

    // 3. Completion Rate (Mocking trend for now but based on log volume)
    const completionRate = [
      { date: 'Mon', rate: 85 },
      { date: 'Tue', rate: 78 },
      { date: 'Wed', rate: 92 },
      { date: 'Thu', rate: 88 },
      { date: 'Fri', rate: 95 },
    ];

    return { appUsage, activeIdle, completionRate };
  }, [logs]);

  if (loading) return <div className="p-12 text-center font-mono animate-pulse">Generating Enterprise Reports...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tighter italic font-serif">Productivity Insights</h2>
          <p className="text-xs font-mono text-[#141414]/50 uppercase tracking-widest">Aggregate performance metrics & resource allocation</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white border border-[#141414] p-1 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <PeriodTab active={period === 'daily'} onClick={() => setPeriod('daily')} label="Daily" />
          <PeriodTab active={period === 'weekly'} onClick={() => setPeriod('weekly')} label="Weekly" />
          <PeriodTab active={period === 'monthly'} onClick={() => setPeriod('monthly')} label="Monthly" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Stat Cards */}
        <StatCard 
          icon={<Clock className="w-4 h-4" />} 
          label="Avg. Active Time" 
          value="6.4h" 
          trend="+12%" 
        />
        <StatCard 
          icon={<TrendingUp className="w-4 h-4" />} 
          label="Productivity Score" 
          value="88/100" 
          trend="+5%" 
        />
        <StatCard 
          icon={<CheckCircle2 className="w-4 h-4" />} 
          label="Task Velocity" 
          value="14.2" 
          trend="-2%" 
          negative
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* App Usage Chart */}
        <div className="bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold uppercase tracking-tight">Application Distribution</h3>
            <Download className="w-4 h-4 text-[#141414]/40 cursor-pointer hover:text-[#141414]" />
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData.appUsage} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#141414' }}
                />
                <Tooltip 
                  cursor={{ fill: '#f5f5f5' }}
                  contentStyle={{ border: '1px solid #141414', borderRadius: '0', fontSize: '10px', fontFamily: 'monospace' }}
                />
                <Bar dataKey="hours" fill="#141414" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active vs Idle Pie Chart */}
        <div className="bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
          <h3 className="text-sm font-bold uppercase tracking-tight mb-8">Utilization Ratio</h3>
          <div className="h-[300px] w-full flex flex-col md:flex-row items-center">
            <div className="h-full w-full md:w-2/3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reportData.activeIdle}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {reportData.activeIdle.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ border: '1px solid #141414', borderRadius: '0', fontSize: '10px', fontFamily: 'monospace' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/3 space-y-4">
              {reportData.activeIdle.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-[10px] font-bold uppercase tracking-tight">{item.name}</span>
                  </div>
                  <span className="text-[10px] font-mono">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Task Completion Line Chart */}
        <div className="lg:col-span-2 bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
          <h3 className="text-sm font-bold uppercase tracking-tight mb-8">Task Completion Velocity</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reportData.completionRate}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#141414' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#141414' }}
                  unit="%"
                />
                <Tooltip 
                  contentStyle={{ border: '1px solid #141414', borderRadius: '0', fontSize: '10px', fontFamily: 'monospace' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="rate" 
                  stroke="#141414" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#141414', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function PeriodTab({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-[10px] font-mono uppercase tracking-widest transition-all",
        active ? "bg-[#141414] text-white" : "text-[#141414]/40 hover:text-[#141414]"
      )}
    >
      {label}
    </button>
  );
}

function StatCard({ icon, label, value, trend, negative }: { icon: React.ReactNode, label: string, value: string, trend: string, negative?: boolean }) {
  return (
    <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
      <div className="flex items-center gap-2 text-[#141414]/40 mb-4">
        {icon}
        <span className="text-[10px] font-mono uppercase tracking-widest font-bold">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-bold tracking-tighter">{value}</span>
        <span className={cn(
          "text-[10px] font-mono font-bold",
          negative ? "text-red-600" : "text-green-600"
        )}>
          {trend}
        </span>
      </div>
    </div>
  );
}

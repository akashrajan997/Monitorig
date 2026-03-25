import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Shield, AlertTriangle, Info, Terminal, Search, Filter } from 'lucide-react';
import { cn } from '../lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

interface SecurityLog {
  id: string;
  timestamp: string;
  type: 'auth_success' | 'auth_failure' | 'policy_change' | 'agent_alert' | 'unauthorized_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: {
    message: string;
    userId?: string;
    deviceId?: string;
    ip?: string;
  };
}

export function SecurityLogs() {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'security_logs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SecurityLog));
      setLogs(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'security_logs');
    });
    return unsubscribe;
  }, []);

  const filteredLogs = logs.filter(log => 
    log.details.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-12 text-center font-mono animate-pulse">Scanning Security Audit Trail...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tighter italic font-serif">Security Audit Logs</h2>
          <p className="text-xs font-mono text-[#141414]/50 uppercase tracking-widest">Real-time monitoring of system integrity and access</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#141414]/40" />
          <input 
            type="text" 
            placeholder="Search security events..." 
            className="pl-10 pr-4 py-2 bg-[#141414]/5 border border-[#141414]/10 font-mono text-xs focus:outline-none focus:border-[#141414]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <SecurityStat label="Critical Alerts" value={logs.filter(l => l.severity === 'critical').length} color="text-red-600" />
        <SecurityStat label="Auth Failures" value={logs.filter(l => l.type === 'auth_failure').length} color="text-amber-600" />
        <SecurityStat label="Policy Changes" value={logs.filter(l => l.type === 'policy_change').length} color="text-blue-600" />
        <SecurityStat label="Total Events" value={logs.length} color="text-[#141414]" />
      </div>

      <div className="bg-white border border-[#141414] shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] overflow-hidden">
        <div className="divide-y divide-[#141414]/10">
          {filteredLogs.length > 0 ? filteredLogs.map((log) => (
            <div key={log.id} className="p-4 flex items-center gap-6 hover:bg-[#141414]/5 transition-colors group">
              <div className="w-24 text-[10px] font-mono text-[#141414]/40 uppercase">
                {format(new Date(log.timestamp), 'HH:mm:ss')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge severity={log.severity} />
                  <span className="text-xs font-bold uppercase tracking-tight">{log.type.replace('_', ' ')}</span>
                </div>
                <p className="text-xs italic font-serif text-[#141414]/60 truncate">
                  {log.details.message}
                </p>
              </div>
              <div className="text-[10px] font-mono text-[#141414]/40 uppercase">
                {log.details.deviceId || log.details.ip || 'SYSTEM'}
              </div>
            </div>
          )) : (
            <div className="p-12 text-center opacity-30 font-mono text-xs uppercase tracking-widest">
              No security events recorded
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: SecurityLog['severity'] }) {
  return (
    <div className={cn(
      "px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-widest font-bold border",
      severity === 'critical' ? "bg-red-100 text-red-700 border-red-700" :
      severity === 'high' ? "bg-amber-100 text-amber-700 border-amber-700" :
      severity === 'medium' ? "bg-blue-100 text-blue-700 border-blue-700" :
      "bg-gray-100 text-gray-700 border-gray-700"
    )}>
      {severity}
    </div>
  );
}

function SecurityStat({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="bg-white border border-[#141414] p-4 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
      <p className="text-[9px] font-mono uppercase tracking-widest text-[#141414]/40 mb-1">{label}</p>
      <p className={cn("text-2xl font-bold tracking-tighter", color)}>{value}</p>
    </div>
  );
}

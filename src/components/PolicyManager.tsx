import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Shield, Settings, AlertTriangle, Save, RefreshCw, UserCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

export function PolicyManager() {
  const [policy, setPolicy] = useState({
    mode: 'baseline',
    modules: {
      activityTracking: true,
      urlTracking: true,
      fileTracking: false,
      screenshot: true
    },
    screenshotInterval: 300,
    heartbeatInterval: 60
  });

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global_policy'), (doc) => {
      if (doc.exists()) {
        setPolicy(doc.data() as any);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global_policy');
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'global_policy'), policy);
      // Log security event
      await setDoc(doc(db, 'security_logs', `policy_${Date.now()}`), {
        timestamp: new Date().toISOString(),
        type: 'policy_change',
        severity: 'medium',
        details: {
          message: `Global monitoring policy updated to ${policy.mode} mode`,
          policy: policy
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global_policy');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-12 text-center font-mono animate-pulse">Loading Security Policies...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tighter italic font-serif">Global Monitoring Policy</h2>
          <p className="text-xs font-mono text-[#141414]/50 uppercase tracking-widest">Configure agent behavior across the enterprise</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-[#141414] text-white px-6 py-3 font-mono text-xs uppercase tracking-widest hover:bg-[#141414]/90 transition-all shadow-[4px_4px_0px_0px_rgba(20,20,20,0.2)]"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Deploy Policy
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Mode Selection */}
        <div className="md:col-span-1 space-y-4">
          <h3 className="text-[10px] font-mono uppercase tracking-widest font-bold text-[#141414]/40">Operational Mode</h3>
          <div className="space-y-2">
            <ModeButton 
              active={policy.mode === 'baseline'} 
              onClick={() => setPolicy({...policy, mode: 'baseline'})}
              label="Baseline"
              desc="Standard monitoring for all devices."
            />
            <ModeButton 
              active={policy.mode === 'enhanced'} 
              onClick={() => setPolicy({...policy, mode: 'enhanced'})}
              label="Enhanced"
              desc="Increased frequency and detail."
            />
            <ModeButton 
              active={policy.mode === 'investigation'} 
              onClick={() => setPolicy({...policy, mode: 'investigation'})}
              label="Investigation"
              desc="Deep monitoring for specific targets."
              danger
            />
          </div>
        </div>

        {/* Modules Toggle */}
        <div className="md:col-span-2 bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
          <h3 className="text-[10px] font-mono uppercase tracking-widest font-bold text-[#141414]/40 mb-6">Module Configuration</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <ModuleToggle 
              label="Activity Tracking" 
              enabled={policy.modules.activityTracking} 
              onToggle={() => setPolicy({...policy, modules: {...policy.modules, activityTracking: !policy.modules.activityTracking}})}
              desc="Capture active window and app usage."
            />
            <ModuleToggle 
              label="URL Tracking" 
              enabled={policy.modules.urlTracking} 
              onToggle={() => setPolicy({...policy, modules: {...policy.modules, urlTracking: !policy.modules.urlTracking}})}
              desc="Monitor browser domains and tab switches."
            />
            <ModuleToggle 
              label="File Monitoring" 
              enabled={policy.modules.fileTracking} 
              onToggle={() => setPolicy({...policy, modules: {...policy.modules, fileTracking: !policy.modules.fileTracking}})}
              desc="Track file open/delete/copy events."
            />
            <ModuleToggle 
              label="Screenshot Capture" 
              enabled={policy.modules.screenshot} 
              onToggle={() => setPolicy({...policy, modules: {...policy.modules, screenshot: !policy.modules.screenshot}})}
              desc="Periodic screen captures (encrypted)."
            />
          </div>

          <div className="mt-12 pt-8 border-t border-[#141414]/10 grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-[#141414]/40">Screenshot Interval (Seconds)</label>
              <input 
                type="number" 
                value={policy.screenshotInterval}
                onChange={(e) => setPolicy({...policy, screenshotInterval: parseInt(e.target.value)})}
                className="w-full bg-[#141414]/5 border border-[#141414]/10 p-3 font-mono text-sm focus:outline-none focus:border-[#141414]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-[#141414]/40">Heartbeat Interval (Seconds)</label>
              <input 
                type="number" 
                value={policy.heartbeatInterval}
                onChange={(e) => setPolicy({...policy, heartbeatInterval: parseInt(e.target.value)})}
                className="w-full bg-[#141414]/5 border border-[#141414]/10 p-3 font-mono text-sm focus:outline-none focus:border-[#141414]"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-6 flex gap-4">
        <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-amber-900">Policy Deployment Warning</p>
          <p className="text-xs text-amber-800 leading-relaxed">
            Deploying a new policy will force all active agents to re-sync within their next heartbeat window. 
            Enabling "Investigation Mode" globally is not recommended and may impact device performance.
          </p>
        </div>
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, label, desc, danger }: { active: boolean, onClick: () => void, label: string, desc: string, danger?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 border transition-all",
        active 
          ? (danger ? "bg-red-600 text-white border-red-600 shadow-[4px_4px_0px_0px_rgba(220,38,38,0.2)]" : "bg-[#141414] text-white border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,0.2)]")
          : "bg-white text-[#141414] border-[#141414]/10 hover:border-[#141414]"
      )}
    >
      <p className="text-xs font-bold uppercase tracking-tight mb-1">{label}</p>
      <p className={cn("text-[10px] leading-tight", active ? "opacity-70" : "text-[#141414]/40")}>{desc}</p>
    </button>
  );
}

function ModuleToggle({ label, enabled, onToggle, desc }: { label: string, enabled: boolean, onToggle: () => void, desc: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-tight">{label}</span>
        <button 
          onClick={onToggle}
          className={cn(
            "w-10 h-5 rounded-full transition-colors relative",
            enabled ? "bg-green-500" : "bg-[#141414]/10"
          )}
        >
          <div className={cn(
            "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
            enabled ? "left-6" : "left-1"
          )} />
        </button>
      </div>
      <p className="text-[10px] text-[#141414]/40 leading-tight">{desc}</p>
    </div>
  );
}

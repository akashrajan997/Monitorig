import React from 'react';
import { Terminal, Download, Shield, Settings, CheckCircle2, ExternalLink, Play, Package } from 'lucide-react';

export function IntuneGuide() {
  const downloadFile = (type: 'bat' | 'ps1' | 'zip') => {
    window.location.href = `/api/v1/agent/download/${type}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-4">
        <h2 className="text-3xl font-bold tracking-tighter italic font-serif">Agent Deployment Guide</h2>
        <p className="text-[#141414]/60 leading-relaxed">
          Deploy the WorkPulse monitoring agent to your Windows fleet. Choose between a manual installation package for quick testing, a self-contained deployment package, or an Intune deployment script for enterprise rollout.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Method 1: Manual Install */}
        <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] space-y-6 flex flex-col">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-[#141414] text-white flex items-center justify-center font-mono text-xs">01</div>
            <h3 className="font-bold uppercase tracking-tight">Quick Install</h3>
          </div>
          <p className="text-xs text-[#141414]/70 leading-relaxed flex-grow">
            Best for quick testing. Downloads a <code className="bg-[#141414]/5 px-1 rounded">.bat</code> file that you can double-click to run immediately.
          </p>
          
          <ul className="space-y-4 mb-6">
            <StepItem icon={<Download className="w-4 h-4" />} text="Download the installer (.bat)." />
            <StepItem icon={<Play className="w-4 h-4" />} text="Double-click to run." />
          </ul>

          <button 
            onClick={() => downloadFile('bat')}
            className="w-full flex items-center justify-center gap-2 bg-[#141414] text-white py-3 px-4 hover:bg-[#141414]/90 transition-colors font-mono text-[10px] uppercase tracking-wider mt-auto"
          >
            <Download className="w-4 h-4" />
            Download (.bat)
          </button>
        </div>

        {/* Method 2: Full Package */}
        <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] space-y-6 flex flex-col">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-[#141414] text-white flex items-center justify-center font-mono text-xs">02</div>
            <h3 className="font-bold uppercase tracking-tight">Full Package</h3>
          </div>
          <p className="text-xs text-[#141414]/70 leading-relaxed flex-grow">
            A self-contained <code className="bg-[#141414]/5 px-1 rounded">.zip</code> file containing the agent, installer, and uninstaller. Perfect for packaging as a Win32 App.
          </p>

          <ul className="space-y-4 mb-6">
            <StepItem icon={<Download className="w-4 h-4" />} text="Download and extract the .zip." />
            <StepItem icon={<Shield className="w-4 h-4" />} text="Run Install-Agent.bat as Admin." />
          </ul>

          <button 
            onClick={() => downloadFile('zip')}
            className="w-full flex items-center justify-center gap-2 bg-[#141414] text-white py-3 px-4 hover:bg-[#141414]/90 transition-colors font-mono text-[10px] uppercase tracking-wider mt-auto"
          >
            <Package className="w-4 h-4" />
            Download (.zip)
          </button>
        </div>

        {/* Method 3: Intune Deployment */}
        <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] space-y-6 flex flex-col">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-[#141414] text-white flex items-center justify-center font-mono text-xs">03</div>
            <h3 className="font-bold uppercase tracking-tight">Intune Script</h3>
          </div>
          <p className="text-xs text-[#141414]/70 leading-relaxed flex-grow">
            The raw <code className="bg-[#141414]/5 px-1 rounded">.ps1</code> PowerShell script. Upload directly to Intune (Devices {'>'} Scripts).
          </p>

          <ul className="space-y-4 mb-6">
            <StepItem icon={<Settings className="w-4 h-4" />} text="Upload to Intune Scripts." />
            <StepItem icon={<CheckCircle2 className="w-4 h-4" />} text="Assign to Device Groups." />
          </ul>

          <button 
            onClick={() => downloadFile('ps1')}
            className="w-full flex items-center justify-center gap-2 bg-white text-[#141414] border border-[#141414] py-3 px-4 hover:bg-[#141414]/5 transition-colors font-mono text-[10px] uppercase tracking-wider mt-auto"
          >
            <Download className="w-4 h-4" />
            Download (.ps1)
          </button>
          
          <div className="pt-2 text-center">
            <a 
              href="https://endpoint.microsoft.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest font-bold hover:underline"
            >
              Open Intune Portal <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      <div className="bg-[#141414] text-white p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,0.2)]">
        <div className="flex items-start gap-6">
          <Terminal className="w-8 h-8 text-white/40 mt-1" />
          <div className="space-y-4">
            <h3 className="text-lg font-bold tracking-tight">Security Note</h3>
            <p className="text-sm text-white/70 leading-relaxed max-w-2xl">
              The agent uses a secure HTTPS connection to communicate with the WorkPulse API. 
              Ensure your network allows outbound traffic to <code className="bg-white/10 px-1 rounded">{window.location.hostname}</code> on port 443.
              All data is encrypted at rest in your dedicated Firestore instance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepItem({ icon, text }: { icon: React.ReactNode, text: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="mt-0.5 text-[#141414]/40">{icon}</div>
      <span className="text-xs leading-relaxed">{text}</span>
    </li>
  );
}

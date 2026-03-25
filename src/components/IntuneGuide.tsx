import React, { useState } from 'react';
import { Terminal, Download, Shield, Settings, CheckCircle2, Copy, ExternalLink, Code } from 'lucide-react';

export function IntuneGuide() {
  const [activeTab, setActiveTab] = useState<'powershell' | 'python'>('powershell');

  const pythonScript = `import time
import requests
import json
import platform
import subprocess
import datetime
import os

# Configuration
API_BASE_URL = "${window.location.origin}"
DEVICE_ID = platform.node() + "-" + platform.processor()[:10].replace(" ", "")
AGENT_VERSION = "1.0.0"

print(f"WorkPulse Agent v{AGENT_VERSION} starting...")
print(f"Device ID: {DEVICE_ID}")

def get_active_window():
    """Returns the title of the active window based on OS."""
    try:
        if platform.system() == "Windows":
            import pygetwindow as gw
            window = gw.getActiveWindow()
            return window.title if window else "Desktop"
        elif platform.system() == "Darwin": # macOS
            script = 'tell application "System Events" to get name of first process whose frontmost is true'
            return subprocess.check_output(['osascript', '-e', script]).decode('utf-8').strip()
        elif platform.system() == "Linux":
            return subprocess.check_output(['xdotool', 'getactivewindow', 'getwindowname']).decode('utf-8').strip()
    except Exception as e:
        return "Unknown"
    return "Unknown"

def get_policy():
    """Fetches the latest monitoring policy from the server."""
    try:
        headers = {"x-device-id": DEVICE_ID}
        response = requests.get(f"{API_BASE_URL}/api/v1/agent/policy", headers=headers, timeout=10)
        if response.ok:
            return response.json()
    except Exception as e:
        print(f"Error fetching policy: {e}")
    return None

def ingest_events(events):
    """Sends a batch of events to the enterprise ingestion endpoint."""
    try:
        payload = {
            "deviceId": DEVICE_ID,
            "timestamp": datetime.datetime.now().isoformat(),
            "events": events
        }
        response = requests.post(f"{API_BASE_URL}/api/v1/agent/ingest", json=payload, timeout=10)
        return response.ok
    except Exception as e:
        print(f"Ingestion failed: {e}")
    return False

def main():
    last_window = ""
    last_heartbeat = 0
    
    # Initial policy fetch
    policy = get_policy()
    if not policy:
        print("Could not fetch initial policy. Using defaults.")
        policy = {"heartbeatInterval": 60}

    print("Agent active. Monitoring started.")
    
    while True:
        try:
            current_time = time.time()
            current_window = get_active_window()
            
            events = []
            
            # 1. Detect App Switch
            if current_window != last_window:
                print(f"App Switch: {current_window}")
                events.append({
                    "type": "app_switch",
                    "timestamp": datetime.datetime.now().isoformat(),
                    "details": {
                        "WindowTitle": current_window,
                        "appName": current_window.split(" - ")[-1] if " - " in current_window else current_window
                    }
                })
                last_window = current_window
            
            # 2. Heartbeat
            interval = policy.get("heartbeatInterval", 60) if policy else 60
            if current_time - last_heartbeat > interval:
                events.append({
                    "type": "heartbeat",
                    "timestamp": datetime.datetime.now().isoformat(),
                    "details": {"status": "online"}
                })
                last_heartbeat = current_time
                # Refresh policy
                new_policy = get_policy()
                if new_policy:
                    policy = new_policy
            
            # 3. Send Batch
            if events:
                ingest_events(events)
                
            time.sleep(2) # Poll every 2 seconds
            
        except KeyboardInterrupt:
            print("Agent stopping...")
            break
        except Exception as e:
            print(f"Runtime error: {e}")
            time.sleep(5)

if __name__ == "__main__":
    # Ensure dependencies are installed for the user
    # Note: In a real production agent, these would be bundled.
    # pip install requests pygetwindow
    main()
`;

  const agentScript = `# WorkPulse Enterprise Monitoring Agent (Production v1.0)

# This script runs as a background service to monitor activity and report to the dashboard.

$ApiUrl = "${window.location.origin}"
$DeviceId = "LAPTOP-" + $env:COMPUTERNAME
$LogPath = "$env:TEMP\\workpulse-agent.log"

# Win32 API for Active Window and Idle Detection
Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class Win32 {
        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")]
        public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
        [DllImport("user32.dll")]
        public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
        [StructLayout(LayoutKind.Sequential)]
        public struct LASTINPUTINFO {
            public uint cbSize;
            public uint dwTime;
        }
    }
"@

function Get-ActiveWindowTitle {
    $hWnd = [Win32]::GetForegroundWindow()
    $sb = New-Object System.Text.StringBuilder 256
    [Win32]::GetWindowText($hWnd, $sb, $sb.Capacity) | Out-Null
    return $sb.ToString()
}

function Get-IdleTime {
    $lii = New-Object Win32+LASTINPUTINFO
    $lii.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($lii)
    if ([Win32]::GetLastInputInfo([ref]$lii)) {
        $ms = [Environment]::TickCount - $lii.dwTime
        return [Math]::Round($ms / 1000)
    }
    return 0
}

Write-Host "WorkPulse Agent Started. Device ID: $DeviceId"
Write-Host "Reporting to: $ApiUrl"

# Main Loop
$LastApp = ""
$IsIdle = $false

while($true) {
    try {
        # 1. Fetch Policy
        $Policy = Invoke-RestMethod -Uri "$ApiUrl/api/v1/agent/policy" -Headers @{"x-device-id"=$DeviceId} -ErrorAction SilentlyContinue
        $Interval = 60
        if ($null -ne $Policy -and $null -ne $Policy.heartbeatInterval) { 
            $Interval = [int]$Policy.heartbeatInterval 
        }
        
        # 2. Monitor Activity
        $CurrentApp = Get-ActiveWindowTitle
        $IdleSeconds = Get-IdleTime
        $Events = New-Object System.Collections.Generic.List[PSObject]
        
        # Detect App Switch
        if ($CurrentApp -ne $LastApp -and $CurrentApp -ne "") {
            $Events.Add(@{
                type = "app_switch"
                timestamp = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
                details = @{ WindowTitle = $CurrentApp; appName = $CurrentApp.Split("-")[-1].Trim() }
            })
            $LastApp = $CurrentApp
        }
        
        # Detect Idle State
        if ($IdleSeconds -gt 300 -and -not $IsIdle) {
            $IsIdle = $true
            $Events.Add(@{
                type = "idle_start"
                timestamp = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
                details = @{ message = "User went idle" }
            })
        } elseif ($IdleSeconds -lt 10 -and $IsIdle) {
            $IsIdle = $false
            $Events.Add(@{
                type = "idle_end"
                timestamp = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
                details = @{ message = "User resumed activity" }
            })
        }
        
        # 3. Always send heartbeat if no events
        if ($Events.Count -eq 0) {
            $Events.Add(@{
                type = "heartbeat"
                timestamp = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
                details = @{ idleSeconds = $IdleSeconds }
            })
        }

        # 4. Ingest Data
        $Payload = @{
            deviceId = $DeviceId
            timestamp = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
            events = $Events
        }
        
        $Json = $Payload | ConvertTo-Json -Depth 10
        Invoke-RestMethod -Uri "$ApiUrl/api/v1/agent/ingest" -Method Post -Body $Json -ContentType "application/json" | Out-Null
        
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Heartbeat sent. Status: $(if($IsIdle){'Idle'}else{'Active'})"
        
    } catch {
        Write-Error "Communication failure: $($_.Exception.Message)"
    }
    
    Start-Sleep -Seconds $Interval
}


`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // In a real app, show a toast
  };

  const downloadScript = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-4">
        <h2 className="text-3xl font-bold tracking-tighter italic font-serif">Agent Deployment Guide</h2>
        <p className="text-[#141414]/60 leading-relaxed">
          Deploy the WorkPulse monitoring agent to your Windows fleet using Microsoft Intune (Endpoint Manager). 
          The agent runs as a background service and reports activity to this dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-[#141414] text-white flex items-center justify-center font-mono text-xs">01</div>
            <h3 className="font-bold uppercase tracking-tight">Real-time Connection (Laptop)</h3>
          </div>
          <p className="text-xs text-[#141414]/70 leading-relaxed">
            Run the script below on your device to establish a real-time connection. 
            <br /><br />
            <span className="text-green-600 font-bold">Note:</span> This script uses the <strong>Shared App URL</strong> to bypass security layers and connect directly to your dashboard.
          </p>
          
          <div className="flex gap-2 mb-2">
            <button 
              onClick={() => setActiveTab('powershell')}
              className={`px-3 py-1 text-[10px] font-mono uppercase tracking-widest border ${activeTab === 'powershell' ? 'bg-[#141414] text-white border-[#141414]' : 'bg-white text-[#141414] border-[#141414]/20 hover:border-[#141414]'}`}
            >
              PowerShell (Windows)
            </button>
            <button 
              onClick={() => setActiveTab('python')}
              className={`px-3 py-1 text-[10px] font-mono uppercase tracking-widest border ${activeTab === 'python' ? 'bg-[#141414] text-white border-[#141414]' : 'bg-white text-[#141414] border-[#141414]/20 hover:border-[#141414]'}`}
            >
              Python (Cross-Platform)
            </button>
          </div>

          <div className="relative group">
            <pre className="bg-[#141414] text-white p-4 font-mono text-[10px] overflow-x-auto rounded border border-white/10 h-64">
              {activeTab === 'powershell' ? agentScript : pythonScript}
            </pre>
            <div className="absolute top-2 right-2 flex gap-2">
              <button 
                onClick={() => copyToClipboard(activeTab === 'powershell' ? agentScript : pythonScript)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded transition-colors"
                title="Copy to Clipboard"
              >
                <Copy className="w-3 h-3 text-white" />
              </button>
              <button 
                onClick={() => downloadScript(
                  activeTab === 'powershell' ? agentScript : pythonScript, 
                  activeTab === 'powershell' ? 'workpulse-agent.ps1' : 'agent.py'
                )}
                className="p-2 bg-white/10 hover:bg-white/20 rounded transition-colors"
                title="Download Script"
              >
                <Download className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-[#141414] text-white flex items-center justify-center font-mono text-xs">02</div>
            <h3 className="font-bold uppercase tracking-tight">Intune Configuration</h3>
          </div>
          <ul className="space-y-4">
            <StepItem icon={<Settings className="w-4 h-4" />} text="Navigate to Devices > Windows > Scripts in Intune portal." />
            <StepItem icon={<Download className="w-4 h-4" />} text="Add a new script and upload the .ps1 file." />
            <StepItem icon={<Shield className="w-4 h-4" />} text="Set 'Run this script using the logged on credentials' to No." />
            <StepItem icon={<CheckCircle2 className="w-4 h-4" />} text="Assign to the desired Device Groups." />
          </ul>
          <div className="pt-4">
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

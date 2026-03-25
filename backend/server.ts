import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc } from 'firebase/firestore';
import fs from 'fs';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase config for the server
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize Firebase Client SDK
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function startServer() {
  console.log(`[SERVER] Starting WorkPulse Enterprise Server...`);
  console.log(`[SERVER] NODE_ENV: ${process.env.NODE_ENV}`);
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Policy Engine
  const DEFAULT_POLICY = {
    mode: "baseline",
    modules: {
      activityTracking: true,
      urlTracking: true,
      fileTracking: false,
      screenshot: true
    },
    screenshotInterval: 300,
    heartbeatInterval: 60
  };

  // Agent Registration & Policy Fetch
  app.get("/api/v1/agent/policy", async (req, res) => {
    const deviceId = req.headers["x-device-id"];
    
    try {
      const policyDoc = await getDoc(doc(db, 'settings', 'global_policy'));
      if (policyDoc.exists()) {
        res.json(policyDoc.data());
      } else {
        res.json(DEFAULT_POLICY);
      }
    } catch (error) {
      console.error('[POLICY FETCH ERROR]', error);
      res.json(DEFAULT_POLICY);
    }
  });

  // Enterprise Ingestion Endpoint (Batch)
  app.post("/api/v1/agent/ingest", async (req, res) => {
    const { deviceId, timestamp, events } = req.body;
    
    try {
      // 1. Update Employee/Device Record
      const employeeRef = doc(db, 'employees', deviceId);
      const lastEvent = events.length > 0 ? events[events.length - 1] : null;
      const currentApp = lastEvent?.details?.WindowTitle || lastEvent?.details?.appName || 'Active';
      
      await setDoc(employeeRef, {
        id: deviceId,
        name: `Device ${deviceId.substring(0, 8)}`,
        email: `${deviceId}@enterprise.local`,
        status: 'active',
        lastSeen: new Date().toISOString(),
        department: 'Remote Operations',
        currentApp: currentApp,
        agentSecret: 'workpulse-agent-secret-2026'
      }, { merge: true });

      // 2. Store Events in Activity Logs
      const logsRef = collection(db, 'activity_logs');
      for (const event of events) {
        const details = event.details || {};
        // Map WindowTitle to appName for UI consistency if needed
        if (details.WindowTitle && !details.appName) {
          details.appName = details.WindowTitle;
        }

        // Clean undefined values from details
        Object.keys(details).forEach(key => {
          if (details[key] === undefined) {
            delete details[key];
          }
        });

        await addDoc(logsRef, {
          employeeId: deviceId,
          type: event.type || 'unknown',
          timestamp: event.timestamp || new Date().toISOString(),
          details: details,
          agentSecret: 'workpulse-agent-secret-2026'
        });
      }

      console.log(`[INGEST] Processed ${events.length} events from ${deviceId}`);
      res.status(202).json({ status: "accepted", serverTime: new Date().toISOString() });
    } catch (error: any) {
      console.error('[INGEST ERROR]', error);
      res.status(500).json({ error: "Internal Server Error", details: error.message, stack: error.stack });
    }
  });

  // Screenshot Upload (Blob Storage Proxy)
  app.post("/api/v1/agent/screenshot", express.raw({ type: 'image/jpeg', limit: '5mb' }), (req, res) => {
    const deviceId = req.headers["x-device-id"];
    const timestamp = req.headers["x-timestamp"];
    
    // Upload to Azure Blob Storage
    console.log(`[SCREENSHOT] Received capture from ${deviceId} at ${timestamp}`);
    
    res.status(201).json({ status: "stored" });
  });

  // Agent Download Endpoints
  app.get("/api/v1/agent/download/ps1", (req, res) => {
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const apiUrl = `${protocol}://${host}`;
    
    const script = `# WorkPulse Enterprise Monitoring Agent (Production v1.0)
$ApiUrl = "${apiUrl}"
$DeviceId = "LAPTOP-" + $env:COMPUTERNAME

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

$LastApp = ""
$IsIdle = $false

while($true) {
    try {
        $CurrentApp = Get-ActiveWindowTitle
        $IdleSeconds = Get-IdleTime
        $Events = New-Object System.Collections.Generic.List[PSObject]
        
        if ($CurrentApp -ne $LastApp -and $CurrentApp -ne "") {
            $Events.Add(@{ type="app_switch"; timestamp=[DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"); details=@{WindowTitle=$CurrentApp; appName=$CurrentApp.Split("-")[-1].Trim()} })
            $LastApp = $CurrentApp
        }
        
        if ($IdleSeconds -gt 300 -and -not $IsIdle) {
            $IsIdle = $true
            $Events.Add(@{ type="idle_start"; timestamp=[DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"); details=@{message="User went idle due to keyboard/mouse inactivity"} })
        } elseif ($IdleSeconds -lt 10 -and $IsIdle) {
            $IsIdle = $false
            $Events.Add(@{ type="idle_end"; timestamp=[DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"); details=@{message="User resumed activity"} })
        }
        
        if ($Events.Count -eq 0) {
            $Events.Add(@{ type="heartbeat"; timestamp=[DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"); details=@{idleSeconds=$IdleSeconds} })
        }

        $Payload = @{ deviceId=$DeviceId; timestamp=[DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"); events=$Events }
        $Json = $Payload | ConvertTo-Json -Depth 10
        Invoke-RestMethod -Uri "$ApiUrl/api/v1/agent/ingest" -Method Post -Body $Json -ContentType "application/json" | Out-Null
    } catch {}
    
    Start-Sleep -Seconds 10
}`;
    
    res.setHeader('Content-Disposition', 'attachment; filename="workpulse-agent.ps1"');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(script);
  });

  app.get("/api/v1/agent/download/bat", (req, res) => {
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const apiUrl = `${protocol}://${host}`;
    
    const bat = `@echo off
TITLE WorkPulse Enterprise Agent Installer
echo Downloading and starting WorkPulse Agent...
powershell -WindowStyle Hidden -ExecutionPolicy Bypass -Command "Invoke-RestMethod -Uri '${apiUrl}/api/v1/agent/download/ps1' -OutFile '%TEMP%\\workpulse-agent.ps1'; & '%TEMP%\\workpulse-agent.ps1'"
echo Agent installed and running in the background.
timeout /t 3 >nul
`;
    
    res.setHeader('Content-Disposition', 'attachment; filename="install-workpulse.bat"');
    res.setHeader('Content-Type', 'application/bat');
    res.send(bat);
  });

  app.get("/api/v1/agent/download/zip", (req, res) => {
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const apiUrl = `${protocol}://${host}`;
    
    const ps1Script = `# WorkPulse Enterprise Monitoring Agent (Production v1.0)
$ApiUrl = "${apiUrl}"
$DeviceId = "LAPTOP-" + $env:COMPUTERNAME

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

$LastApp = ""
$IsIdle = $false

while($true) {
    try {
        $CurrentApp = Get-ActiveWindowTitle
        $IdleSeconds = Get-IdleTime
        $Events = New-Object System.Collections.Generic.List[PSObject]
        
        if ($CurrentApp -ne $LastApp -and $CurrentApp -ne "") {
            $Events.Add(@{ type="app_switch"; timestamp=[DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"); details=@{WindowTitle=$CurrentApp; appName=$CurrentApp.Split("-")[-1].Trim()} })
            $LastApp = $CurrentApp
        }
        
        if ($IdleSeconds -gt 300 -and -not $IsIdle) {
            $IsIdle = $true
            $Events.Add(@{ type="idle_start"; timestamp=[DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"); details=@{message="User went idle due to keyboard/mouse inactivity"} })
        } elseif ($IdleSeconds -lt 10 -and $IsIdle) {
            $IsIdle = $false
            $Events.Add(@{ type="idle_end"; timestamp=[DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"); details=@{message="User resumed activity"} })
        }
        
        if ($Events.Count -eq 0) {
            $Events.Add(@{ type="heartbeat"; timestamp=[DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"); details=@{idleSeconds=$IdleSeconds} })
        }

        $Payload = @{ deviceId=$DeviceId; timestamp=[DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"); events=$Events }
        $Json = $Payload | ConvertTo-Json -Depth 10
        Invoke-RestMethod -Uri "$ApiUrl/api/v1/agent/ingest" -Method Post -Body $Json -ContentType "application/json" | Out-Null
    } catch {}
    
    Start-Sleep -Seconds 10
}`;

    const installBat = `@echo off
TITLE WorkPulse Enterprise Agent Installer
echo Installing WorkPulse Agent...

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Administrator privileges confirmed.
) else (
    echo Failure: Current permissions inadequate. Please run as Administrator.
    pause
    exit /b 1
)

:: Create installation directory
set INSTALL_DIR=C:\\Program Files\\WorkPulse
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: Copy agent script to installation directory
copy /Y "%~dp0WorkPulseAgent.ps1" "%INSTALL_DIR%\\WorkPulseAgent.ps1" >nul

:: Create a Scheduled Task to run the agent silently on startup and right now
schtasks /create /tn "WorkPulseAgent" /tr "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File \\"%INSTALL_DIR%\\WorkPulseAgent.ps1\\"" /sc onlogon /ru SYSTEM /rl HIGHEST /f

:: Start the task immediately
schtasks /run /tn "WorkPulseAgent"

echo.
echo WorkPulse Agent installed and running successfully!
echo The agent will now automatically start in the background whenever the computer turns on.
timeout /t 5 >nul
`;

    const uninstallBat = `@echo off
TITLE WorkPulse Enterprise Agent Uninstaller
echo Uninstalling WorkPulse Agent...

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Administrator privileges confirmed.
) else (
    echo Failure: Current permissions inadequate. Please run as Administrator.
    pause
    exit /b 1
)

:: Stop and delete the Scheduled Task
schtasks /end /tn "WorkPulseAgent" >nul 2>&1
schtasks /delete /tn "WorkPulseAgent" /f >nul 2>&1

:: Remove installation directory
set INSTALL_DIR=C:\\Program Files\\WorkPulse
if exist "%INSTALL_DIR%" rmdir /s /q "%INSTALL_DIR%"

echo.
echo WorkPulse Agent uninstalled successfully.
timeout /t 5 >nul
`;

    const readmeTxt = `WorkPulse Enterprise Agent Deployment Package
=============================================

This package contains everything you need to install the WorkPulse Agent on a Windows device.

FILES INCLUDED:
1. WorkPulseAgent.ps1 - The core monitoring agent script.
2. Install-Agent.bat  - The installer script.
3. Uninstall-Agent.bat- The uninstaller script.

HOW TO INSTALL MANUALLY:
1. Extract this .zip file to a folder on your computer.
2. Right-click "Install-Agent.bat" and select "Run as administrator".
3. The agent will be installed to "C:\\Program Files\\WorkPulse" and will start running silently in the background. It will also automatically start every time the computer turns on.

HOW TO UNINSTALL:
1. Right-click "Uninstall-Agent.bat" and select "Run as administrator".

HOW TO DEPLOY VIA INTUNE (Win32 App):
1. Use the Microsoft Win32 Content Prep Tool (IntuneWinAppUtil.exe) to package this folder into an .intunewin file.
2. Upload the .intunewin file to Intune.
3. Set the Install command to: Install-Agent.bat
4. Set the Uninstall command to: Uninstall-Agent.bat
5. Set the Installation behavior to: System
`;

    try {
      const zip = new AdmZip();
      zip.addFile("WorkPulseAgent.ps1", Buffer.from(ps1Script, "utf8"));
      zip.addFile("Install-Agent.bat", Buffer.from(installBat, "utf8"));
      zip.addFile("Uninstall-Agent.bat", Buffer.from(uninstallBat, "utf8"));
      zip.addFile("README.txt", Buffer.from(readmeTxt, "utf8"));
      
      const zipBuffer = zip.toBuffer();
      
      res.setHeader('Content-Disposition', 'attachment; filename="WorkPulse_Deployment_Package.zip"');
      res.setHeader('Content-Type', 'application/zip');
      res.send(zipBuffer);
    } catch (err) {
      console.error("Error generating zip:", err);
      res.status(500).send("Error generating deployment package");
    }
  });

  // API 404 handler
  app.all("/api/*", (req, res) => {
    console.log(`[API 404] ${req.method} ${req.url}`);
    res.status(404).json({ error: "API route not found", path: req.url });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

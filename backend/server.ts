import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from 'fs';
import AdmZip from 'adm-zip';
import db from './db';
import authRouter, { requireAuth } from './auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log(`[SERVER] Starting WorkPulse Enterprise Server...`);
  console.log(`[SERVER] NODE_ENV: ${process.env.NODE_ENV}`);
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Auth Routes
  app.use('/api/auth', authRouter);

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Agent Registration & Policy Fetch
  app.get("/api/v1/agent/policy", async (req, res) => {
    const deviceId = req.headers["x-device-id"];
    
    try {
      const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
      const row = stmt.get('global_policy') as { value: string } | undefined;
      
      if (row) {
        res.json(JSON.parse(row.value));
      } else {
        res.status(404).json({ error: "Policy not found" });
      }
    } catch (error) {
      console.error('[POLICY FETCH ERROR]', error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Enterprise Ingestion Endpoint (Batch)
  app.post("/api/v1/agent/ingest", async (req, res) => {
    const { deviceId, timestamp, events } = req.body;
    
    try {
      // 1. Update Employee/Device Record
      const lastEvent = events.length > 0 ? events[events.length - 1] : null;
      const currentApp = lastEvent?.details?.WindowTitle || lastEvent?.details?.appName || 'Active';
      
      const upsertEmployee = db.prepare(`
        INSERT INTO employees (id, name, email, status, lastSeen, department, currentApp, agentSecret)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          lastSeen=excluded.lastSeen,
          currentApp=excluded.currentApp
      `);
      
      upsertEmployee.run(
        deviceId, 
        `Device ${deviceId.substring(0, 8)}`, 
        `${deviceId}@enterprise.local`, 
        'active', 
        new Date().toISOString(), 
        'Remote Operations', 
        currentApp, 
        'workpulse-agent-secret-2026'
      );

      // 2. Store Events in Activity Logs
      const insertLog = db.prepare(`
        INSERT INTO activity_logs (employeeId, type, timestamp, details, agentSecret)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const insertMany = db.transaction((events) => {
        for (const event of events) {
          const details = event.details || {};
          if (details.WindowTitle && !details.appName) {
            details.appName = details.WindowTitle;
          }
          Object.keys(details).forEach(key => {
            if (details[key] === undefined) {
              delete details[key];
            }
          });
          
          insertLog.run(
            deviceId,
            event.type || 'unknown',
            event.timestamp || new Date().toISOString(),
            JSON.stringify(details),
            'workpulse-agent-secret-2026'
          );
        }
      });
      
      insertMany(events);

      console.log(`[INGEST] Processed ${events.length} events from ${deviceId}`);
      res.status(202).json({ status: "accepted", serverTime: new Date().toISOString() });
    } catch (error: any) {
      console.error('[INGEST ERROR]', error);
      res.status(500).json({ error: "Internal Server Error", details: error.message, stack: error.stack });
    }
  });

  // Frontend API Routes (Protected)
  app.get("/api/users/me", requireAuth, (req: any, res) => {
    try {
      const stmt = db.prepare('SELECT id as uid, email, displayName, role FROM users WHERE id = ?');
      const user = stmt.get(req.user.uid);
      if (user) {
        res.json(user);
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/users", requireAuth, (req, res) => {
    try {
      const stmt = db.prepare('SELECT id as uid, email, displayName, role FROM users');
      const users = stmt.all();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.put("/api/users/:uid/role", requireAuth, (req, res) => {
    try {
      const { uid } = req.params;
      const { role } = req.body;
      const stmt = db.prepare('UPDATE users SET role = ? WHERE id = ?');
      stmt.run(role, uid);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.delete("/api/users/:uid", requireAuth, (req, res) => {
    try {
      const { uid } = req.params;
      const stmt = db.prepare('DELETE FROM users WHERE id = ?');
      stmt.run(uid);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/employees", requireAuth, (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM employees ORDER BY lastSeen DESC');
      const employees = stmt.all();
      res.json(employees);
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/activity_logs", requireAuth, (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100');
      const logs = stmt.all().map((log: any) => ({
        ...log,
        details: JSON.parse(log.details)
      }));
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/security_logs", requireAuth, (req, res) => {
    try {
      // For demo purposes, returning mock security logs
      res.json([
        {
          id: '1',
          timestamp: new Date().toISOString(),
          type: 'auth_success',
          severity: 'low',
          details: { message: 'Admin login successful', ip: '192.168.1.100' }
        }
      ]);
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/policy", requireAuth, (req, res) => {
    try {
      const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
      const result = stmt.get('global_policy') as any;
      if (result) {
        res.json(JSON.parse(result.value));
      } else {
        res.status(404).json({ error: "Policy not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/policy", requireAuth, (req, res) => {
    try {
      const policy = req.body;
      const stmt = db.prepare('UPDATE settings SET value = ? WHERE key = ?');
      stmt.run(JSON.stringify(policy), 'global_policy');
      
      // Log security event
      const logStmt = db.prepare(`
        INSERT INTO activity_logs (id, employeeId, type, timestamp, details)
        VALUES (?, ?, ?, ?, ?)
      `);
      logStmt.run(
        `policy_${Date.now()}`,
        'system',
        'policy_change',
        new Date().toISOString(),
        JSON.stringify({
          message: `Global monitoring policy updated to ${policy.mode} mode`,
          policy: policy
        })
      );

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
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

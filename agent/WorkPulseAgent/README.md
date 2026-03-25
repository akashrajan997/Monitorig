# WorkPulse Enterprise Agent (C# / .NET)

This is the source code for the Windows Agent that runs on employee laptops and reports telemetry back to the WorkPulse Node.js backend.

## Why C#?
C# is the industry standard for Windows agents because it provides deep, native integration with Windows APIs (Win32, UI Automation, WMI) without requiring heavy runtimes like Node.js or Python to be installed on the target machines.

## Features Implemented
1. **Active Window Tracking:** Uses `GetForegroundWindow` to see what application the user is currently looking at.
2. **Browser Tab Tracking:** Uses `UIAutomationClient` to read the address bar of Chrome, Edge, and Firefox to see what website the user is on. *(Note: This is the most reliable way to do this without forcing users to install a Chrome Extension).*
3. **Idle Time / Active Time:** Uses `GetLastInputInfo` to track keyboard and mouse movement. If the user steps away, the agent knows exactly how long they've been idle.
4. **Live Location:** Uses IP-based geolocation. *(Note: Native Windows GPS/Location APIs require the user to explicitly click "Allow" in Windows Settings, which defeats the purpose of a silent Intune deployment. IP-based location works silently).*

## How to Compile and Deploy via Intune

### 1. Compile the Agent
You will need the .NET 8 SDK installed on your developer machine.

Open a terminal in this folder (`/agent/WorkPulseAgent/`) and run:
```bash
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
```
This will generate a single `.exe` file in `bin/Release/net8.0-windows/win-x64/publish/WorkPulseAgent.exe`.

### 2. Configure the Backend URL
Before compiling, open `Program.cs` and ensure the `BaseAddress` points to your deployed Node.js backend URL.

### 3. Deploy via Microsoft Intune
To deploy this as a background service via Intune:

1. Download the **Microsoft Win32 Content Prep Tool** (`IntuneWinAppUtil.exe`).
2. Package the `WorkPulseAgent.exe` into an `.intunewin` file.
3. Upload the `.intunewin` file to the Microsoft Endpoint Manager admin center.
4. Set the **Install command** to:
   ```cmd
   sc create "WorkPulseAgent" binpath= "%ProgramFiles%\WorkPulse\WorkPulseAgent.exe" start= auto
   sc start "WorkPulseAgent"
   ```
5. Set the **Uninstall command** to:
   ```cmd
   sc stop "WorkPulseAgent"
   sc delete "WorkPulseAgent"
   ```

### Important Note on "Session 0" Isolation
Windows Services run in "Session 0" (the system session), which means they cannot normally see the UI of the user logged in (Session 1+). 

To make the **Browser Tab Tracking** (UI Automation) work, the agent must be deployed to run in the **User Context** rather than the System Context, or you must use a helper process that runs in the user's session and communicates with the main service via Named Pipes. For this prototype, compiling it as a standard executable and running it via a Logon Task Scheduler task is the easiest way to ensure it has access to the user's UI.

# Microsoft Intune Deployment Guide

This guide explains how to deploy the WorkPulse Windows Agent using Microsoft Endpoint Manager (Intune).

## 1. Package the Agent
The agent is a C# Windows Service. You must package it as a `.intunewin` file using the [Microsoft Win32 Content Prep Tool](https://github.com/microsoft/Microsoft-Win32-Content-Prep-Tool).

**Source Folder:** `bin/Release/net8.0/publish`
**Setup File:** `WorkPulseAgent.exe`
**Output Folder:** `dist/`

## 2. Intune App Configuration

### Program
*   **Install command:** `WorkPulseAgent.exe --install --api-url "https://your-api.run.app"`
*   **Uninstall command:** `WorkPulseAgent.exe --uninstall`
*   **Install behavior:** System

### Detection Rules
*   **Rule type:** File
*   **Path:** `%ProgramData%\WorkPulse`
*   **File or folder:** `config.json`
*   **Detection method:** File or folder exists

### Assignment
*   Assign to **All Devices** or a specific **Device Group** (e.g., "Remote Workers").

## 3. Simulation Script (Test Connection)
If you want to test the connection immediately without installing the full agent, run this PowerShell script. It will register your device and send a sample activity event.

```powershell
# WorkPulse Connection Test
$ApiUrl = "https://ais-dev-dcqtpiorrosbnvxelksfzi-35471052083.asia-east1.run.app"
$DeviceId = [guid]::NewGuid().ToString()

$Payload = @{
    deviceId = $DeviceId
    timestamp = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
    events = @(
        @{
            type = "app_switch"
            timestamp = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
            details = @{ WindowTitle = "PowerShell - Connection Test" }
        }
    )
}

$Json = $Payload | ConvertTo-Json -Depth 10
Invoke-RestMethod -Uri "$ApiUrl/api/v1/agent/ingest" -Method Post -Body $Json -ContentType "application/json"

Write-Host "Successfully sent test event for Device: $DeviceId"
Write-Host "Check your dashboard now!"
```

## 4. Security Best Practices
*   **Certificate Pinning:** Ensure the agent validates the SSL certificate of the API.
*   **Azure AD Auth:** Use the device's Azure AD identity for authentication instead of a static token.
*   **Data Minimization:** Only enable "Investigation Mode" when strictly necessary.
*   **User Transparency:** The agent is configured to show a "Monitoring Active" notification on user login by default.

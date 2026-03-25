import time
import requests
import json
import platform
import subprocess
import datetime
import os

# Configuration
API_BASE_URL = "https://ais-dev-dcqtpiorrosbnvxelksfzi-35471052083.asia-east1.run.app"
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

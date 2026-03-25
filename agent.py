import time
import requests
from requests.exceptions import RequestException, Timeout, ConnectionError
import platform
import subprocess
import datetime
import os
import logging
from logging.handlers import RotatingFileHandler

# Configure logging to both console and file
log_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
log_file = 'workpulse_agent.log'

# Use a rotating file handler to prevent the log file from growing indefinitely (max 5MB, keep 2 backups)
file_handler = RotatingFileHandler(log_file, maxBytes=5*1024*1024, backupCount=2)
file_handler.setFormatter(log_formatter)

console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)

logger = logging.getLogger('WorkPulseAgent')
logger.setLevel(logging.INFO)
logger.addHandler(file_handler)
logger.addHandler(console_handler)

class WorkPulseAgent:
    """
    Enterprise Monitoring Agent for WorkPulse.
    Captures active window, idle time, and sends telemetry to the backend.
    """
    def __init__(self, api_base_url: str):
        self.api_base_url = api_base_url
        self.device_id = f"{platform.node()}-{platform.processor()[:10].replace(' ', '')}"
        self.agent_version = "1.0.1"
        
        # State variables
        self.last_window = ""
        self.last_heartbeat = 0
        self.policy = {"heartbeatInterval": 60}
        
        # Buffer for graceful recovery from transient network errors
        self.event_buffer = []  
        self.max_buffer_size = 1000
        
        logger.info(f"WorkPulse Agent v{self.agent_version} initializing...")
        logger.info(f"Device ID: {self.device_id}")

    def get_active_window(self) -> str:
        """Returns the title of the active window based on OS."""
        try:
            system = platform.system()
            if system == "Windows":
                try:
                    import pygetwindow as gw
                    window = gw.getActiveWindow()
                    return window.title if window else "Desktop"
                except ImportError:
                    logger.error("pygetwindow module not found. Please install it (pip install pygetwindow).")
                except Exception as e:
                    logger.warning(f"Windows window capture error: {e}")
            elif system == "Darwin":  # macOS
                try:
                    script = 'tell application "System Events" to get name of first process whose frontmost is true'
                    return subprocess.check_output(['osascript', '-e', script], timeout=2).decode('utf-8').strip()
                except subprocess.TimeoutExpired:
                    logger.warning("macOS window capture timed out.")
                except subprocess.CalledProcessError as e:
                    logger.warning(f"macOS window capture failed: {e}")
            elif system == "Linux":
                try:
                    return subprocess.check_output(['xdotool', 'getactivewindow', 'getwindowname'], timeout=2).decode('utf-8').strip()
                except FileNotFoundError:
                    logger.error("xdotool not installed. Cannot get active window on Linux.")
                except subprocess.TimeoutExpired:
                    logger.warning("Linux window capture timed out.")
                except subprocess.CalledProcessError as e:
                    logger.warning(f"Linux window capture failed: {e}")
        except Exception as e:
            logger.error(f"Unexpected error in get_active_window: {e}", exc_info=True)
        return "Unknown"

    def fetch_policy(self) -> None:
        """Fetches the latest monitoring policy from the server."""
        try:
            headers = {"x-device-id": self.device_id}
            response = requests.get(f"{self.api_base_url}/api/v1/agent/policy", headers=headers, timeout=10)
            response.raise_for_status()
            self.policy = response.json()
            logger.debug("Policy updated successfully.")
        except Timeout:
            logger.warning("Timeout fetching policy. Will retry later.")
        except ConnectionError:
            logger.warning("Connection error fetching policy. Check network.")
        except RequestException as e:
            logger.error(f"Network error fetching policy: {e}")
        except Exception as e:
            logger.error(f"Unexpected error fetching policy: {e}", exc_info=True)

    def ingest_events(self, events: list) -> bool:
        """Sends a batch of events to the enterprise ingestion endpoint."""
        if not events:
            return True
            
        try:
            payload = {
                "deviceId": self.device_id,
                "timestamp": datetime.datetime.now().isoformat(),
                "events": events
            }
            response = requests.post(f"{self.api_base_url}/api/v1/agent/ingest", json=payload, timeout=10)
            response.raise_for_status()
            logger.info(f"Successfully ingested {len(events)} events.")
            return True
        except Timeout:
            logger.warning("Timeout ingesting events. Will buffer and retry.")
        except ConnectionError:
            logger.warning("Connection error ingesting events. Will buffer and retry.")
        except RequestException as e:
            logger.error(f"Network error ingesting events: {e}")
        except Exception as e:
            logger.error(f"Unexpected error ingesting events: {e}", exc_info=True)
        return False

    def capture_app_switch_event(self, current_window: str) -> dict:
        """Captures an app switch event if the window has changed."""
        if current_window != self.last_window and current_window != "Unknown":
            logger.info(f"App Switch: {current_window}")
            app_name = current_window.split(" - ")[-1] if " - " in current_window else current_window
            event = {
                "type": "app_switch",
                "timestamp": datetime.datetime.now().isoformat(),
                "details": {
                    "WindowTitle": current_window,
                    "appName": app_name
                }
            }
            self.last_window = current_window
            return event
        return None

    def capture_heartbeat_event(self, current_time: float) -> dict:
        """Captures a heartbeat event if the interval has passed."""
        interval = self.policy.get("heartbeatInterval", 60)
        if current_time - self.last_heartbeat > interval:
            event = {
                "type": "heartbeat",
                "timestamp": datetime.datetime.now().isoformat(),
                "details": {"status": "online"}
            }
            self.last_heartbeat = current_time
            self.fetch_policy()  # Refresh policy on heartbeat
            return event
        return None

    def run(self):
        """Main loop for the agent."""
        self.fetch_policy()
        logger.info("Agent active. Monitoring started.")
        
        while True:
            try:
                current_time = time.time()
                current_window = self.get_active_window()
                
                # 1. Detect App Switch
                app_switch_event = self.capture_app_switch_event(current_window)
                if app_switch_event:
                    self.event_buffer.append(app_switch_event)
                
                # 2. Heartbeat
                heartbeat_event = self.capture_heartbeat_event(current_time)
                if heartbeat_event:
                    self.event_buffer.append(heartbeat_event)
                
                # 3. Send Batch
                if self.event_buffer:
                    success = self.ingest_events(self.event_buffer)
                    if success:
                        self.event_buffer.clear()  # Clear buffer on successful ingestion
                    else:
                        # Prevent buffer from growing indefinitely during extended outages
                        if len(self.event_buffer) > self.max_buffer_size:
                            logger.error(f"Event buffer exceeded {self.max_buffer_size} items. Dropping oldest events.")
                            self.event_buffer = self.event_buffer[-self.max_buffer_size:]
                    
                time.sleep(2)  # Poll every 2 seconds
                
            except KeyboardInterrupt:
                logger.info("Agent stopping gracefully...")
                break
            except Exception as e:
                logger.error(f"Critical runtime error in main loop: {e}", exc_info=True)
                time.sleep(5)  # Backoff on critical error

if __name__ == "__main__":
    # Configuration
    API_BASE_URL = os.getenv("WORKPULSE_API_URL", "https://ais-dev-dcqtpiorrosbnvxelksfzi-35471052083.asia-east1.run.app")
    
    # Ensure dependencies are installed for the user
    # Note: In a real production agent, these would be bundled.
    # pip install requests pygetwindow
    
    agent = WorkPulseAgent(api_base_url=API_BASE_URL)
    agent.run()

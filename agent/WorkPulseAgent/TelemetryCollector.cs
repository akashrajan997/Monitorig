using System;
using System.Diagnostics;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Automation;

namespace WorkPulseAgent
{
    public class TelemetryCollector
    {
        // ==========================================
        // Win32 API Imports
        // ==========================================
        [DllImport("user32.dll")]
        static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

        [DllImport("user32.dll", SetLastError = true)]
        static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

        [StructLayout(LayoutKind.Sequential)]
        struct LASTINPUTINFO
        {
            public uint cbSize;
            public uint dwTime;
        }

        public class ActiveWindowInfo
        {
            public string Title { get; set; } = string.Empty;
            public string ProcessName { get; set; } = string.Empty;
            public string BrowserUrl { get; set; } = string.Empty;
        }

        public class LocationInfo
        {
            public double Latitude { get; set; }
            public double Longitude { get; set; }
            public string City { get; set; } = string.Empty;
        }

        // ==========================================
        // Active Window & Browser Tabs
        // ==========================================
        public ActiveWindowInfo GetActiveWindow()
        {
            var info = new ActiveWindowInfo();
            try
            {
                IntPtr handle = GetForegroundWindow();
                if (handle == IntPtr.Zero) return info;

                // Get Window Title
                StringBuilder sb = new StringBuilder(256);
                if (GetWindowText(handle, sb, 256) > 0)
                {
                    info.Title = sb.ToString();
                }

                // Get Process Name
                GetWindowThreadProcessId(handle, out uint pid);
                if (pid > 0)
                {
                    Process p = Process.GetProcessById((int)pid);
                    info.ProcessName = p.ProcessName;

                    // If it's a browser, try to get the URL using UI Automation
                    if (IsBrowser(info.ProcessName))
                    {
                        info.BrowserUrl = GetBrowserUrl(handle, info.ProcessName);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting active window: {ex.Message}");
            }

            return info;
        }

        private bool IsBrowser(string processName)
        {
            string lower = processName.ToLower();
            return lower.Contains("chrome") || lower.Contains("msedge") || lower.Contains("firefox") || lower.Contains("brave");
        }

        // Uses UI Automation to read the address bar of the active browser
        // Note: This requires the agent to run in the user session, not Session 0 (SYSTEM).
        private string GetBrowserUrl(IntPtr hwnd, string processName)
        {
            try
            {
                AutomationElement root = AutomationElement.FromHandle(hwnd);
                
                // Chrome/Edge usually expose the address bar as an "Edit" control named "Address and search bar"
                Condition condition = new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit);
                AutomationElementCollection edits = root.FindAll(TreeScope.Descendants, condition);

                foreach (AutomationElement edit in edits)
                {
                    string name = edit.Current.Name.ToLower();
                    if (name.Contains("address") || name.Contains("search"))
                    {
                        // Get the value pattern (the text inside the address bar)
                        if (edit.TryGetCurrentPattern(ValuePattern.Pattern, out object patternObj))
                        {
                            ValuePattern valPattern = (ValuePattern)patternObj;
                            string url = valPattern.Current.Value;
                            
                            // Basic cleanup
                            if (!string.IsNullOrEmpty(url) && !url.StartsWith("http"))
                            {
                                url = "https://" + url;
                            }
                            return url;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"UI Automation failed: {ex.Message}");
            }
            return string.Empty;
        }

        // ==========================================
        // Idle Time Calculation
        // ==========================================
        public int GetIdleTimeSeconds()
        {
            LASTINPUTINFO lastInput = new LASTINPUTINFO();
            lastInput.cbSize = (uint)Marshal.SizeOf(lastInput);
            lastInput.dwTime = 0;

            if (GetLastInputInfo(ref lastInput))
            {
                // Environment.TickCount is the time since boot in milliseconds
                int idleTimeMs = Environment.TickCount - (int)lastInput.dwTime;
                return Math.Max(0, idleTimeMs / 1000);
            }
            return 0;
        }

        // ==========================================
        // Location Tracking
        // ==========================================
        // Note: Native Windows Location API (Windows.Devices.Geolocation) requires the user 
        // to explicitly grant "Location" permissions in Windows Settings. 
        // For a silent Intune agent, IP-based geolocation is much more reliable.
        public async Task<LocationInfo> GetApproximateLocationAsync()
        {
            var loc = new LocationInfo();
            try
            {
                using var client = new HttpClient();
                // Using a free IP geolocation API for the prototype
                var response = await client.GetStringAsync("https://ipapi.co/json/");
                using JsonDocument doc = JsonDocument.Parse(response);
                var root = doc.RootElement;

                if (root.TryGetProperty("latitude", out var lat) && root.TryGetProperty("longitude", out var lng))
                {
                    loc.Latitude = lat.GetDouble();
                    loc.Longitude = lng.GetDouble();
                }
                if (root.TryGetProperty("city", out var city))
                {
                    loc.City = city.GetString() ?? "";
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Location fetch failed: {ex.Message}");
            }
            return loc;
        }
    }
}

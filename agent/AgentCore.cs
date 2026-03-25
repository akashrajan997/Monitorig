using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Net.Http;
using System.Text.Json;

namespace WorkPulse.Agent
{
    /// <summary>
    /// Core logic for the Windows Service Agent.
    /// Handles Activity Tracking, Policy Sync, and Batch Uploads.
    /// </summary>
    public class AgentCore
    {
        private readonly HttpClient _httpClient;
        private AgentPolicy _currentPolicy;
        private readonly List<ActivityEvent> _eventQueue = new List<ActivityEvent>();
        private readonly string _deviceId = Guid.NewGuid().ToString();

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

        public AgentCore()
        {
            _httpClient = new HttpClient { BaseAddress = new Uri("https://your-api-url.run.app") };
            _httpClient.DefaultRequestHeaders.Add("X-Device-ID", _deviceId);
        }

        public async Task StartAsync()
        {
            // 1. Initial Policy Sync
            await SyncPolicyAsync();

            // 2. Start Monitoring Loop
            _ = Task.Run(MonitoringLoop);

            // 3. Start Batch Upload Loop
            _ = Task.Run(UploadLoop);
        }

        private async Task MonitoringLoop()
        {
            while (true)
            {
                if (_currentPolicy?.Modules.ActivityTracking == true)
                {
                    CaptureActivity();
                }

                await Task.Delay(5000); // Check every 5 seconds
            }
        }

        private void CaptureActivity()
        {
            IntPtr handle = GetForegroundWindow();
            StringBuilder title = new StringBuilder(256);
            if (GetWindowText(handle, title, 256) > 0)
            {
                _eventQueue.Add(new ActivityEvent
                {
                    Timestamp = DateTime.UtcNow,
                    Type = "app_switch",
                    Details = new { WindowTitle = title.ToString() }
                });
            }
        }

        private async Task SyncPolicyAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync("/api/v1/agent/policy");
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadAsStringAsync();
                    _currentPolicy = JsonSerializer.Deserialize<AgentPolicy>(json);
                }
            }
            catch (Exception ex)
            {
                // Log to Windows Event Log
            }
        }

        private async Task UploadLoop()
        {
            while (true)
            {
                if (_eventQueue.Count > 0)
                {
                    var batch = new { DeviceId = _deviceId, Events = _eventQueue.ToArray() };
                    var content = new StringContent(JsonSerializer.Serialize(batch), Encoding.UTF8, "application/json");
                    
                    var response = await _httpClient.PostAsync("/api/v1/agent/ingest", content);
                    if (response.IsSuccessStatusCode)
                    {
                        _eventQueue.Clear();
                    }
                }

                await Task.Delay(30000); // Batch every 30 seconds
            }
        }
    }

    public class AgentPolicy
    {
        public string Mode { get; set; }
        public ModulesConfig Modules { get; set; }
    }

    public class ModulesConfig
    {
        public bool ActivityTracking { get; set; }
        public bool Screenshot { get; set; }
    }

    public class ActivityEvent
    {
        public DateTime Timestamp { get; set; }
        public string Type { get; set; }
        public object Details { get; set; }
    }
}

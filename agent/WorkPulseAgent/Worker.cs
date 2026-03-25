using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace WorkPulseAgent
{
    public class Worker : BackgroundService
    {
        private readonly ILogger<Worker> _logger;
        private readonly TelemetryCollector _telemetry;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string _deviceId;

        public Worker(ILogger<Worker> logger, TelemetryCollector telemetry, IHttpClientFactory httpClientFactory)
        {
            _logger = logger;
            _telemetry = telemetry;
            _httpClientFactory = httpClientFactory;
            _deviceId = Environment.MachineName;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("WorkPulse Agent starting at: {time}", DateTimeOffset.Now);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    // Collect all telemetry data
                    var activeWindow = _telemetry.GetActiveWindow();
                    var idleTime = _telemetry.GetIdleTimeSeconds();
                    var location = await _telemetry.GetApproximateLocationAsync();
                    
                    // Total active time in this 60s window
                    var activeTimeInWindow = Math.Max(0, 60 - idleTime);

                    // Build the payload matching the Node.js backend
                    var payload = new
                    {
                        deviceId = _deviceId,
                        timestamp = DateTime.UtcNow.ToString("o"),
                        events = new object[]
                        {
                            new { 
                                type = "active_window", 
                                title = activeWindow.Title, 
                                process = activeWindow.ProcessName,
                                browserUrl = activeWindow.BrowserUrl // Will be populated if it's a browser
                            },
                            new { 
                                type = "activity_metrics", 
                                idleTimeSeconds = idleTime, 
                                activeTimeSeconds = activeTimeInWindow 
                            },
                            new {
                                type = "location",
                                lat = location.Latitude,
                                lng = location.Longitude,
                                city = location.City
                            }
                        }
                    };

                    // Send to Node.js backend
                    var client = _httpClientFactory.CreateClient("WorkPulseApi");
                    
                    // Add the required header
                    client.DefaultRequestHeaders.Remove("x-device-id");
                    client.DefaultRequestHeaders.Add("x-device-id", _deviceId);

                    var response = await client.PostAsJsonAsync("api/v1/agent/ingest", payload, stoppingToken);
                    
                    if (response.IsSuccessStatusCode)
                    {
                        _logger.LogInformation("Successfully sent telemetry for {Device}", _deviceId);
                    }
                    else
                    {
                        _logger.LogWarning("Failed to send telemetry. Status: {Status}", response.StatusCode);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error collecting or sending telemetry");
                }

                // Wait 60 seconds before next collection
                await Task.Delay(60000, stoppingToken);
            }
        }
    }
}

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System;

namespace WorkPulseAgent
{
    public class Program
    {
        public static void Main(string[] args)
        {
            CreateHostBuilder(args).Build().Run();
        }

        public static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args)
                .UseWindowsService(options =>
                {
                    options.ServiceName = "WorkPulse Enterprise Agent";
                })
                .ConfigureServices((hostContext, services) =>
                {
                    services.AddSingleton<TelemetryCollector>();
                    services.AddHostedService<Worker>();
                    
                    // Configure HTTP Client for sending data to the Node.js backend
                    services.AddHttpClient("WorkPulseApi", client =>
                    {
                        // Replace this with your actual deployed Node.js backend URL
                        client.BaseAddress = new Uri("https://ais-dev-dcqtpiorrosbnvxelksfzi-35471052083.asia-east1.run.app/");
                        client.DefaultRequestHeaders.Add("User-Agent", "WorkPulse-Windows-Agent/1.0");
                    });
                });
    }
}

using Memtly.Core;
using Memtly.Core.Enums;
using Microsoft.AspNetCore;

namespace Memtly.Community
{
    public class Program
    {
        public static void Main(string[] args)
        {
            MemtlyCore.Version = MemtlyVersion.Community;
            CreateWebHostBuilder(args).Build().Run();
        }

        public static IWebHostBuilder CreateWebHostBuilder(string[] args) =>
            WebHost.CreateDefaultBuilder(args)
                .UseKestrel()
                .UseIISIntegration()
                .UseIIS()
                .UseContentRoot(Directory.GetCurrentDirectory())
                .UseStartup<Startup>()
                .UseUrls("http://*:5000");
    }
}
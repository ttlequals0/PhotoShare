using Microsoft.Extensions.Localization;
using Memtly.Core.Constants;
using Memtly.Core.Helpers;

namespace Memtly.Core.Configurations
{
    public static class FfmpegConfiguration
    {
        public static void AddFfmpegConfiguration(this IServiceCollection services)
        {
            var bsp = services.BuildServiceProvider();
            var config = bsp.GetRequiredService<IConfigHelper>();
            var localizer = bsp.GetRequiredService<IStringLocalizer<Localization.Translations>>();
            var loggerFactory = bsp.GetRequiredService<ILoggerFactory>();

            // Default lives under /app so the chiseled non-root user (uid
            // 1654) can write the auto-downloaded ffmpeg binary. Upstream's
            // "/ffmpeg" requires root and breaks on chiseled images.
            var ffmpegPath = config.GetOrDefault(FFMPEG.InstallPath, "/app/ffmpeg");

            var downloaded = new ImageHelper(new FileHelper(loggerFactory.CreateLogger<FileHelper>()), loggerFactory.CreateLogger<ImageHelper>(), localizer).DownloadFFMPEG(ffmpegPath).Result;
            if (!downloaded)
            {
                loggerFactory.CreateLogger<FFMPEG>().LogWarning($"{localizer["FFMPEG_Download_Failed"].Value} '{ffmpegPath}'");
            }
        }
    }
}
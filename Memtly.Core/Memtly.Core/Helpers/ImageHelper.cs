using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Localization;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using Memtly.Core.Enums;
using Xabe.FFmpeg;
using Xabe.FFmpeg.Downloader;

namespace Memtly.Core.Helpers
{
    public interface IImageHelper
    {
        Task<bool> GenerateThumbnail(string filePath, string savePath, int size = 720);
        Task<ImageOrientation> GetOrientation(string path);
        ImageOrientation GetOrientation(Image img);
        MediaType GetMediaType(string filePath);
        Task<bool> ContentMatchesExtension(string filePath);
        Task<bool> DownloadFFMPEG(string path);
    }

    public class ImageHelper : IImageHelper
    {
        private readonly IFileHelper _fileHelper;
        private readonly ILogger _logger;
        private readonly IStringLocalizer<Localization.Translations> _localizer;

        private static bool FfmpegInstalled = false;

        public ImageHelper(IFileHelper fileHelper, ILogger<ImageHelper> logger, IStringLocalizer<Localization.Translations> localizer)
        {
            _fileHelper = fileHelper;
            _logger = logger;
            _localizer = localizer;
        }

        public async Task<bool> GenerateThumbnail(string filePath, string savePath, int size = 720)
        {
            if (_fileHelper.FileExists(filePath))
            { 
                try
                {
                    var mediaType = GetMediaType(filePath);
                    if (mediaType == MediaType.Image || mediaType == MediaType.Video)
                    {
                        var filename = Path.GetFileName(filePath);
                        var ext = Path.GetExtension(filePath)?.TrimStart('.')?.ToLowerInvariant();

                        // ffmpeg handles two cases here: extracting a frame
                        // from video, and decoding HEIC/HEIF stills (which
                        // ImageSharp's default codec set can't read). In
                        // both cases ffmpeg writes a JPEG to savePath that
                        // the ImageSharp block below then resizes.
                        var needsFfmpegDecode = mediaType == MediaType.Video
                            || ext is "heic" or "heif";

                        if (needsFfmpegDecode)
                        {
                            if (FfmpegInstalled == false)
                            {
                                _logger.LogWarning(_localizer["FFMPEG_Downloading"].Value);
                                return false;
                            }

                            var conversion = await FFmpeg.Conversions.FromSnippet.Snapshot(filePath, savePath, TimeSpan.FromSeconds(0));
                            await conversion.Start();
                            filePath = savePath;
                        }

                        using (var img = await Image.LoadAsync(filePath))
                        {
                            var width = 0;
                            var height = 0;

                            var orientation = this.GetOrientation(img);
                            if (orientation == ImageOrientation.Square)
                            {
                                width = size;
                                height = size;
                            }
                            else if (orientation == ImageOrientation.Landscape)
                            {
                                var scale = (decimal)size / (decimal)img.Width;
                                width = (int)((decimal)img.Width * scale);
                                height = (int)((decimal)img.Height * scale);
                            }
                            else if (orientation == ImageOrientation.Portrait)
                            {
                                var scale = (decimal)size / (decimal)img.Height;
                                width = (int)((decimal)img.Width * scale);
                                height = (int)((decimal)img.Height * scale);
                            }

                            img.Mutate(x =>
                            {
                                x.Resize(width, height);
                                x.AutoOrient();
                            });

                            await img.SaveAsWebpAsync(savePath);
                        }
                    }

                    return true;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, $"Failed to generate thumbnail - '{filePath}'");
                }
            }

            return false;
        }

        // Read the first 16 bytes of the file and verify the container
        // signature matches the claimed extension. Default allowed video
        // extensions in PhotoShare are .mp4 and .mov - both ISO Base Media
        // (QuickTime) which place a 4-byte 'ftyp' marker at offset 4.
        // .webm starts with EBML header bytes 1A 45 DF A3.
        // .avi starts with 'RIFF' ... 'AVI '.
        // Operators who widen Allowed_File_Types to additional video formats
        // should extend this match table.
        private static async Task<bool> VideoHeaderMatchesExtension(string filePath, string ext)
        {
            try
            {
                var info = new FileInfo(filePath);
                if (!info.Exists || info.Length < 16)
                {
                    return false;
                }

                var head = new byte[16];
                using (var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    var read = await fs.ReadAsync(head.AsMemory(0, 16));
                    if (read < 16)
                    {
                        return false;
                    }
                }

                switch (ext)
                {
                    case "mp4":
                    case "mov":
                    case "m4v":
                    case "m4a":
                        // bytes 4..7 == "ftyp" (66 74 79 70)
                        return head[4] == 0x66 && head[5] == 0x74 && head[6] == 0x79 && head[7] == 0x70;
                    case "webm":
                    case "mkv":
                        // EBML header magic 1A 45 DF A3
                        return head[0] == 0x1A && head[1] == 0x45 && head[2] == 0xDF && head[3] == 0xA3;
                    case "avi":
                        // 'RIFF' ... 'AVI '
                        return head[0] == 0x52 && head[1] == 0x49 && head[2] == 0x46 && head[3] == 0x46
                            && head[8] == 0x41 && head[9] == 0x56 && head[10] == 0x49 && head[11] == 0x20;
                    default:
                        return false;
                }
            }
            catch
            {
                return false;
            }
        }

        // HEIC/HEIF still images share the ISOBMFF container with MP4/MOV.
        // Bytes 4..7 == "ftyp" and bytes 8..11 carry the major brand. The
        // brands below cover Apple's iOS HEIC output, multi-image HEIF
        // sequences (.heif), and the burst-photo sequence brands. Anything
        // else gets rejected so a malicious upload can't hide behind a
        // .heic extension.
        private static async Task<bool> HeifHeaderMatchesExtension(string filePath)
        {
            try
            {
                var info = new FileInfo(filePath);
                if (!info.Exists || info.Length < 12)
                {
                    return false;
                }

                var head = new byte[12];
                using (var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    var read = await fs.ReadAsync(head.AsMemory(0, 12));
                    if (read < 12)
                    {
                        return false;
                    }
                }

                // bytes 4..7 == "ftyp"
                if (!(head[4] == 0x66 && head[5] == 0x74 && head[6] == 0x79 && head[7] == 0x70))
                {
                    return false;
                }

                // brand at bytes 8..11
                var brand = System.Text.Encoding.ASCII.GetString(head, 8, 4);
                return brand is "heic" or "heix" or "heim" or "heis"
                            or "hevc" or "hevx" or "mif1" or "msf1";
            }
            catch
            {
                return false;
            }
        }

        public MediaType GetMediaType(string path)
        {
            try
            {
                // HEIC/HEIF aren't in the default FileExtensionContentTypeProvider
                // map yet, so route them manually before the provider lookup.
                var ext = Path.GetExtension(path)?.TrimStart('.')?.ToLowerInvariant();
                if (ext is "heic" or "heif")
                {
                    return MediaType.Image;
                }

                var provider = new FileExtensionContentTypeProvider();
                if (provider.TryGetContentType(path, out string? contentType))
                {
                    if (contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                    {
                        return MediaType.Image;
                    }
                    else if (contentType.StartsWith("video/", StringComparison.OrdinalIgnoreCase))
                    {
                        return MediaType.Video;
                    }
                }
            }
            catch { }

            return MediaType.Unknown;
        }

        // Reject content whose magic bytes don't match the claimed extension.
        // Images: ImageSharp's IdentifyAsync reads only headers and resolves
        // the actual format. Videos: deferred (would require ffprobe), trust
        // extension + size limit.
        public async Task<bool> ContentMatchesExtension(string filePath)
        {
            try
            {
                var ext = Path.GetExtension(filePath)?.TrimStart('.')?.ToLowerInvariant();
                if (string.IsNullOrEmpty(ext))
                {
                    return false;
                }

                var mediaType = GetMediaType(filePath);
                if (mediaType == MediaType.Image)
                {
                    // HEIC/HEIF files use the ISOBMFF container with an
                    // ftyp box and a brand identifying the heif family.
                    // ImageSharp's default codec set returns null for them,
                    // so do a magic-byte check instead - same pattern as
                    // VideoHeaderMatchesExtension.
                    if (ext is "heic" or "heif")
                    {
                        return await HeifHeaderMatchesExtension(filePath);
                    }

                    try
                    {
                        var info = await Image.IdentifyAsync(filePath);
                        if (info == null)
                        {
                            return false;
                        }
                        var format = info.Metadata.DecodedImageFormat;
                        if (format == null)
                        {
                            return false;
                        }
                        // jpg/jpeg are aliases; treat them as equivalent
                        var formatExtensions = format.FileExtensions.Select(e => e.ToLowerInvariant()).ToList();
                        if (string.Equals(ext, "jpg", StringComparison.OrdinalIgnoreCase))
                        {
                            return formatExtensions.Contains("jpg") || formatExtensions.Contains("jpeg");
                        }
                        return formatExtensions.Contains(ext);
                    }
                    catch
                    {
                        return false;
                    }
                }

                if (mediaType == MediaType.Video)
                {
                    return await VideoHeaderMatchesExtension(filePath, ext);
                }

                return false;
            }
            catch
            {
                return false;
            }
        }

        public async Task<ImageOrientation> GetOrientation(string path)
        {
            var orientation = ImageOrientation.Unknown;

            if (_fileHelper.FileExists(path))
            {
                try
                {
                    using (var img = await Image.LoadAsync(path))
                    {
                        orientation = this.GetOrientation(img);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, $"Failed to get image orientation- '{path}'");
                }
            }

            return orientation;
        }

        public ImageOrientation GetOrientation(Image img)
        {
            if (img != null)
            {
                if (img.Width > img.Height)
                {
                    return ImageOrientation.Landscape;
                }
                else if (img.Width < img.Height)
                {
                    return ImageOrientation.Portrait;
                }
                else if (img.Width == img.Height)
                {
                    return ImageOrientation.Square;
                }
            }

            return ImageOrientation.Unknown;
        }

        public async Task<bool> DownloadFFMPEG(string path)
        {
            try
            {
                if (!_fileHelper.DirectoryExists(path))
                {
                    _fileHelper.CreateDirectoryIfNotExists(path);
                    await FFmpegDownloader.GetLatestVersion(FFmpegVersion.Official, path);
                }

                FFmpeg.SetExecutablesPath(path);
                FfmpegInstalled = true;

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, $"Failed to download FFmpeg - '{path}'");
            }

            return false;
        }
    }
}
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Memtly.Core.Helpers
{
    public interface IFileHelper
    {
        bool DirectoryExists(string path);
        bool CreateDirectoryIfNotExists(string path);
        bool MoveDirectoryIfExists(string path, string newPath);
        bool DeleteDirectoryIfExists(string path, bool recursive = true);
        bool PurgeDirectory(string path);
        string[] GetDirectories(string path, string pattern = "*", SearchOption searchOption = SearchOption.AllDirectories);
        string[] GetFiles(string path, string pattern = "*.*", SearchOption searchOption = SearchOption.AllDirectories);
        bool FileExists(string path);
        long FileSize(string path);
        bool DeleteFileIfExists(string path);
        bool MoveFileIfExists(string source, string destination);
        long GetDirectorySize(string path);
        Task<byte[]> ReadAllBytes(string path);
        Task SaveFile(IFormFile file, string path, FileMode mode);
        Task<string> GetChecksum(string path);
        Task<DateTime> GetCreationDatetime(string path);
        string BytesToHumanReadable(long bytes, int decimalPlaces = 0);
        string SanitizeFilename(string filename);
        void SafeExtractZip(string zipPath, string targetDir, bool overwrite);
    }

    public class FileHelper : IFileHelper
    {
        private readonly ILogger<FileHelper> _logger;

        public FileHelper(ILogger<FileHelper> logger)
        {
            _logger = logger;
        }

        public bool DirectoryExists(string path)
        {
            return Directory.Exists(path);
        }

        public bool CreateDirectoryIfNotExists(string path)
        {
            if (!DirectoryExists(path))
            { 
                Directory.CreateDirectory(path);

                return true;
            }
                
            return false;
        }

        public bool MoveDirectoryIfExists(string path, string newPath)
        {
            if (DirectoryExists(path))
            {
                Directory.Move(path, newPath);

                return true;
            }

            return false;
        }

        public bool DeleteDirectoryIfExists(string path, bool recursive = true)
        {
            if (DirectoryExists(path))
            {
                Directory.Delete(path, recursive);

                return true;
            }

            return false;
        }

        public bool PurgeDirectory(string path)
        {
            DeleteDirectoryIfExists(path);
            return CreateDirectoryIfNotExists(path);
        }

        public string[] GetDirectories(string path, string pattern = "*", SearchOption searchOption = SearchOption.AllDirectories)
        {
            return Directory.GetDirectories(path, pattern, searchOption);
        }

        public string[] GetFiles(string path, string pattern = "*", SearchOption searchOption = SearchOption.AllDirectories)
        {
            return Directory.GetFiles(path, pattern, searchOption);
        }

        public bool FileExists(string path)
        {
            return File.Exists(path);
        }

        public long FileSize(string path)
        {
            return new FileInfo(path).Length;
        }

        public bool DeleteFileIfExists(string path)
        {
            if (FileExists(path))
            {
                File.Delete(path);

                return true;
            }

            return false;
        }

        public bool MoveFileIfExists(string source, string destination)
        {
            if (FileExists(source))
            {
                File.Move(source, destination);

                return true;
            }

            return false;
        }

        public long GetDirectorySize(string path)
        {
            long size = 0;

            if (DirectoryExists(path))
            {
                var info = new DirectoryInfo(path);
                
                foreach (var file in info.GetFiles())
                {      
                    size += file.Length;    
                }
                
                foreach (var dir in info.GetDirectories())
                {
                    size += GetDirectorySize(dir.FullName);
                }
            }

            return size;
        }

        public async Task<byte[]> ReadAllBytes(string path)
        {
            return await File.ReadAllBytesAsync(path);
        }

        public async Task SaveFile(IFormFile file, string path, FileMode mode)
        {
			using (var fs = new FileStream(path, mode))
			{
				await file.CopyToAsync(fs);
			}
		}

        public async Task<string> GetChecksum(string path)
        {
            return await Task.Run(() =>
            {
                var checksum = string.Empty;

                try
                {
                    using (var md5 = MD5.Create())
                    using (var stream = File.OpenRead(path))
                    {
                        // Hex-encode the 16-byte hash. The previous code did
                        // Encoding.UTF8.GetString on the raw bytes, which
                        // produces strings with embedded 0x00s about 6% of
                        // the time - Postgres rejects those with
                        // "22021: invalid byte sequence for encoding UTF8".
                        checksum = Convert.ToHexString(md5.ComputeHash(stream));
                    }
                }
                catch (Exception ex) when (ex is IOException || ex is UnauthorizedAccessException)
                {
                    _logger.LogWarning(ex, $"Failed to compute MD5 checksum for file '{path}'");
                }

                return checksum;
            });
        }

        public async Task<DateTime> GetCreationDatetime(string path)
        {
            return await Task.Run(() =>
            {
                try
                {
                    return new FileInfo(path).CreationTimeUtc;
                }
                catch
                {
                    return DateTime.UtcNow;
                }
            });
        }

        public string BytesToHumanReadable(long bytes, int decimalPlaces = 0)
        {
            var sizes = new string[] { "B", "KB", "MB", "GB", "TB", "PB", "EB" };
            var place = 0;
            var total = 0.0;

            var decimalFormat = "###0.";
            for (var i = 0; i < decimalPlaces; i++)
            {
                decimalFormat += "0";
            }

            if (bytes >= 0)
            { 
                try
                {
                    long b = Math.Abs(bytes);
                    place = Convert.ToInt32(Math.Floor(Math.Log(b ,1000)));
                    double num = Math.Round(b / Math.Pow(1000, place), 2);
                    total = Math.Sign(bytes) * num;
                }
                catch { }
            }

            return total.ToString($"{decimalFormat.TrimEnd('.')} {sizes[place]}");
        }

        public string SanitizeFilename(string filename)
        {
            if (string.IsNullOrEmpty(filename)) return string.Empty;

            // 1. Reduce to the basename only so any directory components in the input
            //    (e.g. "../../etc/passwd" or "..\foo") are stripped before we look at chars.
            //    Path.GetFileName on Linux only treats '/' as a separator; pre-strip '\' too
            //    so a Windows-style payload can't sneak past on Linux builds.
            var basename = Path.GetFileName(filename.Replace('\\', '/'));

            // 2. Cross-platform invalid chars: Linux's Path.GetInvalidFileNameChars is
            //    only NUL and '/'. Add the Windows-invalid set so cross-builds behave the
            //    same and so values that round-trip to Windows servers stay safe.
            var crossPlatformInvalid = new HashSet<char>(Path.GetInvalidFileNameChars())
            {
                '/', '\\', ':', '*', '?', '"', '<', '>', '|'
            };
            var sb = new StringBuilder(basename.Length);
            foreach (var ch in basename)
            {
                if (ch < 0x20 || crossPlatformInvalid.Contains(ch)) continue;
                sb.Append(ch);
            }
            var cleaned = sb.ToString().Trim().TrimEnd('.');

            // 3. Reject parent-dir / current-dir tokens outright. An attacker-controlled
            //    filename ending in '.', '..', or made entirely of dots would otherwise
            //    survive the per-char filter.
            if (cleaned == "." || cleaned == "..") return string.Empty;

            return cleaned;
        }

        // Safe ZipFile.ExtractToDirectory: enforces zip-slip protection by resolving
        // each entry against the canonical target dir and rejecting any entry whose
        // full path escapes it (e.g. "../etc/passwd"). Callers MUST use this in place
        // of ZipFile.ExtractToDirectory for any zip whose contents are user-supplied.
        public void SafeExtractZip(string zipPath, string targetDir, bool overwrite)
        {
            var targetFull = Path.GetFullPath(targetDir);
            if (!targetFull.EndsWith(Path.DirectorySeparatorChar))
            {
                targetFull += Path.DirectorySeparatorChar;
            }

            using (var archive = System.IO.Compression.ZipFile.OpenRead(zipPath))
            {
                foreach (var entry in archive.Entries)
                {
                    // Resolve the entry path relative to target and canonicalize.
                    var destPath = Path.GetFullPath(Path.Combine(targetFull, entry.FullName));
                    if (!destPath.StartsWith(targetFull, StringComparison.Ordinal))
                    {
                        _logger.LogWarning("SafeExtractZip rejected entry '{Entry}' (resolves outside '{Target}')", entry.FullName, targetFull);
                        continue;
                    }

                    // Directory entry (trailing slash) - just create it.
                    if (string.IsNullOrEmpty(entry.Name))
                    {
                        Directory.CreateDirectory(destPath);
                        continue;
                    }

                    var parent = Path.GetDirectoryName(destPath);
                    if (!string.IsNullOrEmpty(parent)) Directory.CreateDirectory(parent);
                    entry.ExtractToFile(destPath, overwrite);
                }
            }
        }
    }
}
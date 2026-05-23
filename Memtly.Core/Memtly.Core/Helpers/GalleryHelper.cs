using System.Text.RegularExpressions;

namespace Memtly.Core.Helpers
{
    public class GalleryHelper
    {
        public static string GenerateGalleryIdentifier()
        {
            return Guid.NewGuid().ToString().Replace("-", string.Empty).ToLower();
        }

        public static bool IsValidGalleryIdentifier(string? value)
        {
            return !string.IsNullOrWhiteSpace(value) && Regex.IsMatch(value, "^(all|default|[a-z0-9]{32})$", RegexOptions.Compiled);
        }

        // Path-safe check for any value that will be used as a directory name
        // (UploadsDirectory/<value>, ThumbnailsDirectory/<value>, TempDirectory/<value>)
        // or a URL segment. Stricter than IsValidGalleryIdentifier (which is the canonical
        // generated-form check); this is the write-time guard that rejects path-traversal
        // payloads while still allowing user-facing names like "smith-wedding".
        public static bool IsSafePathSegment(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;
            if (value.Length > 64) return false;
            if (value == "." || value == "..") return false;
            if (value.StartsWith('.')) return false;
            // Allow lowercase alnum + dash + underscore only. Anything else (path
            // separators, `..`, NTFS/POSIX special chars, NUL, whitespace) is rejected.
            return Regex.IsMatch(value, "^[a-z0-9_-]+$", RegexOptions.Compiled);
        }
    }
}
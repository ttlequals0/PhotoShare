using System.Diagnostics;
using Memtly.Core.Constants;

namespace Memtly.Core.Middleware
{
    // Structured per-request access log. One line per request, fields readable
    // as structured data in Loki:
    //   Method, Path, Status, DurationMs, RemoteIp, UserAgent, Identity, GalleryId
    //
    // Skips static-asset paths so we don't drown the log in CSS/JS/icons.
    // Runs after UseForwardedHeaders so RemoteIp reflects the real client when
    // the request came through cloudflared / a LAN reverse proxy.
    //
    // Status >= 500 logs at Warning, 4xx at Information, everything else
    // Information. Exceptions are rethrown (so UseExceptionHandler still wins)
    // after a Warning log with the exception type.
    public sealed class AccessLogMiddleware : IMiddleware
    {
        private readonly ILogger<AccessLogMiddleware> _logger;

        public AccessLogMiddleware(ILogger<AccessLogMiddleware> logger)
        {
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext ctx, RequestDelegate next)
        {
            var path = ctx.Request.Path.Value ?? string.Empty;
            if (IsStaticAsset(path))
            {
                await next(ctx);
                return;
            }

            var sw = Stopwatch.StartNew();
            Exception? error = null;
            try
            {
                await next(ctx);
            }
            catch (Exception ex)
            {
                error = ex;
                throw;
            }
            finally
            {
                sw.Stop();

                var method = ctx.Request.Method;
                var status = ctx.Response.StatusCode;
                var durationMs = sw.Elapsed.TotalMilliseconds;
                var remoteIp = ctx.Connection.RemoteIpAddress?.ToString() ?? "-";
                var userAgent = ctx.Request.Headers.UserAgent.ToString();
                if (string.IsNullOrEmpty(userAgent)) userAgent = "-";

                string identity = "-";
                try
                {
                    identity = ctx.Session?.GetString(SessionKey.Viewer.Identity)?.Trim()
                        ?? ctx.User?.Identity?.Name
                        ?? "-";
                    if (string.IsNullOrEmpty(identity)) identity = "-";
                }
                catch (InvalidOperationException)
                {
                    // Session not available for this request (e.g. before
                    // session middleware), leave identity as "-".
                }

                var galleryId = TryGetGalleryIdentifier(ctx) ?? "-";

                if (error != null)
                {
                    _logger.LogWarning(
                        "access {Method} {Path} -> {Status} in {DurationMs:F1}ms ip={RemoteIp} ua={UserAgent} who={Identity} gallery={GalleryId} err={ErrorType}",
                        method, path, status, durationMs, remoteIp, userAgent, identity, galleryId, error.GetType().Name);
                }
                else if (status >= 500)
                {
                    _logger.LogWarning(
                        "access {Method} {Path} -> {Status} in {DurationMs:F1}ms ip={RemoteIp} ua={UserAgent} who={Identity} gallery={GalleryId}",
                        method, path, status, durationMs, remoteIp, userAgent, identity, galleryId);
                }
                else
                {
                    _logger.LogInformation(
                        "access {Method} {Path} -> {Status} in {DurationMs:F1}ms ip={RemoteIp} ua={UserAgent} who={Identity} gallery={GalleryId}",
                        method, path, status, durationMs, remoteIp, userAgent, identity, galleryId);
                }
            }
        }

        private static bool IsStaticAsset(string path)
        {
            // Webpack output, brand assets, icons, PWA shell. Anything in
            // wwwroot/* that's a generated or static file goes here.
            return path.StartsWith("/dist/", StringComparison.OrdinalIgnoreCase)
                || path.StartsWith("/images/", StringComparison.OrdinalIgnoreCase)
                || path.StartsWith("/icons/", StringComparison.OrdinalIgnoreCase)
                || path.StartsWith("/css/", StringComparison.OrdinalIgnoreCase)
                || path.StartsWith("/js/", StringComparison.OrdinalIgnoreCase)
                || path.StartsWith("/fonts/", StringComparison.OrdinalIgnoreCase)
                || path.StartsWith("/lib/", StringComparison.OrdinalIgnoreCase)
                || path.Equals("/favicon.ico", StringComparison.OrdinalIgnoreCase)
                || path.Equals("/sw.js", StringComparison.OrdinalIgnoreCase)
                || path.Equals("/manifest.webmanifest", StringComparison.OrdinalIgnoreCase)
                || path.Equals("/robots.txt", StringComparison.OrdinalIgnoreCase)
                || path.Equals("/sitemap.xml", StringComparison.OrdinalIgnoreCase);
        }

        private static string? TryGetGalleryIdentifier(HttpContext ctx)
        {
            // Prefer the routed parameter (controller has it bound).
            if (ctx.Request.RouteValues.TryGetValue("identifier", out var routed))
            {
                var s = routed?.ToString();
                if (!string.IsNullOrWhiteSpace(s)) return s;
            }

            // Fall back to query string for endpoints that take identifier there
            // (Gallery upload, Login, etc).
            if (ctx.Request.Query.TryGetValue("identifier", out var q) && !string.IsNullOrWhiteSpace(q))
            {
                return q.ToString();
            }

            return null;
        }
    }
}

using System.Net;
using Microsoft.AspNetCore.HttpOverrides;

namespace Memtly.Core.Middleware
{
    // Blocks admin / account / MFA paths from requests outside an env-defined
    // CIDR allowlist. Default (empty allowlist) is permissive so existing
    // deploys aren't broken; setting ADMIN_ALLOWED_NETWORKS opts in.
    //
    // Wired after UseForwardedHeaders so ctx.Connection.RemoteIpAddress is
    // the real client IP (rewritten from X-Forwarded-For when the request
    // came through cloudflared or a LAN reverse proxy).
    //
    // 404 (not 403) is intentional - it hides the admin surface entirely so
    // external probes can't tell from the response whether the auth endpoints
    // exist at all.
    public sealed class AdminNetworkGate : IMiddleware
    {
        private readonly List<Microsoft.AspNetCore.HttpOverrides.IPNetwork> _allowed;
        private readonly ILogger<AdminNetworkGate> _logger;

        public AdminNetworkGate(ILogger<AdminNetworkGate> logger)
        {
            _logger = logger;
            var raw = Environment.GetEnvironmentVariable("ADMIN_ALLOWED_NETWORKS") ?? string.Empty;
            _allowed = raw
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(TryParseCidr)
                .Where(n => n != null)
                .Cast<Microsoft.AspNetCore.HttpOverrides.IPNetwork>()
                .ToList();

            if (_allowed.Count > 0)
            {
                _logger.LogInformation("AdminNetworkGate active: {Count} network(s) allowed for /Account, /Admin, /MultiFactor", _allowed.Count);
            }
        }

        // True when the env var is set and the gate is actively filtering.
        // Views/controllers consult this to decide whether to suppress the
        // admin UI (login button etc) for clients outside the allowlist.
        public bool IsEnabled => _allowed.Count > 0;

        // True when the request originates from an IP in the allowlist (or
        // when the gate is disabled, which preserves the default permissive
        // behaviour for non-public deployments).
        public bool IsAllowed(HttpContext ctx)
        {
            if (_allowed.Count == 0) return true;
            var ip = ctx?.Connection.RemoteIpAddress;
            return ip != null && _allowed.Any(n => n.Contains(ip));
        }

        public async Task InvokeAsync(HttpContext ctx, RequestDelegate next)
        {
            if (_allowed.Count == 0)
            {
                await next(ctx);
                return;
            }

            var path = ctx.Request.Path.Value ?? string.Empty;
            var gated = path.StartsWith("/Account", StringComparison.OrdinalIgnoreCase)
                     || path.StartsWith("/Admin", StringComparison.OrdinalIgnoreCase)
                     || path.StartsWith("/MultiFactor", StringComparison.OrdinalIgnoreCase);
            if (!gated)
            {
                await next(ctx);
                return;
            }

            if (IsAllowed(ctx))
            {
                await next(ctx);
                return;
            }

            _logger.LogWarning("AdminNetworkGate blocked {Path} from {Ip}", path, ctx.Connection.RemoteIpAddress);
            ctx.Response.StatusCode = StatusCodes.Status404NotFound;
        }

        private static Microsoft.AspNetCore.HttpOverrides.IPNetwork? TryParseCidr(string entry)
        {
            try
            {
                var parts = entry.Split('/', 2);
                var addr = IPAddress.Parse(parts[0]);
                var prefix = parts.Length == 2
                    ? int.Parse(parts[1])
                    : (addr.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6 ? 128 : 32);
                return new Microsoft.AspNetCore.HttpOverrides.IPNetwork(addr, prefix);
            }
            catch (Exception ex) when (ex is FormatException || ex is ArgumentException || ex is OverflowException)
            {
                return null;
            }
        }
    }
}

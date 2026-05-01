using System.Net;
using System.Reflection;
using System.Threading.RateLimiting;
using Memtly.Core.BackgroundWorkers;
using Memtly.Core.Configurations;
using Memtly.Core.Constants;
using Memtly.Core.Helpers;
using Memtly.Core.Middleware;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.FileProviders;

namespace Memtly.Core.Extensions
{
    public static class StartupExtensions
    {
        public static void ConfigureCommunityServices(this IServiceCollection services)
        {
            services.ConfigureSharedServices();
        }

        public static void ConfigureEnterpriseServices(this IServiceCollection services)
        {
            services.ConfigureSharedServices();
        }

        public static void ConfigureSharedServices(this IServiceCollection services)
        {
            services.AddExceptionHandler<GlobalExceptionHandler>();
            services.AddProblemDetails();

            services.AddDependencyInjectionConfiguration();
            services.AddDatabaseConfiguration();
            services.AddWebClientConfiguration();
            services.AddNotificationConfiguration();
            services.AddLocalizationConfiguration();
            services.AddFfmpegConfiguration();

            services.AddHostedService<DirectoryScanner>();
            services.AddHostedService<NotificationReport>();
            services.AddHostedService<CleanupService>();

            services.AddResponseCaching();
            services.AddRazorPages();
            services.AddControllersWithViews()
                .AddRazorRuntimeCompilation()
                .AddApplicationPart(typeof(Memtly.Core.MemtlyCore).Assembly);

            services.Configure<CookiePolicyOptions>(options =>
            {
                options.CheckConsentNeeded = context => true;
            });

            // Forwarded Headers: required when running behind Cloudflare Tunnel
            // (cloudflared sends X-Forwarded-Proto: https). Without this the app
            // sees the request as HTTP, which means the auth/session cookies
            // configured with SecurePolicy=Always are never emitted - login
            // silently fails. Only loopback and RFC1918 ranges are trusted; the
            // tunnel itself is the only public ingress, and the only proxy
            // reaching this service runs on the same host or private network.
            services.Configure<ForwardedHeadersOptions>(options =>
            {
                options.ForwardedHeaders = ForwardedHeaders.XForwardedFor
                                         | ForwardedHeaders.XForwardedProto
                                         | ForwardedHeaders.XForwardedHost;
                options.KnownNetworks.Clear();
                options.KnownProxies.Clear();
                options.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(IPAddress.Loopback, 8));            // 127.0.0.0/8
                options.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(IPAddress.IPv6Loopback, 128));      // ::1
                options.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(IPAddress.Parse("10.0.0.0"), 8));   // RFC1918
                options.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(IPAddress.Parse("172.16.0.0"), 12));// RFC1918 (Docker default bridge)
                options.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(IPAddress.Parse("192.168.0.0"), 16));// RFC1918
            });

            const long maxBodyBytes = 256L * 1024 * 1024;       // 256 MB
            const int  memBufferThresholdBytes = 64 * 1024;     // 64 KB - spill to disk above this

            services.Configure<KestrelServerOptions>(options =>
            {
                options.Limits.MaxRequestBodySize = maxBodyBytes;
            });

            services.Configure<FormOptions>(x =>
            {
                x.MultipartHeadersLengthLimit = 16 * 1024;        // 16 KB
                x.MultipartBoundaryLengthLimit = 1024;            // 1 KB
                x.MultipartBodyLengthLimit = maxBodyBytes;
                x.ValueLengthLimit = 1024 * 1024;                 // 1 MB per form value
                x.BufferBodyLengthLimit = maxBodyBytes;
                x.MemoryBufferThreshold = memBufferThresholdBytes;
            });

            services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
                .AddCookie(options =>
                {
                    options.Cookie.HttpOnly = true;
                    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                    options.Cookie.SameSite = SameSiteMode.Lax;
                    options.ExpireTimeSpan = TimeSpan.FromMinutes(60);

                    options.LoginPath = "/Account/Login";
                    options.AccessDeniedPath = $"/Error?Reason={ErrorCode.Unauthorized}";
                    options.SlidingExpiration = true;
                });
            services.AddSession(options => {
                options.IdleTimeout = TimeSpan.FromMinutes(60);
                options.Cookie.Name = ".Memtly.Session";
                options.Cookie.IsEssential = true;
                options.Cookie.HttpOnly = true;
                options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
                options.Cookie.SameSite = SameSiteMode.Lax;
            });

            services.AddHsts(options =>
            {
                options.MaxAge = TimeSpan.FromDays(365);
                options.IncludeSubDomains = true;
                options.Preload = true;
            });

            services.AddRateLimiter(options =>
            {
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
                options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
                {
                    var ip = ctx.Connection.RemoteIpAddress?.ToString() ?? "anon";
                    var path = ctx.Request.Path.Value ?? string.Empty;
                    var isAuthPost = ctx.Request.Method == HttpMethods.Post
                        && (path.StartsWith("/Account/Login", StringComparison.OrdinalIgnoreCase)
                            || path.StartsWith("/Account/Register", StringComparison.OrdinalIgnoreCase)
                            || path.StartsWith("/Account/ResetPassword", StringComparison.OrdinalIgnoreCase)
                            || path.StartsWith("/Account/ValidateMultifactorAuth", StringComparison.OrdinalIgnoreCase));

                    if (isAuthPost)
                    {
                        return RateLimitPartition.GetFixedWindowLimiter($"auth-{ip}", _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = 10,
                            Window = TimeSpan.FromMinutes(1),
                            QueueLimit = 0,
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                            AutoReplenishment = true,
                        });
                    }

                    return RateLimitPartition.GetTokenBucketLimiter(ip, _ => new TokenBucketRateLimiterOptions
                    {
                        TokenLimit = 120,
                        TokensPerPeriod = 2,
                        ReplenishmentPeriod = TimeSpan.FromSeconds(1),
                        QueueLimit = 0,
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                        AutoReplenishment = true,
                    });
                });
            });
            services.AddDataProtection()
                .SetApplicationName("Memtly")
                .PersistKeysToFileSystem(new DirectoryInfo(Directories.Private.Config));

            services.AddRequestTimeouts(options =>
            {
                options.AddPolicy("timeout_1h", TimeSpan.FromHours(1));
            });
        }

        public static void ConfigureCommunity(this IApplicationBuilder app, IWebHostEnvironment env)
        {
            app.ConfigureShared(env);
        }

        public static void ConfigureEnterprise(this IApplicationBuilder app, IWebHostEnvironment env)
        {
            app.ConfigureShared(env);
        }

        public static void ConfigureShared(this IApplicationBuilder app, IWebHostEnvironment env)
        {
            var config = app.ApplicationServices.GetRequiredService<IConfigHelper>();
            var settings = app.ApplicationServices.GetRequiredService<ISettingsHelper>();
            var logger = app.ApplicationServices.GetRequiredService<ILogger<MemtlyCore>>();

            EnforceRequiredSecurityConfig(config, env, logger);

            var appTitle = config.GetOrDefault(MemtlyConfiguration.Basic.Title, "PhotoShare");
            logger.LogInformation("{App} starting, version {Version}", appTitle, settings.GetReleaseVersion(3));

            // ForwardedHeaders MUST run before any middleware that examines
            // request scheme, host, or remote IP - that means before
            // UseExceptionHandler, UseHsts, UseHttpsRedirection,
            // UseAuthentication, and UseRateLimiter.
            app.UseForwardedHeaders();

            app.UseExceptionHandler();

            if (!env.IsDevelopment())
            {
                app.UseExceptionHandler("/Error");
                app.UseHsts();
            }

            if (settings.GetOrDefault(MemtlyConfiguration.Basic.ForceHttps, false).Result)
            {
                app.UseHttpsRedirection();
            }

            app.UseCookiePolicy();

            foreach (var dirName in $"{Directories.Public.Uploads},{Directories.Public.CustomResources},{Directories.Public.Thumbnails},{Directories.Public.TempFiles}".Split(new char[] { ',' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                var dirPath = Path.Combine(Path.GetDirectoryName(Assembly.GetEntryAssembly()!.Location)!, dirName);
                Directory.CreateDirectory(dirPath);

                app.UseStaticFiles(new StaticFileOptions
                {
                    FileProvider = new PhysicalFileProvider(dirPath),
                    RequestPath = $"/{dirName}"
                });
            }

            foreach (var dirName in $"{Directories.Private.Config}".Split(new char[] { ',' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                var dirPath = Path.Combine(Path.GetDirectoryName(Assembly.GetEntryAssembly()!.Location)!, dirName);
                Directory.CreateDirectory(dirPath);
            }

            if (config.GetOrDefault(MemtlyConfiguration.Security.Headers.Enabled, true))
            {
                try
                {
                    var baseUrl = settings.GetOrDefault(MemtlyConfiguration.Basic.BaseUrl, string.Empty).Result;
                    var baseUrlCSP = "http://localhost:* ws://localhost:*";
                    if (!string.IsNullOrWhiteSpace(baseUrl))
                    {
                        try
                        {
                            var uri = new Uri(baseUrl);
                            baseUrlCSP = !string.IsNullOrWhiteSpace(uri.Host) ? $"{uri.Scheme}://{uri.Host}:* {(uri.Scheme.Equals("https", StringComparison.OrdinalIgnoreCase) ? "wss" : "ws")}://{uri.Host}:*" : string.Empty;
                        }
                        catch { }
                    }

                    var umamiUrl = settings.GetOrDefault(MemtlyConfiguration.Trackers.Umami.Endpoint, string.Empty).Result;
                    var trackersUrlCSP = string.Empty;
                    if (!string.IsNullOrWhiteSpace(umamiUrl))
                    {
                        try
                        {
                            var uri = new Uri(umamiUrl);
                            if (!string.IsNullOrWhiteSpace(uri.Host))
                            {
                                trackersUrlCSP = $"{trackersUrlCSP} {uri.Scheme}://{uri.Host}:*".Trim();
                            }
                        }
                        catch { }
                    }

                    app.Use(async (context, next) =>
                    {
                        context.Response.Headers.Remove("X-Frame-Options");
                        context.Response.Headers.Append("X-Frame-Options", config.GetOrDefault(MemtlyConfiguration.Security.Headers.XFrameOptions, "SAMEORIGIN"));

                        context.Response.Headers.Remove("X-Content-Type-Options");
                        context.Response.Headers.Append("X-Content-Type-Options", config.GetOrDefault(MemtlyConfiguration.Security.Headers.XContentTypeOptions, "nosniff"));

                        context.Response.Headers.Remove("Content-Security-Policy");
                        context.Response.Headers.Append("Content-Security-Policy", config.GetOrDefault(MemtlyConfiguration.Security.Headers.CSP, $"default-src 'self' {(!string.IsNullOrWhiteSpace(baseUrlCSP) ? baseUrlCSP : "http://localhost:* ws://localhost:*")}; script-src 'self' 'unsafe-inline' 'unsafe-eval'{(!string.IsNullOrWhiteSpace(trackersUrlCSP) ? $" {trackersUrlCSP}" : string.Empty)}; style-src 'self' 'unsafe-inline'; connect-src 'self' {(!string.IsNullOrWhiteSpace(baseUrlCSP) ? baseUrlCSP : "http://localhost:* ws://localhost:*")}{(!string.IsNullOrWhiteSpace(trackersUrlCSP) ? $" {trackersUrlCSP}" : string.Empty)}; font-src 'self'; img-src 'self' https://github.com/ https://avatars.githubusercontent.com/ data:; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self';"));

                        context.Response.Headers.Remove("Referrer-Policy");
                        context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");

                        context.Response.Headers.Remove("Permissions-Policy");
                        context.Response.Headers.Append("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");

                        context.Response.Headers.Remove("Cross-Origin-Opener-Policy");
                        context.Response.Headers.Append("Cross-Origin-Opener-Policy", "same-origin");

                        context.Response.Headers.Remove("Cross-Origin-Resource-Policy");
                        context.Response.Headers.Append("Cross-Origin-Resource-Policy", "same-site");

                        await next();
                    });
                }
                catch { }
            }

            app.UseStaticFiles();
            app.UseRouting();
            app.UseRateLimiter();
            app.UseAuthentication();
            app.UseAuthorization();
            app.UseRequestLocalization();
            app.UseSession();
            app.UseRequestTimeouts();
            app.UseResponseCaching();

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllerRoute(
                    name: "default",
                    pattern: "{controller}/{action}/{id?}",
                    defaults: new { controller = "Home", action = "Index" });
                endpoints.MapRazorPages();
            });
        }

        // Refuse to start in production with placeholder secrets. Development is
        // exempt so local "dotnet run" without env vars still works for
        // contributors. Operators must override these via env vars or a
        // secrets file before deploying.
        private static void EnforceRequiredSecurityConfig(IConfigHelper config, IWebHostEnvironment env, ILogger logger)
        {
            if (env.IsDevelopment())
            {
                return;
            }

            // The error message uses string literals only - the constants
            // MemtlyConfiguration.* contain "Password"/"Email" in their names
            // and CodeQL's cs/cleartext-storage taint tracker would flag any
            // constant -> log flow as sensitive even though these are config
            // key paths, not values. Reading the value via config.GetOrDefault
            // is fine because the result is used only for the bool check and
            // never stored or logged.
            var missing = new List<string>();

            static bool IsMissingOrPlaceholder(string actual, string forbidden)
            {
                if (string.IsNullOrWhiteSpace(actual)) return true;
                return string.Equals(actual, forbidden, StringComparison.Ordinal);
            }

            if (IsMissingOrPlaceholder(config.GetOrDefault(MemtlyConfiguration.Security.Encryption.Key, string.Empty), "ChangeMe"))
            {
                missing.Add("Memtly:Security:Encryption:Key");
            }
            if (IsMissingOrPlaceholder(config.GetOrDefault(MemtlyConfiguration.Security.Encryption.Salt, string.Empty), "ChangeMe"))
            {
                missing.Add("Memtly:Security:Encryption:Salt");
            }
            if (IsMissingOrPlaceholder(config.GetOrDefault(MemtlyConfiguration.Account.Admin.EmailAddress, string.Empty), "admin@example.com"))
            {
                missing.Add("Memtly:Account:Admin:Email");
            }
            if (IsMissingOrPlaceholder(config.GetOrDefault(MemtlyConfiguration.Account.Admin.Password, string.Empty), "admin"))
            {
                missing.Add("Memtly:Account:Admin:Password");
            }

            if (missing.Count > 0)
            {
                var msg = "PhotoShare cannot start: required security configuration is missing or set to placeholder defaults. "
                       + "Set these via environment variables or appsettings.Production.json before deploying:\n  - "
                       + string.Join("\n  - ", missing);
                logger.LogCritical(msg);
                throw new InvalidOperationException(msg);
            }
        }
    }
}
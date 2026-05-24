# Docker deployment

PhotoShare ships as a single image (`ttlequals0/photoshare`). For
anything beyond local testing the recommended deployment is the
included `docker-compose.yml` with a Postgres backend.

Reference: upstream Memtly's [Docker setup
docs](https://docs.memtly.com/docs/Setup/docker) for background; the
PhotoShare fork tightens the defaults (BCrypt password hashing,
fail-fast on placeholder secrets, chiseled-extra base, non-root UID
1654) and adds a `/healthz` endpoint operators can probe externally.

## Quick start

```bash
git clone git@github.com:ttlequals0/PhotoShare.git
cd PhotoShare

cp .env.example .env
# edit .env, fill in real secrets - the app refuses to start if any of
# ENCRYPTION_KEY, ENCRYPTION_SALT, ADMIN_EMAIL, ADMIN_PASSWORD are empty
# or set to placeholder values like "ChangeMe" / "admin"

docker compose pull
docker compose up -d
docker compose logs -f app
```

The chiseled image has no shell, so there's no in-container
healthcheck - probe `/healthz` from the host (`curl
http://localhost:5000/healthz`) or via Cloudflare Tunnel's origin
check. Once it returns 200, open http://localhost:5000 and log in
with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set.

## Environment variables

Two naming conventions are accepted; pick one and stick with it per
deploy.

**Canonical form (ASP.NET Core standard).** Double underscore replaces
the colon in the nested `Memtly:Section:Key` config path. Examples:
`Memtly__Database__Type`, `Memtly__Trackers__CloudflareInsights__SiteToken`.
Read via the standard `IConfiguration` binder. The compose file in this
repo uses this form for searchability against `MemtlyConfiguration`
constants.

**Shorthand form (upstream Memtly `ConfigHelper` shim).** The shim in
`Memtly.Core/Helpers/ConfigHelper.cs` derives the env var name by
stripping the leading `Memtly:`, joining the rest with `_`, and
upper-casing. Examples:

| Config key                                       | Shorthand env var                       |
|--------------------------------------------------|-----------------------------------------|
| `Memtly:Database:Type`                           | `DATABASE_TYPE`                         |
| `Memtly:Database:Connection_String`              | `DATABASE_CONNECTION_STRING`            |
| `Memtly:Security:Encryption:Key`                 | `SECURITY_ENCRYPTION_KEY`               |
| `Memtly:Security:Encryption:Salt`                | `SECURITY_ENCRYPTION_SALT`              |
| `Memtly:Account:Admin:Email`                     | `ACCOUNT_ADMIN_EMAIL`                   |
| `Memtly:Account:Admin:Password`                  | `ACCOUNT_ADMIN_PASSWORD`                |
| `Memtly:Force_Https`                             | `FORCE_HTTPS`                           |
| `Memtly:Base_Url`                                | `BASE_URL`                              |
| `Memtly:Title`                                   | `TITLE`                                 |
| `Memtly:Trackers:CloudflareInsights:SiteToken`   | `TRACKERS_CLOUDFLAREINSIGHTS_SITETOKEN` |
| `Memtly:Trackers:Umami:Endpoint`                 | `TRACKERS_UMAMI_ENDPOINT`               |
| `Memtly:Trackers:Umami:WebsiteId`                | `TRACKERS_UMAMI_WEBSITEID`              |

Both forms resolve to the same config value. The shim is checked
first; if no shorthand env var is set, the binder falls back to the
canonical form / `appsettings.json` defaults.

**One exception:** `ADMIN_ALLOWED_NETWORKS` is read directly by
`AdminNetworkGate` middleware via `Environment.GetEnvironmentVariable`,
not through `ConfigHelper` or `IConfiguration`. It has no
`Memtly__...` equivalent.

Required (the app refuses to start without these in non-Development):

| Container env var | Purpose |
|-------------------|---------|
| `Memtly__Security__Encryption__Key` | Symmetric key for gallery secret-key encryption + MFA token storage |
| `Memtly__Security__Encryption__Salt` | Salt for the same |
| `Memtly__Account__Admin__Email` | Initial admin account email |
| `Memtly__Account__Admin__Password` | Initial admin password (BCrypt-hashed on seed) |

Recommended for public exposure:

| Container env var | Purpose |
|-------------------|---------|
| `Memtly__Force_Https` | `true` - app emits `Set-Cookie; Secure` and HSTS |
| `Memtly__Base_Url` | Public hostname (include `https://`); used in verification emails + CSP |
| `Memtly__Title` | App name shown in nav and emails |
| `ASPNETCORE_ENVIRONMENT` | `Production` |

Database:

| Container env var | Purpose |
|-------------------|---------|
| `Memtly__Database__Type` | `sqlite` (default) / `mysql` / `postgres` / `mssql` / `mariadb` |
| `Memtly__Database__Connection_String` | Provider-specific |

Optional admin network gate (raw env, not `Memtly__`):

| Container env var | Purpose |
|-------------------|---------|
| `ADMIN_ALLOWED_NETWORKS` | Comma-separated CIDR list. When set, `/Account`, `/Admin`, `/MultiFactor` return 404 to any client outside the allowlist (RemoteIpAddress after `ForwardedHeaders` rewrite). Empty = unrestricted. Read directly by `AdminNetworkGate` middleware, not by the standard `Memtly:Section:Key` binder. |

Optional analytics (both leave the script tag out entirely when empty):

| Container env var | Purpose |
|-------------------|---------|
| `Memtly__Trackers__CloudflareInsights__SiteToken` | Cloudflare Web Analytics site token. When set, app renders the external CF beacon `<script>` tag. Also disable Web Analytics auto-injection for the zone in the CF dashboard, otherwise CF will inject its rotating inline bootstrap alongside ours (and CSP will block it). |
| `Memtly__Trackers__Umami__Endpoint` | Base URL of your self-hosted Umami instance (no trailing slash). |
| `Memtly__Trackers__Umami__WebsiteId` | Umami site UUID. Both `Endpoint` and `WebsiteId` must be set for the script to render. |
| `Memtly__Trackers__Umami__ScriptName` | Defaults to `script.js`. Override if your Umami install renames the loader. |
| `Memtly__Trackers__Umami__PerformanceTracking__Enabled` | `true` to enable Umami's perf metrics. Default `false`. |
| `Memtly__Trackers__Umami__Replay__Enabled` | `true` to enable Umami Session Replay; tune via `Replay__SampleRate` / `MaskLevel` / `MaxDuration` / `BlockSelector`. |

Optional Cloudflare Tunnel sidecar (set on the `cloudflared` service, not the `app` service):

| Container env var | Purpose |
|-------------------|---------|
| `TUNNEL_TOKEN` | Token from `cloudflared tunnel token <NAME>` or the Zero Trust dashboard. Wired through `${CLOUDFLARED_TOKEN}` in the commented sidecar block at the bottom of `docker-compose.yml`. |

## Volumes

The image runs as **chiseled-extra's built-in `app` user (UID 1654,
group 1654)**. If you bind-mount host directories instead of using the
named volumes the compose file ships with, you must `chown` them
first:

```bash
sudo chown -R 1654:1654 /var/photoshare/{config,uploads,thumbnails,custom_resources}
```

Container paths:

| Path | Contents |
|------|----------|
| `/app/config` | SQLite DB if used; Data Protection keys; bootstrap state |
| `/app/uploads` | User-uploaded photos and videos |
| `/app/thumbnails` | Generated thumbnails (regenerable, but expensive to lose at scale) |
| `/app/custom_resources` | Operator-uploaded customizations |

The named volumes in `docker-compose.yml` are auto-owned by the
container UID, so the chown step isn't needed for the default config.

## Reaching it via Cloudflare Tunnel

Uncomment the `cloudflared` sidecar in `docker-compose.yml` and set
`CLOUDFLARED_TOKEN` in `.env` (token from `cloudflared tunnel token
<TUNNEL_NAME>` or the Zero Trust dashboard). Configure ingress for your
hostname to `http://app:5000` in the tunnel's dashboard / config.

The `ForwardedHeaders` middleware in PhotoShare trusts loopback +
RFC1918 ranges by default; the compose network falls inside RFC1918
(default Docker bridge `172.16.0.0/12`) so cloudflared's
`X-Forwarded-Proto: https` is honored without further config.

The full edge ruleset (WAF custom rules, rate limiting, Cloudflare
Access for `/Admin*`, Turnstile on `/Account/Register`, cache rules)
is documented in [docs/cloudflare.md](cloudflare.md).

## Updating

```bash
docker compose pull
docker compose up -d
```

The app's EF Core migration filter applies pending Postgres migrations
on startup. Existing data is preserved.

## Backups

The two pieces of state worth backing up:

- The Postgres DB (everything except media files)
- The `photoshare-uploads` named volume (the actual photos)

Thumbnails and custom_resources can be regenerated; backing them up is
optional.

```bash
# Postgres dump
docker compose exec -T db pg_dump -U photoshare photoshare \
  | gzip > photoshare-$(date +%F).sql.gz

# Uploads tarball (stop the app for a consistent snapshot, or use a
# proper volume snapshot tool for live backups)
docker run --rm -v photoshare-uploads:/u alpine \
  tar czf - /u > uploads-$(date +%F).tar.gz
```

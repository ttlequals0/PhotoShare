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

The compose file binds via the canonical ASP.NET Core form:
`Memtly__Section__Key` (double underscore replaces the colon in the
nested `Memtly:Section:Key` config path). Set these as container env
vars, not shell vars - the compose file already wires them up from
`.env`.

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

# Docker deployment

PhotoShare ships as a single image (`ttlequals0/photoshare`). For
anything beyond local testing the recommended deployment is the
included `docker-compose.yml` with a Postgres backend.

Reference: upstream Memtly's [Docker setup
docs](https://docs.memtly.com/docs/Setup/docker) for background; the
PhotoShare fork tightens the defaults (BCrypt password hashing,
fail-fast on placeholder secrets, non-root UID 10001) and adds a
`/healthz` endpoint that the compose file uses.

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

Once the `app` container is healthy (Docker reports `(healthy)` after a
successful `/healthz` probe), open http://localhost:5000 and log in
with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set.

## Environment variables

PhotoShare's `ConfigHelper` accepts the simple `UPPER_SNAKE_CASE` form
(`DATABASE_TYPE`, `ENCRYPTION_KEY`, etc. - same convention as upstream
Memtly), and the standard ASP.NET Core form (`Memtly__Database__Type`)
also works. The compose file uses the simple form.

Required (the app refuses to start without these in non-Development):

| Var | Purpose |
|-----|---------|
| `ENCRYPTION_KEY` | Symmetric key for gallery secret-key encryption + MFA token storage |
| `ENCRYPTION_SALT` | Salt for the same |
| `ACCOUNT_ADMIN_EMAIL` | Initial admin account email |
| `ACCOUNT_ADMIN_PASSWORD` | Initial admin password (BCrypt-hashed on seed) |

Recommended for public exposure:

| Var | Purpose |
|-----|---------|
| `FORCE_HTTPS` | `true` - app emits `Set-Cookie; Secure` and HSTS |
| `BASE_URL` | Public hostname; used in verification emails + CSP |
| `TITLE` | App name shown in nav and emails |
| `ASPNETCORE_ENVIRONMENT` | `Production` |

Database:

| Var | Purpose |
|-----|---------|
| `DATABASE_TYPE` | `sqlite` (default) / `mysql` / `postgres` / `mssql` / `mariadb` |
| `DATABASE_CONNECTION_STRING` | Provider-specific |

## Volumes

The image runs as **non-root user UID 10001** (group 10001). If you bind
mount host directories instead of using the named volumes the compose
file ships with, you must `chown` them first:

```bash
sudo chown -R 10001:10001 /var/photoshare/{config,uploads,thumbnails,custom_resources}
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

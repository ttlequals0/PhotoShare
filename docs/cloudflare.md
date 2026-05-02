# Cloudflare Tunnel + Security Ruleset for PhotoShare

This is the recommended perimeter configuration for exposing PhotoShare
publicly via a Cloudflare Tunnel. Intended for an event with hundreds of
guests reaching the app via a hostname under your zone; assumes the Free
tier with optional notes for Pro tier features.

The application-side prerequisites (cookie `Secure` flag, body limits,
auth rate limiter, BCrypt password storage, fail-fast missing-secret
checks, non-root container, ForwardedHeaders middleware) all landed in
the hardening PRs (#4, #5, #6) before this perimeter is meaningful.

## 1. Cloudflare Tunnel (cloudflared) config

`/etc/cloudflared/config.yml`:

```yaml
tunnel: <YOUR_TUNNEL_UUID>
credentials-file: /etc/cloudflared/<UUID>.json

ingress:
  - hostname: photoshare.<your-domain>
    service: http://localhost:5000
    originRequest:
      connectTimeout: 30s
      tlsTimeout: 10s
      tcpKeepAlive: 30s
      keepAliveConnections: 100
      keepAliveTimeout: 90s
      httpHostHeader: photoshare.<your-domain>
      noTLSVerify: false
  - service: http_status:404
```

Origin port `5000` matches Kestrel binding. App runs HTTP internally;
tunnel terminates user-visible HTTPS at the edge.

## 2. SSL / TLS settings

Cloudflare dashboard -> SSL/TLS:

| Setting | Value |
|---------|-------|
| Encryption mode | **Full (strict)** |
| Minimum TLS version | **1.2** (move to 1.3 once your guests' devices are confirmed) |
| TLS 1.3 | On |
| Automatic HTTPS Rewrites | On |
| Always Use HTTPS | On |
| HSTS | max-age 31536000, includeSubDomains, preload (matches what the app emits) |

## 3. WAF Custom Rules

Security -> WAF -> Custom rules. Rules are evaluated in priority order;
lower number runs first.

### Rule 1: Block obvious abuse signatures

```
Expression:
(http.host eq "site.example.com") and (
  (ends_with(http.request.uri.path, ".php")) or
  (http.request.uri.path contains "/wp-admin") or
  (http.request.uri.path contains "/.env") or
  (http.request.uri.path contains "/.git/") or
  (lower(http.user_agent) contains "sqlmap") or
  (lower(http.user_agent) contains "nikto") or
  (lower(http.user_agent) contains "nuclei")
)

Action: Block
```

### Rule 2: Geo-blocking

```
Expression:
  not (ip.geoip.country in {"US" "CA" "GB"})         // adjust to your guest list

Action: Managed Challenge
```

If you have a clean list of countries guests are coming from, use
**Block** instead. Always whitelist your own home country to avoid
locking yourself out.

### Rule 3: Tor / hosting-provider IPs

```
Expression:
(http.host eq "site.example.com") and ((cf.threat_score gt 30) or (ip.src.continent eq "T1"))

Action: Managed Challenge
```

### Rule 4: Block POST /Admin from outside your IPs

```
Expression:
  (http.request.uri.path contains "/Admin") and
  (http.request.method eq "POST") and
  (not ip.src in {<your home / office IPs>})

Action: Block
```

Or replace this with a Cloudflare Access policy on `/Admin*` (section 6)
which gives the same protection plus SSO / OTP gating.

### Rule 5: Force a Turnstile challenge on registration / password reset

```
Expression:
  (http.request.uri.path eq "/Account/Register") or
  (http.request.uri.path eq "/Account/ResetPassword")

Action: Managed Challenge
```

Catches automated-only traffic; humans pass through transparently.

### Rule 6: Reject oversized request bodies to non-upload paths

```
Expression:
  (http.request.body.size gt 100000000) and
  (not http.request.uri.path eq "/Gallery/UploadImage")

Action: Block
```

The app already caps Kestrel `MaxRequestBodySize` at 256 MB; this is
defense in depth at the perimeter.

## 4. WAF Rate Limiting Rules

Security -> WAF -> Rate limiting rules. Free tier allows one rule; Pro
allows several. If on Free, prioritize Rule A.

### Rule A: Auth abuse

```
When:
  (http.request.method eq "POST") and
  (http.request.uri.path matches "^/Account/(Login|Register|ResetPassword)$")

Counting: by IP, by path
Threshold: 5 requests in 1 minute
Action: Block for 10 minutes
```

This pairs with the application's own per-IP 10/min auth limiter for
belt-and-suspenders.

### Rule B: Upload spam (Pro tier)

```
When:
  (http.request.uri.path eq "/Gallery/UploadImage") and
  (http.request.method eq "POST")

Counting: by IP
Threshold: 60 requests in 1 minute
Action: Managed Challenge for 5 minutes
```

### Rule C: Generic burst protection (Pro tier)

```
When: anything not /Gallery/UploadImage
Counting: by IP
Threshold: 200 requests in 1 minute
Action: Managed Challenge
```

## 5. Bot management

- **Free tier**: Security -> Bots -> enable Bot Fight Mode. Catches
  obvious bots.
- **Pro tier ($25/mo)**: switch to Super Bot Fight Mode -
  - Definitely automated -> Block
  - Likely automated -> Managed Challenge
  - Verified bots (Googlebot etc.) -> Allow
  - Static resources -> don't fight (avoid breaking image loads)

## 6. Cloudflare Access for /Admin (Zero Trust, free for up to 50 users)

Zero Trust -> Access -> Applications -> Add application -> Self-hosted:

```
Application:    photoshare-admin
Subdomain:      photoshare.<your-domain>
Path:           /Admin*
Session:        2 hours
Identity providers:  One-time PIN (email) or your Google / GitHub
```

Policy:
- Action: Allow
- Include: Emails ending with `@<your-domain>` (or specific list)

Puts a Cloudflare-managed login wall **in front** of the app's own admin
UI, so even if the app's auth has a bug, Cloudflare gates the admin
path. A leaked admin password alone isn't enough to log in.

## 7. Turnstile on registration form

Embed in the Razor view:

```html
<div class="cf-turnstile" data-sitekey="<your-site-key>"></div>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async></script>
```

Server-side verify in `AccountController.Register` POST: take
`cf-turnstile-response` from the form, POST to
`https://challenges.cloudflare.com/turnstile/v0/siteverify` with your
secret key, reject the registration if not valid.

This is a code change; not yet in the repo. Track as a separate PR if
you want it before the event.

## 8. Cache rules

Caching -> Cache rules:

| Path pattern | Action |
|--------------|--------|
| `/Account/*`, `/Admin/*`, `/MultiFactor/*`, `/api/*` | Bypass cache |
| `/uploads/*`, `/thumbnails/*` | Cache everything, edge TTL 1 day, browser TTL 1 hour |
| `/dist/*` (webpack output) | Cache everything, edge TTL 1 month, immutable |
| Everything else | Standard |

## 9. App-side coordination

`ForwardedHeaders` middleware was wired in PR #5 (commit `2948b79`) so
the app correctly sees HTTPS when running behind the tunnel. Without
this the new cookie `SecurePolicy=Always` (PR #4) would silently drop
`Set-Cookie` on every request - login broken.

The middleware trusts loopback (127.0.0.0/8 + ::1) plus RFC1918
ranges (10/8, 172.16/12, 192.168/16). If you run cloudflared on a
host outside those ranges, edit `StartupExtensions.cs`
`Configure<ForwardedHeadersOptions>` to add the correct network.

## Required GitHub repo secrets

Before the first tag push that triggers a Docker Hub release:

- `DOCKERHUB_USERNAME` - your Docker Hub user
- `DOCKERHUB_TOKEN` - access token scoped to push the `photoshare`
  repo only (not full account)

Settings -> Secrets and variables -> Actions -> New repository secret.

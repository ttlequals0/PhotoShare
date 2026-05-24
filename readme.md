<div align="center">
  <img src="Memtly.Core/Memtly.Core/wwwroot/images/photoshare-logo-light.svg" alt="PhotoShare" width="560" />
  <h1>PhotoShare</h1>
</div>

## About

PhotoShare is an independent fork of [Memtly.Community](https://github.com/Memtly/Memtly.Community) (formerly WeddingShare). Most credit and most of the codebase belongs to the upstream maintainers; this fork carries hardening, branding, and UI changes specific to its operator. See [`CHANGELOG.md`](CHANGELOG.md) for everything that diverges from upstream.

## What this fork adds vs upstream

Concrete changes shipped since the 2.0.0 fork point. The full per-version detail is in [`CHANGELOG.md`](CHANGELOG.md).

### Security hardening

- Global anti-forgery (CSRF) validation on every `POST`/`PUT`/`DELETE`/`PATCH`; jQuery AJAX auto-attaches the token header. `[AllowAnonymous]` is now explicit on every endpoint that needs it rather than relying on absence.
- `PasswordHelper` uses `RandomNumberGenerator` instead of `System.Random`. Email-verification and password-reset tokens are signed with `IDataProtector` so an attacker who only has the email link can't forge or replay tokens.
- MFA failures count toward the same lockout bucket as password failures and are rate-limited; previously MFA was unrestricted.
- Cookies set in controllers carry `Secure` + `SameSite=Lax`. Session and auth cookies do the same.
- Upload validation: magic-byte sniffing on both images and video uploads; path-traversal hardening on `gallery.Identifier`; zip-slip protection on backup imports; Linux-specific filename sanitization beyond what upstream's `FileHelper` did.
- Twelve log sites that previously echoed user-controlled or sensitive values now sanitize or redact. `AccessLogMiddleware` strips CR/LF from log fields.
- Content-Security-Policy `script-src` no longer needs `'unsafe-inline'` or `'unsafe-eval'`: every `<script>` block was moved into `main.js`, every `on*=` handler converted to `addEventListener`. CSP wiring fails loudly at startup instead of silently swallowing exceptions.
- `ADMIN_ALLOWED_NETWORKS` env gate (`AdminNetworkGate` middleware) limits `/Account`, `/Admin`, `/MultiFactor` to a configured CIDR allowlist. The login button is hidden from clients outside the allowlist so the surface isn't visible to scanners.

### Installable PWA

- `manifest.webmanifest`, generated icon set (16-512 plus apple-touch-icon-180), `theme-color` for light and dark, modern `mobile-web-app-capable` meta alongside the Apple-prefixed legacy variant.
- Service worker (`/sw.js`) with route-aware strategies: network-first for HTML and `/Gallery/*` so uploads always reach the server fresh; cache-first for hashed `wwwroot/dist/` assets; stale-while-revalidate for the home shell. SW registration URL is version-stamped (`/sw.js?v=<version>`) so each release bypasses upstream HTTP and Cloudflare caches.
- `Cache-Control: no-cache` on `/sw.js` and the manifest so the edge can't pin an old worker.

### Uploads

- Chunked uploads via Resumable.js: 25 MB chunks, parallel transfers, retry per chunk, resumes across browser reloads. Replaces the upstream single-POST flow that broke for files larger than a request body limit.
- Server-side HEIC -> JPEG sidecar on upload (ffmpeg) plus lazy-loaded browser-side libheif fallback for HEIC preview in non-Safari browsers. iPhone Camera's default format now uploads cleanly.
- Client-side allowed-file-type pre-check so the user gets immediate feedback instead of a server-side 415 after the bytes have been transferred.
- `.webp` added to default `Allowed_File_Types`; Postgres NUL-byte handling fix so filenames with embedded zeros don't fail with `22021: invalid byte sequence`.

### Operations & deploy

- `docker-compose.yml` for a Postgres-backed deploy with required secrets fail-fast (`${ENCRYPTION_KEY:?...}` style). `.env.example` documents every variable with a hint. `docs/docker.md` walks through the full compose deploy; `docs/cloudflare.md` documents Tunnel config, WAF custom + rate-limit rules, Access for `/Admin*`, Turnstile on `/Account/Register`, and cache rules.
- Container base swapped to `mcr.microsoft.com/dotnet/aspnet:9.0-noble-chiseled-extra`: smaller image, no shell, no package manager, no curl or wget. Healthcheck moved off the container (it has no shell to run one) onto the host or Cloudflare Tunnel origin probe; `/healthz` is the endpoint.
- FFmpeg and FFprobe are baked into the image at `/app/ffmpeg` so the runtime auto-download path is no longer required and the container has no network dependency on first start.
- Structured per-request access logging via `AccessLogMiddleware` (one JSON line per request, includes method, path, status, ms, user id when authenticated). Configurable log level.
- Trivy filesystem scan runs every CI build (advisory). CodeQL runs on every PR + master + weekly cron.

### UI, brand, accessibility

- Reskinned to the PhotoShare brand: SVG logos (light + dark), 128x128 icons, manifest theme colours `#1b1938` / `#ffffff`, footer copy, navbar wordmark. Upstream Memtly logos and sponsor avatars are preserved for attribution.
- Theme system collapsed to Auto / Light / Dark; the previous mix of theme files was confusing and Auto wasn't honoured consistently.
- Self-hosted Inter Variable font (`font-display: swap`), design tokens in `src/css/tokens.css`, dark-mode contrast fixes for headings, modal bodies, and form inputs (some were unreadable against the dark surface before).
- Mobile-first sizing pass: navbar logo capped at 32x32, hero composition uses `.hero-surface` utility, viewport tightened for installable PWA layout on phones.
- Accessibility: dropped `'sha256-...'` workarounds in favour of releasing focus from inside modals before Bootstrap sets `aria-hidden` on them, so AT users don't see focused-but-hidden buttons.

### Analytics

- Cloudflare Web Analytics manual install: token comes from the `Memtly__Trackers__CloudflareInsights__SiteToken` env var. Defaults empty, so deploys without the var get no CF script and no behaviour change. The token never lives in the repo.
- When enabling, also turn off Web Analytics auto-injection for the zone in the Cloudflare dashboard. CF's auto-injected inline bootstrap rotates its body per request, which cannot be allow-listed via a CSP hash; that's why we install it ourselves as an external script tag.
- Self-hosted Umami is still supported via the existing `Memtly.Trackers.Umami` config block.

## Quick start

Postgres-backed deploy via Docker Compose:

```bash
git clone git@github.com:ttlequals0/PhotoShare.git
cd PhotoShare
cp .env.example .env
# edit .env - the app refuses to start if ENCRYPTION_KEY, ENCRYPTION_SALT,
# ADMIN_EMAIL, or ADMIN_PASSWORD are empty or set to placeholder values.
docker compose up -d
docker compose logs -f app
```

Open http://localhost:5000 and log in with the admin credentials from `.env`.

Full env-var reference: [`.env.example`](.env.example) for the operator-set values, and [`docs/docker.md`](docs/docker.md) for the underlying `Memtly__Section__Key` bindings the container reads (required secrets, public-exposure recommendations, database, analytics, admin network gate, Cloudflare Tunnel sidecar).

For public exposure (Cloudflare Tunnel + WAF rules), see:
- [`docs/docker.md`](docs/docker.md) - compose deploy details, env vars, volume layout, backups
- [`docs/cloudflare.md`](docs/cloudflare.md) - Tunnel config, WAF custom + rate-limit rules, Cloudflare Access for `/Admin*`, Turnstile on `/Account/Register`, cache rules
- [`CHANGELOG.md`](CHANGELOG.md) - release notes; the operator follow-up checklist for 2.0.0 lists every value you need to set before deploying publicly

Memtly (formerly WeddingShare) is a very basic site with only one goal. It provides you and your guests a way to share memories of and leading up to an event. Simply provide your guests with a link to a gallery either via a Url or even better by printing out the provided QR code and handing it out to your guests on arrival. Doing so will allow them to view your journey up to this point and give them the ability to share their experience on the day by uploading their own images and videos. 

## Why Rebrand / Rename?

Originally this project was called `WeddingShare`. As more and more people started using it we quickly realised that people were using it for more than just weddings. We've seen concerts, friend trips, and a whole host of other events. It only felt right that we rebrand to something more "generic" to cover all bases and reduce confusion when inevitably someone recommends it to a friend and their response is "but I'm not getting married". That's where Memtly comes in... Now along with the improved look, we also have an improved name.

## Support

Thank you to everyone that supports this project. For anyone that hasn't yet I would be grateful if you would show some support by "buying me a coffee" or sponsoring on GitHub using the links below. All proceeds will go towards maintaining and improving this project.

- BuyMeACoffee - https://buymeacoffee.com/memtly
- GitHub Sponsors - https://github.com/sponsors/Memtly

## Demo

Why not give it a try before installing? Take a look at the demo site here - https://demo.memtly.com/

## Documentation & Setup

For a setup steps and a full list of configurable options please view the documentation site - https://docs.memtly.com.

## Disclaimer

Warning. This is open-source software (GPL-V3), and while we make a best effort to ensure releases are stable and bug-free, there are no warranties. Use at your own risk.

## Notes

Not all image formats are supported in browsers so although you may be able to add them via the `GALLERY_ALLOWED_FILE_TYPES` environment variable they may not be supported. One such format is Apples .HEIC format. It is a licensed format which as a result has not been widely adopted outside of Apple devices. This is outside the control of this project and will not be supported, instead let users devices automatically convert the images to .JPG format. Please do not allow the .HEIC format, any issues opened will be closed as this project wil not support it until it is adopted by modern web browsers.

## Links
- Documentation - https://docs.memtly.com
- GitHub - https://github.com/Memtly/Memtly.Community
- DockerHub - https://hub.docker.com/r/memtly/memtly
- BuyMeACoffee - https://buymeacoffee.com/memtly
- GitHub Sponsors - https://github.com/sponsors/Memtly

## Screenshots

### Desktop (Light)

![Homepage](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Light/Homepage.png)

![Gallery - Default](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Light/Gallery_Default.png)

![Gallery - Presentation](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Light/Gallery_Presentation.png)

![Gallery - Slideshow](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Light/Gallery_Slideshow.png)

![Admin Area - Reviews Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Light/AdminPanel_ReviewsTab.png)

![Admin Area - Galleries Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Light/AdminPanel_GalleriesTab.png)

![Admin Area - Users Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Light/AdminPanel_UsersTab.png)

![Admin Area - Resources Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Light/AdminPanel_ResourcesTab.png)

![Admin Area - Settings Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Light/AdminPanel_SettingsTab.png)

![Admin Area - Audit Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Light/AdminPanel_AuditTab.png)

![Admin Area - Data Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Light/AdminPanel_DataTab.png)

### Desktop (Dark)

![Homepage](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Dark/Homepage.png)

![Gallery - Default](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Dark/Gallery_Default.png)

![Gallery - Presentation](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Dark/Gallery_Presentation.png)

![Gallery - Slideshow](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Dark/Gallery_Slideshow.png)

![Admin Area - Reviews Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Dark/AdminPanel_ReviewsTab.png)

![Admin Area - Galleries Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Dark/AdminPanel_GalleriesTab.png)

![Admin Area - Users Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Dark/AdminPanel_UsersTab.png)

![Admin Area - Resources Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Dark/AdminPanel_ResourcesTab.png)

![Admin Area - Settings Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Dark/AdminPanel_SettingsTab.png)

![Admin Area - Audit Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Dark/AdminPanel_AuditTab.png)

![Admin Area - Data Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Desktop/Dark/AdminPanel_DataTab.png)

### Mobile (Light)

![Homepage](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Light/Homepage.png)

![Gallery - Default](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Light/Gallery_Default.png)

![Gallery - Presentation](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Light/Gallery_Presentation.png)

![Gallery - Slideshow](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Light/Gallery_Slideshow.png)

![Admin Area - Reviews Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Light/AdminPanel_ReviewsTab.png)

![Admin Area - Galleries Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Light/AdminPanel_GalleriesTab.png)

![Admin Area - Users Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Light/AdminPanel_UsersTab.png)

![Admin Area - Resources Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Light/AdminPanel_ResourcesTab.png)

![Admin Area - Settings Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Light/AdminPanel_SettingsTab.png)

![Admin Area - Audit Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Light/AdminPanel_AuditTab.png)

![Admin Area - Data Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Light/AdminPanel_DataTab.png)

### Mobile (Dark)

![Homepage](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Dark/Homepage.png)

![Gallery - Default](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Dark/Gallery_Default.png)

![Gallery - Presentation](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Dark/Gallery_Presentation.png)

![Gallery - Slideshow](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Dark/Gallery_Slideshow.png)

![Admin Area - Reviews Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Dark/AdminPanel_ReviewsTab.png)

![Admin Area - Galleries Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Dark/AdminPanel_GalleriesTab.png)

![Admin Area - Users Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Dark/AdminPanel_UsersTab.png)

![Admin Area - Resources Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Dark/AdminPanel_ResourcesTab.png)

![Admin Area - Settings Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Dark/AdminPanel_SettingsTab.png)

![Admin Area - Audit Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Dark/AdminPanel_AuditTab.png)

![Admin Area - Data Tab](https://raw.githubusercontent.com/Memtly/Memtly.Assets/master/Screenshots/Community/Mobile/Dark/AdminPanel_DataTab.png)

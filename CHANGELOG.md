# Changelog

All notable changes to PhotoShare are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
PhotoShare is an independent fork of [Memtly.Community](https://github.com/Memtly/Memtly.Community);
the version line restarts at 2.0.0 to signal fork divergence and the breaking
changes shipped below.

## [Unreleased]

## [2.0.7] - 2026-05-02

### Added

- **Auto-approve gallery uploads** — UI clarification on the existing
  per-gallery `Memtly:Gallery:Require_Review` setting. The data layer
  already keyed this setting per gallery (`GalleryController.cs:389`)
  and the upload handler already routes to `GalleryItemState.Approved`
  when off, but the UI was buried under Account → Settings → Gallery
  → (pick gallery) → Reviews with no explanation that "Require Review:
  No" is the auto-approve switch. Added a banner at the top of the
  Reviews override page spelling out the trade-off.

### Removed

- Stray `wwwroot/sponsors.json` orphan from the 2.0.4 sponsor module
  deletion.

## [2.0.6] - 2026-05-02

### Fixed

- **Dark-mode form inputs and headings finally readable.** Upstream
  Memtly's `themes/darkblue.css` pins `input, select` text to
  `--primary-text-1` and `h1..h6` to `--primary-bg-1` with
  `!important`. PhotoShare's amethyst palette inverted those values
  for buttons (which need the contrast pair), but the same pair on
  inputs renders purple-deep text on a near-purple-deep page - text
  vanishes. site.css now retakes the cascade with matching
  `!important` overrides on `input.form-control`, `select.form-select`,
  textareas, `h1..h6`, `.form-label`, and modal-body descendants. All
  bind to `var(--ink)` / `var(--surface-raised)` / `var(--border)` so
  they flip with the rest of the design system.
- **Modal dialog text contrast.** `.modal .modal-body p`,
  `.modal .modal-body label`, and the native `<dialog>` element
  family all force `color: var(--ink) !important` so labels and
  helper text stay readable inside guest-name / theme-picker /
  identity-check / qr-code dialogs.

### Changed

- **Mobile-first sizing pass.** Navbar logo capped at 32x32 (the SVG
  is 128x128 natively and overflowed at narrow widths). Type scale
  drops further below 480px (h1: 28px, h2: 22px, h3: 20px). Modal
  margins and width clamp to viewport with a 12px gutter on both
  sides. Card paddings shrink so the gallery selector doesn't
  overrun the screen edge on iPhone-class devices.

## [2.0.5] - 2026-05-02

### Fixed

- **Hotfix: restore `'unsafe-inline'` on CSP `style-src`.** 2.0.4
  dropped `'unsafe-inline'` from both `script-src` and `style-src`
  on the assumption that webpack's `MiniCssExtractPlugin` meant no
  runtime style injection happens. That was wrong - jQuery `.css()`,
  Bootstrap collapse/dropdown/modal animations, and FontAwesome's
  SVG-replacement JS all set `element.style` at runtime, which the
  browser counts as inline style under CSP. With `style-src 'self'`
  alone, the live page rendered with no layout, FontAwesome icons
  blew up to natural SVG size, and modals lost their transitions.
  `script-src 'self'` (no unsafe-inline) stays - the inline-script
  cleanup from 2.0.4 still holds.

## [2.0.4] - 2026-05-01

### Added

- **HEIC/HEIF photo upload acceptance.** iOS Camera defaults to HEIC for
  still photos; uploads were rejected because `.heic`/`.heif` weren't on
  the allowlist and ImageSharp's default codec set returns null on the
  format. Allowed_File_Types now includes `.heic,.heif`. New
  `HeifHeaderMatchesExtension` validates the ftyp box brand against the
  HEIF family (`heic`, `heix`, `heim`, `heis`, `hevc`, `hevx`, `mif1`,
  `msf1`). HEVC video already worked - it ships inside `.mov` containers
  which were already on the allowlist.
- **HEIC thumbnail generation via ffmpeg.** `ImageHelper.GenerateThumbnail`
  now routes HEIC/HEIF through the same Xabe.FFmpeg snapshot pipeline
  the video frame extractor uses. ffmpeg decodes the HEIC, writes a
  JPEG, then the existing ImageSharp resize path produces the final
  WebP thumbnail.
- **Cloudflare Tunnel verification runbook** added to `docs/cloudflare.md`
  - five `curl` checks to walk before going public.

### Changed

- **Theme switcher reduced to Auto / Light / Dark.** PhotoShare ships
  a single brand palette so the upstream Memtly Green/Pink themes were
  noise. The enum stays unchanged for backward compat with persisted
  Settings rows; the picker only surfaces three options now and labels
  them functionally.
- **Username column width 10 -> 64.** `CoreDbContext` `HasMaxLength(64)`
  on `Users.Username`. Operator must run
  `cd Memtly.Core/Memtly.Core && pwsh ./generate-migrations.ps1
  -MigrationName ExpandUsernameLength` from a dev environment with
  pwsh + dotnet SDK + MySQL/Postgres/sqlcmd to emit the per-provider
  migration files; the deployed app picks them up on the next startup.
- **`UrlHelper.GenerateBaseUrl` prefers `ctx.Host` over `Memtly:Base_Url`.**
  Visitors who came in on a non-canonical hostname (LAN reverse-proxy,
  staging, alternate domain) no longer get redirected to the
  configured `BASE_URL` host, which often doesn't resolve from their
  network. `BASE_URL` still wins when there's no request context
  (background workers, notification email URL building).

### Fixed

- **Dark mode contrast.** Headings (`h1` through `h6`) now declare
  `color: var(--ink)` so they flip with the theme; previously the
  upstream Memtly theme CSS hard-coded a heading color and the
  dark-mode token cascade was lost. Form inputs (`.form-control`,
  `.form-select`) switched from `var(--surface)` to `var(--surface-raised)`
  so the input box stays visually distinct from the page background in
  dark mode.
- **Logo stays visible in dark mode.** Layout `<img src="@logo">`
  replaced with `<picture>` + `<source media="(prefers-color-scheme: dark)">`
  so the dark-on-dark logo SVG variant loads when the OS prefers
  dark.
- **Sponsor lightning-bolt button removed** from the lower-left of
  every page. The whole sponsors module (`src/modules/sponsors/`,
  `Controllers/SponsorsController.cs`, `Views/Sponsors/`) is deleted -
  upstream-Memtly artifact, irrelevant on a private fork. `/Sponsors`
  route now 404s.

### Security

- **CSP `'unsafe-inline'` and `'unsafe-eval'` removed** from
  `script-src`; `'unsafe-inline'` removed from `style-src`. Six inline
  artifacts in Razor views were rewritten:
  - service-worker registration moved into `main.js`
  - `<svg style="display:none">` -> `<svg class="svg-sprite">`
  - media viewer `style="opacity: 0;"` -> `.media-viewer-popup-hidden` class
  - error page inline font sizes -> `.error-title` / `.error-detail` classes
  - `_Layout` and `_BasicLayout` `onerror=` on the navbar logo
    replaced with `<picture>` + `<source>` (also fixes dark-mode logo)
  Webpack's `MiniCssExtractPlugin` was already in use, so dropping
  `style-src 'unsafe-inline'` doesn't affect runtime CSS injection -
  there isn't any.

## [2.0.3] - 2026-05-01

### Fixed

- **Brand assets at root scope.** SVG logos and PNG icons are now mirrored
  into `PhotoShare/wwwroot/{images,icons}/` so they serve at `/images/...`
  and `/icons/...` instead of only `/_content/Memtly.Core/...`. The
  appsettings default Logo path is back to `/images/photoshare-logo-light.svg`
  (matching what's already persisted in the Settings table on existing
  deploys) and the broken-image icon next to "PhotoShare" goes away.
- **`/manifest.webmanifest` 404.** The manifest moved to
  `PhotoShare/wwwroot/manifest.webmanifest` so it serves at the root
  scope the layout's `<link rel="manifest" href="~/manifest.webmanifest">`
  expects. Icon srcs inside the manifest now use root paths too.
- **Theme colors weren't actually PhotoShare's.** `themes/blue.css` and
  `themes/darkblue.css` (the AutoDetect default for the Community
  variant) shipped upstream Memtly's blue/indigo palette, which loaded
  *after* `main.css` and overrode the design tokens. The theme files are
  now rewritten with PhotoShare's amethyst/lavender/parchment values
  (variable names preserved so the existing `--bs-*` Bootstrap mappings
  continue to work).
- **Footer reads "PhotoShare", not "Memtly".** Layout footer
  copyright string updated; sponsor badges (GitHub Sponsors,
  BuyMeACoffee) removed - they were upstream-Memtly artifacts and
  irrelevant on a private fork.
- **Layout icon links.** `<link rel="icon">` and `apple-touch-icon`
  references switched from `~/_content/Memtly.Core/icons/` to `~/icons/`
  for the root-scope copies.

## [2.0.2] - 2026-05-01

### Fixed

- **Rate limiter starved page loads.** The token bucket (120 tokens, 2/sec
  replenishment, partitioned per `RemoteIpAddress`) was small enough that
  one page load's CSS/JS/font/icon burst could exhaust it for a minute -
  and behind a Cloudflare Tunnel every visitor shares the sidecar's IP
  until `ForwardedHeaders` rewrites the source. Result: the login page
  rendered unstyled, with `429 Too Many Requests` on `/dist/main.css`,
  `/_content/Memtly.Core/images/logo.png`, `/manifest.webmanifest`,
  `/Language/GetTranslations`, etc. Static-asset paths (`/_content/*`,
  `/dist/*`, `/icons/*`, `/images/*`, `/fonts/*`, `/favicon*`,
  `/manifest.webmanifest`, `/sw.js`, `/healthz`) now bypass the limiter
  entirely; the general bucket is bumped to 600 tokens with 30/sec
  replenishment.
- **Brand logo 404.** `appsettings.json -> Memtly.Logo` pointed at
  `/images/photoshare-logo-light.svg`, but the SVG ships under
  `Memtly.Core/wwwroot/images/` and is served at
  `/_content/Memtly.Core/images/photoshare-logo-light.svg`. The layout's
  `onerror` fallback masked it as `logo.png`, but the `429` flood made
  even that fail. Default value corrected.

## [2.0.1] - 2026-05-01

### Fixed

- **Compose env var binding** — `docker-compose.yml` mapped shorthand names
  (`ENCRYPTION_KEY`, `ACCOUNT_ADMIN_EMAIL`, `DATABASE_TYPE`, `FORCE_HTTPS`,
  `BASE_URL`) that ASP.NET Core's environment variable provider does not
  bind to anything. Containers booted with empty `appsettings.json`
  defaults and hit the `EnforceRequiredSecurityConfig` fail-fast on every
  start. Renamed to the proper `Memtly__Section__Key` form (double
  underscore replaces the config-key colon).
- **FFmpeg auto-download path on chiseled images** —
  `Memtly.Core/Memtly.Core/Configurations/FfmpegConfiguration.cs` defaulted
  the install path to `/ffmpeg`, which the chiseled non-root user (uid
  1654) cannot write to. Default is now `/app/ffmpeg`. Operators no longer
  need an `FFMPEG__InstallPath` override.

### Documentation

- **`docs/cloudflare.md`** — host-scoped the WAF expressions
  (`http.host eq "..."`) so a shared Cloudflare account doesn't apply
  PhotoShare rules to unrelated tunnels. User-agent matches now lower-case
  the input (`lower(http.user_agent) contains "sqlmap"`) so casing tricks
  don't bypass the rule. Path matches use `ends_with()` for `.php` and
  leading slashes for `wp-admin`/`.env`/`.git/` to avoid false positives
  on legitimate query strings or filenames.

### Added

- **`docker-compose.yml`** for the recommended Postgres-backed deploy.
  Runs as the chiseled built-in `app` user (UID 1654), ships an optional
  cloudflared sidecar (commented), uses named volumes that auto-resolve
  UID ownership.
- **`.env.example`** documenting every required secret with hints on
  generating strong random values via `openssl rand`.
- **`docs/docker.md`** walking through the compose deploy: env vars
  (`Memtly__Section__Key` form, double underscore replaces colon),
  volume layout, host-path `chown` for non-default mounts, Cloudflare
  Tunnel sidecar usage, update procedure, and backup commands for
  Postgres + uploads volume.
- **`/healthz` liveness endpoint** for Cloudflare Tunnel origin checks
  / external uptime monitors. Anonymous, no DB hit, returns 200 /
  "Healthy". The chiseled image has no shell, so probe from outside
  the container (host curl, tunnel origin check, external monitor).

### Security

- **Container base swapped to `mcr.microsoft.com/dotnet/aspnet:9.0-noble-chiseled-extra`.**
  Eliminates **all 9 HIGH and 1 CRITICAL** Trivy CVEs from the previous
  Debian base (`zlib1g`, `libsystemd0`, `libgcrypt20`, `ncurses-*`,
  `libtinfo6`, all upstream-`will_not_fix` or unfixed). Image size
  drops 417 MB to 252 MB. Side effects: built-in non-root user is now
  `app` (UID 1654) instead of `photoshare` (UID 10001); no shell, no
  `wget`, no `curl` in the runtime image, so the in-container
  `HEALTHCHECK` is removed - operators probe `/healthz` from outside
  (host curl, Cloudflare Tunnel origin check, external monitor).
  `docker-compose.yml` updated to drop the in-container app
  healthcheck and document the UID change.

- **Global anti-forgery (CSRF) protection.** `AutoValidateAntiforgeryTokenAttribute`
  is now a global filter; every POST/PUT/DELETE/PATCH endpoint requires a
  valid token. `_Layout.cshtml` renders `@Html.AntiForgeryToken()` once
  and `main.js` installs an `$.ajaxSend` hook that injects the
  `RequestVerificationToken` header on every jQuery AJAX call. Form
  POSTs continue to work via the existing `__RequestVerificationToken`
  hidden input. Closes 21 CodeQL `cs/web/missing-token-validation`
  alerts across `AccountController`, `GalleryController`,
  `MultiFactorController`, `NotificationController`, `MediaViewerController`,
  `HomeController`, `LanguageController`, `ThemesController`, `AuditController`.
- **`PasswordHelper` now uses cryptographically-secure randomness.**
  Replaces `System.Random` with `RandomNumberGenerator.GetInt32`. Affects
  `GenerateGallerySecretKey`, `GenerateSecretCode`, and `GenerateTempPassword`
  (used for the bootstrap admin if `ADMIN_PASSWORD` defaults are taken,
  the System user's password, the email-verification `Validator`, and
  ad-hoc gallery secret keys). Closes 4 CodeQL `cs/insecure-randomness`.
- **Cookies set in controllers now `Secure` + `SameSite=Lax`.** Five
  cookie writes in `GalleryController`, `LanguageController`,
  `ThemesController` were missing the `Secure` flag. Closes 5 CodeQL
  `cs/web/cookie-secure-not-set`.
- **Stop logging user-controlled / sensitive values.** Twelve log sites
  across `AccountController`, `HomeController`, `MediaViewerController`,
  `LanguageController`, `ThemesController`, `ConfigHelper`,
  `SettingsHelper`, `AuditHelper` were interpolating user-controlled or
  sensitive identifiers (email, username, theme name, language code,
  config-key paths) into log messages. Switched to constant message
  templates - the exception's stack trace still tells operators where
  the failure was. Closes 7 `cs/log-forging`, 7
  `cs/exposure-of-sensitive-information`, 5
  `cs/cleartext-storage-of-sensitive-information`.
- **`[AllowAnonymous]` made explicit** on
  `LanguageController.ChangeDisplayLanguage` and
  `ThemesController.ChangeDisplayTheme`. Closes 2 CodeQL
  `cs/web/missing-function-level-access-control`.
- **Integer-multiplication overflow casts.** `EFDatabaseHelper.
  FlushLogsOlderThan` and `GalleryModel.CalculateUsage` now do their
  arithmetic in `double` to avoid losing precision on large values.
  Closes 2 CodeQL `cs/loss-of-precision`.

- **Video uploads now magic-byte validated** alongside images.
  `ImageHelper.ContentMatchesExtension` reads the first 16 bytes of
  uploaded video files and rejects mismatches:
    - `.mp4` / `.mov` / `.m4v` / `.m4a`: `ftyp` at offset 4 (ISO Base Media)
    - `.webm` / `.mkv`: EBML magic `1A 45 DF A3`
    - `.avi`: `RIFF` ... `AVI `
  Closes the audit hole "video uploads still rely on extension whitelist"
  without requiring ffmpeg in the image (the previous deferred plan).
- **MFA failure now counts toward lockout and is rate-limited.**
  `AccountController.ValidateMultifactorAuth` previously fell through
  silently on a bad TOTP - an attacker holding the right password
  could brute-force the 6-digit code. Now calls `FailedLoginDetected`
  on TOTP mismatch (5-strikes lockout) and the auth-overlay rate
  limiter (10/min/IP fixed window) covers the endpoint.
- **Email verification + password reset tokens are now protected by
  ASP.NET Core's `ITimeLimitedDataProtector`.** Replaces the previous
  base64-encoded JSON envelope. Tokens are signed (tamper-resistant)
  and **expire after 24 hours**. Underlying per-user `Validator`
  secret-code check is retained as defense in depth.

### Added

- **Design system foundation** (`src/css/tokens.css`) - Superhuman-inspired
  tokens for color (hue + semantic), typography (Inter Variable at the
  non-standard 460/540 weights from DESIGN.md), 8px spacing scale,
  binary 8/16px radius, restrained shadows. Tokens flip light/dark via
  `prefers-color-scheme` AND via Memtly's `<body data-theme>` cookie.
- **Inter Variable self-hosted** at `src/fonts/InterVariable.woff2`
  (rsms/inter, OFL).
- **PWA artifacts**:
  - `wwwroot/manifest.webmanifest` (theme/background colors, standalone
    display, portrait orientation).
  - `wwwroot/sw.js` service worker with three caching strategies:
    cache-first for hashed bundle output, stale-while-revalidate for the
    app shell, never cache for `/uploads`, `/thumbnails`, `/temp`,
    `/custom_resources`.
  - PNG icon set at `wwwroot/icons/icon-{16,32,180,192,256,384,512}.png`
    (rsvg-convert from the PhotoShare icon SVG, white background composited).
- **`.hero-surface` utility** - DESIGN.md gradient hero composition
  (radial lavender glow over a vertical purple gradient). Children get
  white-on-purple typography automatically.

### Changed

- **Body typography** uses tokens: Inter at weight 460, type-body 16/1.5,
  ink color, surface background.
- **Headings** (`h1`-`h6` and `.h1`-`.h6`) follow DESIGN.md type scale
  with negative letter-spacing on display-tier sizes; mobile breakpoint
  at 768px scales h1/h2/h3 down.
- **Bootstrap components reskinned** to consume tokens:
  - Buttons: `.btn`, `.btn-primary` (warm cream + charcoal),
    `.btn-secondary` (charcoal + white), `.btn-link`. Semantic variants
    (`.btn-success`, `.btn-danger`, `.btn-warning`, `.btn-info`)
    intentionally untouched.
  - Forms: `.form-control`, `.form-select`, `.form-label`, `.form-text`,
    `.form-check-input`, `.invalid-feedback`. Charcoal focus border with
    3px amethyst@15% ring.
  - Cards: 16px radius, parchment border, `--elevation-card` shadow,
    24/16px body padding.
  - Navbar: surface bg, parchment bottom border, Inter at 460/540, plus
    `.navbar-dark` inversion.
  - Modals, alerts, tables, dropdowns, pagination, badges, list-groups,
    tabs (`.nav-tabs`/`.nav-pills`), toasts, spinners.
- **App-specific selectors** `.btn-upload`, `.upload_drop`, `.image-tile`
  pulled onto tokens without changing structural behavior.
- **Apple touch icon** now points to a 180x180 PNG (was a wide-aspect
  SVG that iOS Safari rendered inconsistently).
- **Browser favicon** uses dedicated 16x16 / 32x32 PNGs (was the wide
  logo SVG with a mismatched `type="image/png"` attribute).
- **Logo backgrounds removed** from the four PhotoShare brand SVGs so
  they compose cleanly on whatever surface they land on. Dark variants
  retain their semi-transparent heroGlow overlay (alpha-aware).
- **Logo size in README** bumped 240 -> 560 px.

### Documentation

- `docs/cloudflare.md` - Cloudflare Tunnel + WAF ruleset for public
  exposure (Tunnel config, SSL/TLS Full Strict, custom rules,
  rate-limiting, Bot Fight Mode, Cloudflare Access for `/Admin*`,
  Turnstile on `/Account/Register`, cache rules, ForwardedHeaders
  coordination).

## [2.0.0] - 2026-05-01

First PhotoShare release. Forked from Memtly.Community 1.0.2.2 at SHA `2dd5f06`.

### Security

- **Password storage migrated to BCrypt** (workFactor 12) from the previous
  reversibly-encrypted scheme. Legacy verifier path keeps existing logins
  working and rehashes on first successful login post-deploy. Single host
  compromise no longer yields recoverable passwords.
- **Auth + session cookies hardened**: `HttpOnly=true`,
  `SecurePolicy=Always`, `SameSite=Lax`. Login no longer trivially XSS-able.
- **Request body limits clamped** to 256 MB (Kestrel + FormOptions); memory
  buffer threshold dropped to 64 KB so large uploads spill to disk instead
  of staying in memory. Closes a trivial OOM DoS.
- **HSTS** set to 365 days with `IncludeSubDomains` and `Preload`.
- **App-level rate limiter** added: global 120/min/IP token bucket plus a
  fixed 10/min/IP overlay for POSTs to `/Account/{Login,Register,ResetPassword}`.
  Defense in depth behind the Cloudflare WAF.
- **Response headers added**: `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`,
  `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-site`.
  CSP gains `object-src 'none'` and `base-uri 'self'`.
- **Magic-byte upload validation** via `ImageSharp.IdentifyAsync`. Files
  whose actual format does not match the claimed extension are rejected.
  Closes the "HTML renamed to .png served from /uploads" hole.
- **Startup fail-fast** when `Encryption.Key`, `Encryption.Salt`,
  `Account.Admin.Email`, or `Account.Admin.Password` are empty or set to
  placeholder values in non-Development environments.
- **Container runs as non-root** user `app` (UID 1654, the chiseled
  base's built-in user). Operators using a host-mounted `/app/config`
  volume must `chown -R 1654:1654` the host directory.
- **`ForwardedHeaders` middleware** wired so the app correctly sees HTTPS
  when running behind a Cloudflare Tunnel. Without this, the new cookie
  `SecurePolicy=Always` would silently drop Set-Cookie on every request.

### Changed

- **Project renamed** to PhotoShare. Top-level folder, sln, csproj, host
  namespace, and Dockerfile path all updated. The vendored `Memtly.Core`
  namespace is intentionally retained (upstream identity).
- **Configuration defaults**: `Force_Https` → `true`,
  `Allow_Insecure_Galleries` → `false`, `Encryption.Iterations` → `600000`,
  `Encryption.HashType` → `SHA512`. Placeholder values for
  `Encryption.Key/Salt` and `Account.Admin.Email/Password` removed in
  favor of empty + fail-fast.
- **CI flow**: `.github/workflows/docker-image.yml` rewritten as
  "Build and Release" - amd64-only verify on PR/master, tag-triggered
  push to `ttlequals0/photoshare` on Docker Hub with SLSA build
  provenance attestation and a Trivy filesystem scan.
- **CodeQL** moved off Default Setup to an advanced workflow with
  `build-mode: autobuild` and the `security-and-quality` query suite.
- **`UpdateUserPasswordHash`** uses `ExecuteUpdateAsync` instead of
  loading the user, mutating, and saving.
- **`ConfigHelper`** logging migrated to structured logging with named
  placeholders (breaks CodeQL false-positive taint flow on
  sensitive-named config key constants).

### Added

- **`Memtly.Core` is now vendored in tree** at upstream SHA
  `847ea675fea9ce182aa5bd08da88190b15505cfa`. The previous git submodule
  pointed at a relative URL unreachable from this fork.
- **Brand assets** at `Memtly.Core/Memtly.Core/wwwroot/images/photoshare-{icon,logo}-{light,dark}.svg`.
- **DESIGN.md** capturing the Superhuman-inspired visual system the UI
  reskin will target.
- **`IPasswordHasher`** service (`PasswordHasher`) with `Hash`, `Verify`,
  `IsLegacyHash`, and a `PasswordVerification` enum
  (`Failed | Success | SuccessNeedsRehash`).
- **`AccountController.VerifyAndRehashIfNeeded`** helper unifies the
  hash-lookup-verify-rehash block used by Login and ValidateMultifactorAuth.
- **`IDatabaseHelper.GetUserPasswordHash` + `UpdateUserPasswordHash`**.
- **`IImageHelper.ContentMatchesExtension`** for upload validation.

### Removed

- **`.gitlab-ci.yml`** - upstream pipeline; this fork uses GitHub Actions
  exclusively.
- **`Memtly.Core` submodule** entry in `.gitmodules` (replaced by
  vendored sources).
- **`IDatabaseHelper.ValidateCredentials`** and its EF implementation -
  no callers after the BCrypt migration.
- **`AccountController._encryption`** field/constructor parameter -
  unused after password ops moved to `IPasswordHasher`.
- **`CheckMemtlyCoreExists` MSBuild target** in the host csproj - its
  error message instructed users to run `git submodule update`, no
  longer applicable.

### Operator follow-up before public deploy

- Set required env vars (or `appsettings.Production.json`):
  - `Memtly__Security__Encryption__Key`
  - `Memtly__Security__Encryption__Salt`
  - `Memtly__Account__Admin__Email`
  - `Memtly__Account__Admin__Password`
- If using a host-mounted `/app/config` volume:
  `chown -R 1654:1654 /path/to/volume`
- Disable CodeQL Default Setup in repo Settings (UI; API-driven disable
  does not persist) so the advanced workflow's SARIF uploads cleanly.
- Add Docker Hub secrets to repo before the first tag push:
  `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`.

[Unreleased]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.7...HEAD
[2.0.7]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.6...v2.0.7
[2.0.6]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.5...v2.0.6
[2.0.5]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.4...v2.0.5
[2.0.4]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.3...v2.0.4
[2.0.3]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.2...v2.0.3
[2.0.2]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/ttlequals0/PhotoShare/releases/tag/v2.0.0

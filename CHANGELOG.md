# Changelog

All notable changes to PhotoShare are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
PhotoShare is an independent fork of [Memtly.Community](https://github.com/Memtly/Memtly.Community);
the version line restarts at 2.0.0 to signal fork divergence and the breaking
changes shipped below.

## [Unreleased]

### Added

- **`docker-compose.yml`** for the recommended Postgres-backed deploy.
  Uses non-root UID 10001 (matches the Dockerfile), wires the `/healthz`
  endpoint as the container healthcheck, ships an optional cloudflared
  sidecar (commented), uses named volumes that auto-resolve UID
  ownership.
- **`.env.example`** documenting every required secret with hints on
  generating strong random values via `openssl rand`.
- **`docs/docker.md`** walking through the compose deploy: env vars
  (both `UPPER_SNAKE_CASE` and `Memtly__Section__Key` forms work), volume
  layout, host-path `chown` for non-default mounts, Cloudflare Tunnel
  sidecar usage, update procedure, and backup commands for Postgres +
  uploads volume.
- **`/healthz` liveness endpoint** for Docker / Cloudflare Tunnel
  origin checks / external uptime monitors. Anonymous, no DB hit,
  returns 200 / "Healthy". Dockerfile gains a `HEALTHCHECK`
  instruction that pings it every 30 seconds.

### Security

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
- **Container runs as non-root** user `photoshare` (UID 10001).
  Operators using a host-mounted `/app/config` volume must
  `chown -R 10001:10001` the host directory.
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
  `chown -R 10001:10001 /path/to/volume`
- Disable CodeQL Default Setup in repo Settings (UI; API-driven disable
  does not persist) so the advanced workflow's SARIF uploads cleanly.
- Add Docker Hub secrets to repo before the first tag push:
  `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`.

[Unreleased]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/ttlequals0/PhotoShare/releases/tag/v2.0.0

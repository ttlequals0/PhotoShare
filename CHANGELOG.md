# Changelog

All notable changes to PhotoShare are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
PhotoShare is an independent fork of [Memtly.Community](https://github.com/Memtly/Memtly.Community);
the version line restarts at 2.0.0 to signal fork divergence and the breaking
changes shipped below.

## [Unreleased]

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

# CLAUDE.md - PhotoShare

PhotoShare is a fork of Memtly.Community (formerly WeddingShare) being hardened
for public exposure via a Cloudflare tunnel for an upcoming event. ASP.NET Core
9.0 + Razor + EF Core + ASP.NET Identity. License: GPL-3.0.

The user has explicitly chosen to harden this codebase rather than rewrite it
in another stack until after the event. Bias changes toward minimum-diff
hardening; avoid refactors and new abstractions. Exception: the UI is being
redesigned (mobile-first + installable PWA + new brand) - that scope is
documented in DESIGN.md and the Frontend / PWA sections below.

## Architecture

Two projects, one solution (`Memtly.Community.sln`):

- `Memtly.Community/` - thin Kestrel host. `Program.cs` boots Kestrel on `:5000`,
  `Startup.cs` delegates everything to `Memtly.Core` extensions
  (`ConfigureCommunityServices` / `ConfigureCommunity`). Most of what looks like
  "the app" is not here.
- `Memtly.Core/Memtly.Core/` - all controllers, EF context, Razor views, models,
  helpers, background workers, asset pipeline. Razor SDK project.
- `Memtly.Core/Memtly.Core.UnitTests/` - NUnit + NSubstitute test project.

`Memtly.Core` was a git submodule (URL `../memtly.core.git`) but is now
**vendored in tree** at upstream SHA `847ea675fea9ce182aa5bd08da88190b15505cfa`
because the relative URL was unreachable for this fork. Treat
`Memtly.Core/` as ordinary tracked code; do not run `git submodule` on it. To
pull upstream changes you cherry-pick or rebase manually.

## Quick start

```
# Build + test (requires .NET 9 SDK; pinned to 9.0.308 in global.json,
# rolls forward within 9.0.3xx)
dotnet restore Memtly.Community.sln
dotnet test    Memtly.Community.sln --configuration Release

# Run locally (listens on http://*:5000)
dotnet run --project Memtly.Community/Memtly.Community.csproj

# Build Docker image (amd64, no push)
docker buildx build --platform linux/amd64 -t photoshare:dev \
  -f Memtly.Community/Dockerfile .
```

`dotnet build` will run `npm ci` and `npm run production` automatically
(MSBuild targets in `Memtly.Core.csproj`). Node 22 is required - the
Dockerfile installs it; on a host build, install Node 22 first or builds
will fail at the asset stage.

## Database

Four EF Core providers are supported: **Sqlite (default), MySQL, Postgres,
SQL Server**. Selected at runtime via `Memtly.Database.Type` /
`Memtly__Database__Type` (sqlite | mysql | postgres | mssql). Migrations
live in **per-provider directories**:

```
Memtly.Core/Memtly.Core/Migrations/
  Sqlite/
  MySql/
  Postgres/
  SqlServer/
```

To add a migration, use the project's PowerShell script - it generates one
migration per provider in the correct directory and cleans up isolated
ModelSnapshots:

```
cd Memtly.Core/Memtly.Core
pwsh ./generate-migrations.ps1 -MigrationName SomeChange
# add -Fresh to wipe and regenerate from scratch
```

The script uses temporary design databases (`_design_temp_*`); have local
MySQL / Postgres / sqlcmd available or expect those providers to be skipped.
`dotnet ef migrations add` directly will only emit one provider and break
the per-provider isolation.

## Tests

```
dotnet test Memtly.Community.sln --configuration Release --no-restore
```

NUnit 3 + NSubstitute. SixLabors.ImageSharp is referenced from tests for
image fixtures. `dbup-sqlite` is used for migration test setup.

## CI / Release flow

`.github/workflows/docker-image.yml` is "Build and Release":

| Trigger | Action |
|---------|--------|
| `pull_request` to master | dotnet test + amd64 docker build (no push) |
| `push` to master | same |
| `push` of tag `v*` | build + push `ttlequals0/photoshare:<tag>` and `:latest` to Docker Hub, SLSA build provenance attestation |
| `workflow_dispatch` (manual) | build + push with user-supplied tag input (no `:latest` mutation) |

amd64 only. Trivy filesystem scan runs every job (advisory; does not fail
the build). Required repo secrets for the push path:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN` (scoped to push the photoshare repo only)

Release flow is `git tag v1.0.x && git push --tags`. Local Docker builds are
allowed for testing but should not be pushed - CI is the canonical release.

`.github/workflows/codeql.yml` runs CodeQL with `build-mode: autobuild` and
the `security-and-quality` query suite, on PR / master / weekly cron.

**CodeQL gotcha:** GitHub's CodeQL Default Setup conflicts with the advanced
workflow. It must be disabled via the repo UI (Settings -> Code security and
analysis -> CodeQL analysis -> Default -> Disabled). The API
(`PATCH .../code-scanning/default-setup state=not-configured`) does NOT
persist - GitHub auto-rearms default setup on the next code push that
touches scanning-relevant paths.

## Configuration

`Memtly.Community/appsettings.json` is the single source of defaults.
All keys are overridable via env vars using `Memtly__<Section>__<Key>`.

Important sections:

- `Memtly.Database` - provider, connection string
- `Memtly.Security.Encryption` - **defaults are placeholders (`ChangeMe` /
  SHA256 / 1000 iterations) and MUST be replaced before public exposure**
- `Memtly.Security.Headers` - X-Frame-Options, X-Content-Type-Options, CSP.
  CSP default uses `'unsafe-inline' 'unsafe-eval'` in `script-src`; tighten
  for production
- `Memtly.Account.Admin` - **default `admin@example.com / admin` MUST be
  changed before any deployment**
- `Memtly.Account.Lockout_Attempts` / `Lockout_Mins` - Identity lockout
- `Memtly.BackgroundServices` - cron for `Directory_Scanner` (default `*/30`)
  and `Cleanup` (default `0 4 * * *`)
- `Memtly.Notifications` - SMTP / Ntfy / Gotify
- `Memtly.Trackers.Umami` - self-hosted analytics
- `Memtly.Hardening.Allow_Insecure_Galleries` - **defaults to true**, flip
  to false for public exposure

Security headers and CSP are wired in
`Memtly.Core/Memtly.Core/Extensions/StartupExtensions.cs` (around the
`ConfigureCommunity` middleware). Modify there if header strings need to
change beyond what appsettings exposes.

## Background workers

Hosted services live in `Memtly.Core/Memtly.Core/BackgroundWorkers/`:

- `DirectoryScanner` - scans the gallery upload tree on cron
- `CleanupService` - drops aged audit / orphaned files
- `NotificationReport` - daily summary email if SMTP enabled

Schedules are in `appsettings.json -> Memtly.BackgroundServices`. Disable
by setting `Enabled: false` rather than removing the section.

## Frontend / UI direction

- **Mobile-first**: design and implementation start at the smallest viewport
  and progressively enhance. Reference `DESIGN.md` for the visual system
  (Superhuman-inspired; substitute Inter Variable for the proprietary
  Super Sans VF; rename "Mysteria"/"Lavender Glow" tokens to functional
  names like `--accent-purple-deep`, `--accent-lavender`).
- **Dark mode**: derive a dark variant. Memtly's `Themes.Default = AutoDetect`
  must keep working - do not regress to light-only.
- **Custom font**: Inter Variable (or Mona Sans Variable) loaded as a
  `font-display: swap` `@font-face`. Hit non-standard weights 460 and 540
  by setting the `wght` axis directly. Do **not** use Super Sans VF
  (proprietary, Superhuman-only).

## Brand assets

Four SVG primitives live at `Memtly.Core/Memtly.Core/wwwroot/images/`,
palette aligned with the design tokens (`#1b1938`, `#cbb7fb`, `#714cb6`,
`#e9e5dd`):

| File | Use |
|------|-----|
| `photoshare-icon-light.svg` | square 128x128 icon, light surfaces |
| `photoshare-icon-dark.svg`  | square 128x128 icon, dark surfaces |
| `photoshare-logo-light.svg` | wordmark + icon, light surfaces |
| `photoshare-logo-dark.svg`  | wordmark + icon, dark surfaces |

`appsettings.json -> Memtly.Logo` should point to a `<picture>`-friendly
icon path; light/dark selection is via `prefers-color-scheme` in the layout,
not via config.

The pre-rebrand `Memtly.png` (repo root) and the upstream
`buymeacoffee_avatar.png` / `github_avatar.png` in the same images dir
remain for sponsor display - do not delete during rebrand.

## PWA

PhotoShare ships as an installable PWA. Required artifacts:

- `wwwroot/manifest.webmanifest` (name, short_name, theme_color
  `#1b1938`, background_color `#ffffff`, display `standalone`,
  orientation `portrait-primary`, icons array referencing the brand
  SVGs plus generated 192/256/384/512 PNG fallbacks)
- `wwwroot/sw.js` - service worker. **Network-first for `/Gallery/*`**
  (uploads must always reach the server fresh), **cache-first** for
  hashed static assets emitted by webpack into `wwwroot/dist/`,
  **stale-while-revalidate** for the home page shell.
- `wwwroot/icons/` - generated PNG icon set (192, 256, 384, 512;
  apple-touch-icon-180.png; favicon-32.png; favicon-16.png).
- `<link rel="manifest">`, `<meta name="theme-color">`,
  `<link rel="apple-touch-icon">` registered in
  `Memtly.Core/Memtly.Core/Views/Shared/_Layout.cshtml` (or a partial
  named `_PwaHead.cshtml`).
- Service worker registration in a small inline script gated on
  `'serviceWorker' in navigator`.

**Do not pre-cache uploaded media.** Galleries can be very large; the
service worker must scope only to app shell + static assets.

## Conventions

- Razor runtime compilation is on
  (`Microsoft.AspNetCore.Mvc.Razor.RuntimeCompilation`), so view edits are
  picked up without a rebuild during `dotnet run`.
- Namespaces stay `Memtly.Community` and `Memtly.Core` even after the planned
  PhotoShare rename - only the top-level project, sln, csproj, image tag,
  and branding strings change. The `Memtly.Core` namespace remains because
  the vendored sources keep their upstream identity.
- Static assets compiled by webpack land in
  `Memtly.Core/Memtly.Core/wwwroot/dist/` and are gitignored. Bootstrap,
  jQuery, FontAwesome are bundled (no CDN at runtime).
- ASP.NET Identity uses EF Core - all user / role tables live in
  `CoreDbContext`. Do not introduce a separate Identity DbContext.

# Changelog

All notable changes to PhotoShare are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
PhotoShare is an independent fork of [Memtly.Community](https://github.com/Memtly/Memtly.Community);
the version line restarts at 2.0.0 to signal fork divergence and the breaking
changes shipped below.

## [Unreleased]

## [2.0.19] - 2026-05-23

### Fixed

- **Guest Name prompt appearing twice in the same browser session.**
  The page-load auto-prompt in `identity-check/index.js` could fire more
  than once when the same init() ran again (partial JS re-eval, SW
  `staleWhileRevalidate` returning cached HTML with the prompt state on
  a tab the user had already been asked in, or back-to-back navigations
  where the server session write lagged the next page render). Added a
  `sessionStorage` marker (`photoshare_identity_prompt_shown`) that gates
  the auto-prompt to once per browser session. Cleared automatically
  when the tab closes; the server-side `data-identity-check` flag flips
  to false once the user sets an identity so the gate is a no-op for the
  happy path. The manual "Change Identity" navbar button is not gated.

## [2.0.18] - 2026-05-23

### Security

- **Log-injection sanitization in `AccessLogMiddleware`.** The middleware
  added in 2.0.17 interpolated user-controlled values (request path,
  User-Agent, session identity, gallery identifier, HTTP method) directly
  into the log template. CodeQL flagged 3 cs/log-injection alerts because
  a crafted value containing CR/LF could forge log lines. Added a
  private `SanitizeForLog` helper that strips control chars (< 0x20 and
  0x7F) and applied it to every user-controlled string field.

## [2.0.17] - 2026-05-23

### Added

- **Hide the login button from clients outside the admin allowlist.**
  When `ADMIN_ALLOWED_NETWORKS` is set, the navbar Login button now
  only renders for clients whose IP matches an allowed CIDR. External
  visitors see no admin surface at all - which matches the 404 that
  `AdminNetworkGate` already returns for `/Account/Login`, so probes
  can't even discover that an auth endpoint exists. When the gate is
  disabled (env var unset) the button renders for everyone, preserving
  the default behaviour. Exposed as `AdminNetworkGate.IsAllowed(ctx)`
  and `IsEnabled` for any other view that wants to gate admin UI.
- **Structured per-request access logging.** New `AccessLogMiddleware`
  wired right after `UseForwardedHeaders` (so `RemoteIp` reflects the
  real client behind cloudflared / a LAN reverse proxy) and before
  `AdminNetworkGate` (so even blocked requests get a line). Emits one
  log entry per non-static request with structured fields:
  `Method`, `Path`, `Status`, `DurationMs`, `RemoteIp`, `UserAgent`,
  `Identity` (session viewer name or authenticated user, "-" if
  neither), `GalleryId` (from route or `?identifier=` query, "-" if
  neither). 5xx and exception-throwing requests log at Warning;
  everything else at Information. Static-asset paths
  (`/dist`, `/images`, `/icons`, `/css`, `/js`, `/fonts`, `/lib`,
  `favicon.ico`, `sw.js`, `manifest.webmanifest`, `robots.txt`,
  `sitemap.xml`) are skipped so the log isn't drowned in CSS/JS noise.
  Exceptions are rethrown after logging so `UseExceptionHandler` still
  produces the user-facing error response.

  Loki query examples once 2.0.17 is live:
  - `{container="photoshare"} |= "access " | logfmt | Status >= 400`
  - `{container="photoshare"} |= "access " | logfmt | GalleryId="smith-wedding"`
  - `{container="photoshare"} |= "access " | logfmt | DurationMs > 1000`

## [2.0.16] - 2026-05-23

### Changed

- **Upload UX: drop the redundant "Gallery vs Camera" dialog.** On mobile
  with `Memtly.Gallery.CameraUploads` enabled, tapping the upload zone
  previously surfaced a custom modal asking the user to pick Gallery or
  Camera, then opened the OS picker. iOS / Android already expose Photo
  Library + Take Photo or Video + Choose Files as native chooser entries
  for `accept="image/*,video/*"`, so the intermediate prompt was pure
  friction. `UploadBox.triggerSelector` now always defers to the native
  picker. `setCameraMode` / `showUploadMethodPopup` removed.
  The `Memtly.Gallery.CameraUploads` setting and the
  `data-post-allow-camera` attribute are kept for now but no longer
  affect runtime behaviour.

## [2.0.15] - 2026-05-22

### Security

- **Path-traversal hardening on `gallery.Identifier`.**
  `AccountController.AddGallery` and `GalleryController.Login` (POST)
  stored the form-supplied Identifier verbatim. An authenticated user
  with `GalleryPermissions.Create` (or any guest when
  `Memtly.Basic.GuestGalleryCreation=true`) could post
  `Identifier="/etc"` or `"../private"`; downstream `WipeGallery` /
  `DeleteGallery` / `DeletePhoto` would then act on that path. Added
  `GalleryHelper.IsSafePathSegment` (lowercase alnum + dash +
  underscore, length cap, reject `.` / `..` / leading dots). Enforced
  at the two controller writers (sanitize-with-fallback) and in
  `EFDatabaseHelper.AddGallery` (defensive reject + log).
  `DirectoryScanner` uses the same check so user-named filesystem
  directories like `smith-wedding` still resolve.
- **Zip-slip in backup import.** Four `ZipFile.ExtractToDirectory`
  calls in `AccountController.ImportBackup` operated on a user-uploaded
  zip without entry-path validation. New `FileHelper.SafeExtractZip`
  resolves each entry against the canonical target dir and rejects
  entries that escape it. Admin-only via
  `[RequiresRole(DataPermissions.Import)]` but the bug was real.
- **`FileHelper.SanitizeFilename` Linux-weak.** Linux's
  `Path.GetInvalidFileNameChars` is only NUL and `/`, so the old code
  accepted `..`, leading dots, `\\`, NTFS-invalid chars, and control
  characters. Rewrote to reduce input to basename first, strip the
  cross-platform invalid set + control chars, then reject `.` / `..` /
  trailing-dot tokens. Same fix also closes the extension-injection
  path - `Path.GetExtension("foo.../etc")` returned `"../etc"` which
  was being concatenated into upload filenames.
- **Silent security-headers swallow at startup.** The CSP / HSTS /
  Referrer-Policy registration in `StartupExtensions` was wrapped in
  `catch { }`. If header registration failed at boot the app launched
  unprotected and nobody knew. Now logs via
  `app.ApplicationServices.GetService<ILoggerFactory>()`.
- **Log-injection sanitization** in `EFDatabaseHelper` - the
  `AddGallery` rejection log and `SetSetting` failure log
  interpolated user-controlled values (`model.Identifier`, `model.Id`).
  New `SanitizeForLog` private helper strips control chars before
  interpolation.
- **`ImageHelper.FfmpegInstalled`** static flag declared `volatile`
  so the single-writer-at-startup / multi-reader-after-startup
  contract is explicit and CodeQL-visible.
- **`@babel/preset-env` 7.28.5 -> 7.29.5** to transitively pick up
  `@babel/plugin-transform-modules-systemjs` >= 7.29.4
  (GHSA-fv7c-fp4j-7gwp / CVE-2026-44728, devDependency arbitrary code
  generation). `npm audit fix` also bumped `brace-expansion` past two
  moderate-severity advisories.

### Code quality

- Explicit `[ValidateAntiForgeryToken]` on all 22 `[HttpPost]`
  controller actions. The global `AutoValidateAntiforgeryTokenAttribute`
  filter already validated everything; the explicit attribute documents
  intent and closes the corresponding CodeQL false positives.
- `Path.Combine` -> `Path.Join` across every filesystem-write site in
  controllers, background workers, and StartupExtensions. The single
  remaining `Path.Combine` is in `FileHelper.SafeExtractZip` and is
  intentional (combine + GetFullPath + StartsWith is the zip-slip
  defense; subsequently swapped to Path.Join after proving Join with
  GetFullPath also rejects `..` traversal and coerces absolute entries
  under the target dir, preserving the same security property).
- `SettingsHelper` / `ConfigHelper` `GetOrDefault` overloads: the
  empty `catch {}` blocks now narrow to
  `FormatException | OverflowException | InvalidCastException` (plus
  `ArgumentException` on the enum overload). The string overloads keep
  a broader catch limited to `InvalidOperationException |
  NullReferenceException` since the underlying `Get()` already swallows
  + logs DB errors one layer down.
- 10 Razor pages swapped from
  `var page = 1; try { page = int.Parse(Query[...]) } catch {}` to the
  canonical `if (Query.TryGetValue("page", out var raw) &&
  int.TryParse(raw, out var p)) { page = p; }`. Removed the now-dead
  `currentPage`/`searchTerm` declarations from Users / Reviews /
  Resources tab views where the values were never read.
- 13 silent catches in `DirectoryScanner`, `DatabaseConfiguration`
  (four sites), `EFDatabaseHelper`, `GalleryController` (two sites),
  `LanguageController` now log instead of swallowing.
- 5 boundary catches (UploadChunk, IngestUploadedFile, chunk-cleanup,
  ThemesController.Index, ImageHelper.ConvertHeicToJpeg) narrowed to
  provable exception-type unions with explanatory comments.
  `OutOfMemoryException` / `ThreadAbortException` etc. intentionally
  bubble up so the host's failure handler decides, rather than being
  silently degraded.
- Two unit-test asserts in `GalleryControllerTests` switched from
  `model.ViewMode` to `model?.ViewMode` to match the surrounding
  `?.`-using asserts in the same blocks (closes
  `cs/dereferenced-value-may-be-null`).
- Filesystem catches in `CleanupService` and `FileHelper` (MD5
  checksum) narrowed to `IOException | UnauthorizedAccessException`.
- `AdminNetworkGate` CIDR parse catch narrowed to
  `FormatException | ArgumentException | OverflowException`.

## [2.0.14] - 2026-05-10

### Code quality

- CodeQL cleanup on PR #29:
  - Dropped unused locals (`filename` in `ImageHelper.GenerateThumbnail`,
    `dbProvider` in `DatabaseConfiguration`) flagged by
    `cs/useless-assignment-to-local`.
  - `ThemesController.Index` `catch {}` -> `catch (Exception ex)` with
    logging (`cs/empty-catch-block`).
  - `AccountController` registration + token-unprotect blocks: drop
    redundant `?.` on `model.Firstname` / `model.Lastname` / `model.X` /
    `data.X` where earlier `IsNullOrWhiteSpace` guards already prove
    the value is non-null (`cs/constant-condition`, 4 locations).
  - Delete `Startup.Ready` static - written by instance method and
    never read anywhere (`cs/static-field-written-by-instance`).
  - Dismissed 17 `cs/catch-of-all-exceptions` notes and 1
    `cs/linq/missed-where` note as accepted upstream Memtly patterns.

## [2.0.13] - 2026-05-10

### Fixed

- **Navbar logo too small.** The 32x32 cap from 2.0.6's mobile-first
  pass was over-aggressive and the brand SVG rendered as a tiny
  speck. Bumped to 56px tall on desktop, 44px on phones, with
  `object-fit: contain` so the aspect ratio is preserved across
  screen sizes.
- **CleanupService failed on every cron tick when `/app/temp` is a
  bind-mount.** Upstream Memtly's cleanup calls
  `Directory.Delete(/app/temp, recursive: true)` which tries to
  `rmdir` the mount point itself - filesystem says "Access denied"
  because the mount is owned by the kernel mountns. Switched the
  cleanup to walk the directory's children and delete each
  subdirectory/file individually, leaving the mount point intact.

### Known follow-up

- Video items uploaded before 2.0.12 (when ffmpeg was missing) have
  no `.webp` thumbnail on disk. They're DB-tracked but render as
  broken in the default gallery view. Re-upload to regenerate, or a
  future build can add a startup task to retro-process those items.

## [2.0.12] - 2026-05-10

### Fixed

- **Video thumbnails missing.** Loki showed
  `Xabe.FFmpeg.Exceptions.FFmpegNotFoundException: Cannot find FFmpeg
  in /app/ffmpeg or PATH` on every `.mp4`/`.mov` upload. Root cause:
  the runtime auto-download into `/app/ffmpeg` depends on the
  host-bind-mount being writable by the container UID - which has
  repeatedly failed in practice. Baked a static ffmpeg + ffprobe
  build (John Van Sickle release) into the image at `/app/ffmpeg/`
  via a Dockerfile copy from the SDK stage. No more dependence on
  bind-mount writability for the thumbnail pipeline.
  Operators currently bind-mounting `/app/ffmpeg` should DROP that
  line from their compose - the bind-mount shadows the baked-in
  binaries.
- **"Guest Name" prompt fired twice.** Page-load auto-prompt
  (`identity-check/index.js:7-9`) plus the upload-click required
  prompt both ran on gallery pages with an upload form. Skip the
  auto-prompt when an upload form is present - the upload-click
  flow handles the prompt with the right "required" semantics. The
  auto-prompt still fires on view-only gallery pages.

### Added

- **Client-side allowed-file-type pre-check.** Server's
  `Memtly:Gallery:Allowed_File_Types` is now mirrored onto the
  upload `<input>` as `data-allowed-file-types`. The upload-box
  filters by file extension against that list before adding files
  to Resumable. A 567 MB `.mkv` upload would otherwise stream all
  21 chunks before being rejected at server ingest - now it's
  rejected instantly with a per-file list of which extensions
  weren't allowed.

## [2.0.11] - 2026-05-10

### Fixed

- **Chunked upload fired "There was an issue uploading some files" with
  zero network traffic.** 2.0.9's `upload-box` wired Resumable.js as:
  ```
  r.addFile(f);
  r.upload();   // <-- synchronous call right after addFile
  ```
  Resumable's chunk creation (`bootstrap()`) and `fileAdded` event both
  defer to `setTimeout(0)`. When `r.upload()` ran synchronously, the
  file had `chunks=[]`, so `upload()` immediately fired `complete` with
  zero chunks processed and the UI showed `Upload_Failed`. Confirmed via
  in-page Playwright probe: event order was `uploadStart`, `complete`,
  `chunkingComplete`, `fileAdded`, `filesAdded` - upload "completed"
  before chunks existed.

  Fix: register `r.on('fileAdded', () => r.upload())` instead of
  calling upload synchronously. By the time `fileAdded` fires (deferred
  setTimeout), `bootstrap()` has populated the chunks array and
  `r.upload()` has work to do.

## [2.0.10] - 2026-05-10

### Fixed

- **Uploads broken on Postgres with `22021: invalid byte sequence for
  encoding "UTF8": 0x00`.** Upstream `FileHelper.GetChecksum` did
  `Encoding.UTF8.GetString(md5.ComputeHash(stream))` - interpreting the
  raw 16-byte hash as UTF-8 produces strings with embedded `0x00` bytes
  about 6% of the time. SQLite tolerated them; Postgres rejects them
  on INSERT. Hex-encoded the checksum (`Convert.ToHexString`) so the
  stored value is always valid UTF-8 text. Affected every upload, not
  just chunked - 2.0.9 + Postgres made the failure visible.
- **Service worker 404 at `/sw.js`.** `main.js` registers
  `/sw.js` (root path) but the file shipped only at
  `/_content/Memtly.Core/sw.js`. Service workers can only control
  paths at or below their own location, so we want it at the root
  scope. Copied to `PhotoShare/wwwroot/sw.js`.

## [2.0.9] - 2026-05-10

### Added

- **Chunked uploads via Resumable.js.** Each file is split into 25 MB
  chunks before POST, keeping individual requests well under
  Cloudflare Tunnel free tier's 100 MB body cap. Server reassembles
  parts in `/app/temp/<gallery>/<uploadId>/` and feeds the assembled
  file through the existing validation -> magic-byte check ->
  thumbnail -> HEIC sidecar -> DB row pipeline (extracted as
  `IngestUploadedFile` in `GalleryController`). New endpoints:
  `POST /Gallery/UploadChunk` (chunk write + final-chunk ingest) and
  `GET /Gallery/UploadChunk` (Resumable.js resume probe).
- **Server-side HEIC -> JPEG sidecar.** On HEIC upload, ffmpeg writes a
  high-quality JPEG (`-q:v 2`) next to the original. Gallery slideshow
  and media viewer render `<picture><source type="image/heic">` with
  a JPEG `<img>` fallback - Safari fetches the HEIC, Chrome/Firefox
  fall through to the sidecar without an extra network request.
- **Browser-side HEIC decoder.** Lazy-loaded libheif-js (~600 KB
  gzipped) decodes HEIC to a blob URL when `<img data-heic-src>`
  decode fails natively. Covers direct HEIC links shared outside the
  `<picture>` wrapping in the gallery view.
- **`ADMIN_ALLOWED_NETWORKS` env gate.** New `AdminNetworkGate`
  middleware reads a comma-separated CIDR list at startup; when set,
  every request to `/Account/*`, `/Admin/*`, or `/MultiFactor/*` from
  an IP outside the allowlist returns 404 (not 403 - hides the auth
  surface entirely). Default empty = unrestricted. Operators can now
  expose the public tunnel for guest uploads while keeping the login
  surface LAN-only. Documented in `.env.example`.

### Changed

- **`.webp` added to `Allowed_File_Types`.** Covers Android animated
  WhatsApp/iMessage stickers and opt-in Android Camera WebP output.
  ImageSharp recognizes WebP natively so no special branch needed in
  `ContentMatchesExtension`.

### Security

- Rolls in the Dependabot `fast-uri` 3.1.0 -> 3.1.2 lockfile patch
  from PR #27 (previously slated for 2.0.8).

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

[Unreleased]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.19...HEAD
[2.0.19]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.18...v2.0.19
[2.0.18]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.17...v2.0.18
[2.0.17]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.16...v2.0.17
[2.0.16]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.15...v2.0.16
[2.0.15]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.14...v2.0.15
[2.0.14]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.13...v2.0.14
[2.0.13]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.12...v2.0.13
[2.0.12]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.11...v2.0.12
[2.0.11]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.10...v2.0.11
[2.0.10]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.9...v2.0.10
[2.0.9]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.7...v2.0.9
[2.0.7]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.6...v2.0.7
[2.0.6]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.5...v2.0.6
[2.0.5]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.4...v2.0.5
[2.0.4]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.3...v2.0.4
[2.0.3]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.2...v2.0.3
[2.0.2]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/ttlequals0/PhotoShare/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/ttlequals0/PhotoShare/releases/tag/v2.0.0

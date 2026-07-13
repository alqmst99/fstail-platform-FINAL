# Phase 9 — Electron Packaging + Auto-Update
## Deployment & Release Guide

---

## Prerequisites

- Node.js ≥ 20, npm ≥ 10
- Docker (for local PostgreSQL/Redis)
- GitHub repository with Actions enabled
- (macOS builds) Apple Developer account for notarization
- (Windows builds, optional) Code signing certificate

---

## Step 1 — Replace updated files

Copy these Phase 9 files over their Phase 2/3 counterparts:

```
apps/web/next.config.js          ← standalone output mode (REQUIRED)
apps/desktop/src/main.js         ← production main process
apps/desktop/src/preload.js      ← full IPC bridge with updater
apps/desktop/package.json        ← electron-builder config
apps/web/app/(platform)/layout.tsx  ← adds UpdateBanner
apps/web/components/update-banner.tsx  ← new file
```

---

## Step 2 — Install new dependencies

```bash
# Root — install electron-updater
cd apps/desktop
npm install electron-updater

# macOS notarization (CI only — skip if not distributing on Mac)
npm install --save-dev @electron/notarize
```

---

## Step 3 — Build for development

```bash
# Terminal 1 — start infrastructure
docker compose up -d

# Terminal 2 — start NestJS API
cd apps/api && npm run dev

# Terminal 3 — start Next.js
cd apps/web && npm run dev

# Terminal 4 — start Electron (points to localhost:3000)
cd apps/desktop && npm run dev
```

---

## Step 4 — Build production installer (local test)

```bash
# 1. Build Next.js in standalone mode
cd apps/web && npm run build

# 2. Build the Electron installer for your current platform
cd apps/desktop && npm run build:electron

# Output: apps/desktop/dist/
#   Windows: FSTail Platform Setup 1.0.0.exe
#   macOS:   FSTail Platform-1.0.0.dmg
#   Linux:   FSTail Platform-1.0.0.AppImage
```

---

## Step 5 — Set up GitHub Actions for automated releases

### 5a. Add repository secrets

Go to GitHub → Settings → Secrets → Actions → New repository secret:

| Secret | Value |
|--------|-------|
| `GH_TOKEN` | GitHub PAT with `repo` scope |
| `APPLE_ID` | Your Apple ID (macOS only) |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | 10-char team ID from developer.apple.com |
| `CSC_LINK` | Base64-encoded .p12 signing cert (optional) |
| `CSC_KEY_PASSWORD` | Signing cert password (optional) |

Generate `GH_TOKEN`:
```
GitHub → Settings → Developer settings → Personal access tokens → Fine-grained
Permissions: Contents (read/write), Actions (read)
```

### 5b. Copy workflow file

```bash
cp phase9/.github/workflows/release.yml .github/workflows/release.yml
git add .github/workflows/release.yml
git commit -m "ci: add electron release workflow"
git push
```

---

## Step 6 — Release a new version

```bash
cd apps/desktop

# Bump patch version (1.0.0 → 1.0.1) and push
node scripts/release.js patch

# Or minor (1.0.0 → 1.1.0)
node scripts/release.js minor

# Or explicit version
node scripts/release.js 1.2.3
```

This will:
1. Update `apps/desktop/package.json` version
2. `git commit` + `git tag v1.0.1`
3. `git push --follow-tags`
4. GitHub Actions triggers → builds Windows + macOS + Linux installers
5. Creates GitHub Release with all installers attached
6. `electron-updater` in existing installs detects the new release and notifies users

---

## Step 7 — Auto-update flow

When a user has the app installed:

1. On launch, `autoUpdater.checkForUpdatesAndNotify()` runs
2. Every 4 hours, it checks again
3. When update found: `update:available` event → yellow banner appears in app
4. Download happens in background
5. When download complete: `update:downloaded` event → banner shows "Restart & install"
6. User clicks → `autoUpdater.quitAndInstall()` → app restarts with new version

---

## Step 8 — Deep links (optional)

Register the `fstail://` protocol so client portal links open the desktop app:

macOS/Linux — handled automatically by electron-builder.

Windows — add this to NSIS install script or let electron-builder handle it
via `app.setAsDefaultProtocolClient('fstail')`.

Usage:
```
fstail://portal/TOKEN → opens /portal/TOKEN in the desktop app
```

---

## Architecture — Production data flow

```
User clicks link in desktop app
        ↓
Electron main.js (renderer)
        ↓ HTTP
Next.js standalone server (localhost:3456)
        ↓ HTTP
NestJS API (localhost:3001 — separate process or remote server)
        ↓
PostgreSQL (local Docker or cloud — Supabase/Neon/Railway)
```

For production deployment:
- NestJS API → deploy to Railway / Render / VPS
- PostgreSQL → Supabase or Neon (managed)
- Redis → Upstash or Railway Redis
- Update `NEXT_PUBLIC_API_URL` in the build to point to your production API

---

## File structure summary

```
apps/desktop/
├── src/
│   ├── main.js          ← Main process (this phase)
│   └── preload.js       ← IPC bridge (this phase)
├── scripts/
│   ├── notarize.js      ← macOS notarization hook
│   └── release.js       ← Version bump + tag + push
├── assets/
│   ├── icon.ico         ← Windows icon (you must supply)
│   ├── icon.icns        ← macOS icon (you must supply)
│   ├── icon.png         ← Linux icon (you must supply)
│   ├── tray-icon.png    ← System tray icon (you must supply, 16x16 or 22x22)
│   └── entitlements.mac.plist  ← macOS notarization entitlements
└── package.json         ← electron-builder config
```

### Icon requirements
- `icon.ico`  — 256×256 minimum, multi-size ICO
- `icon.icns` — macOS iconset (use `iconutil` to generate from 1024×1024 PNG)
- `icon.png`  — 512×512 PNG for Linux
- `tray-icon.png` — 22×22 PNG (template image on macOS — use white/transparent)

Generate icons from a single 1024×1024 source PNG:
```bash
# Install: npm i -g electron-icon-maker
electron-icon-maker --input=icon-source-1024.png --output=assets/
```

---

## Verification checklist

- [ ] `npm run build:web` completes without errors
- [ ] `apps/web/.next/standalone/server.js` exists
- [ ] `npm run build:electron` produces an installer in `apps/desktop/dist/`
- [ ] Installer runs, app opens, loads platform UI
- [ ] Settings → Integrations → API Key stores/retrieves via safeStorage
- [ ] Groq proposal generation works from the desktop app
- [ ] GitHub Actions workflow triggers on tag push
- [ ] GitHub Release created with all three platform installers
- [ ] Installed app detects a new release within 5 minutes of publish
- [ ] Update banner appears and "Restart & install" works

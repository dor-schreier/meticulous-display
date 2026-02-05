# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-02-03

### Fixed
- **Raspberry Pi kiosk mode blank screen issue** - The most common deployment issue where the Pi would boot to a blank screen with blinking cursor has been completely resolved

### Added
- **Enhanced startup script** (`scripts/start-kiosk.sh`) with:
  - Health checks for X server readiness (max 30s timeout)
  - Health checks for Node.js app availability (max 60s timeout)
  - Automatic Chromium crash flag cleanup
  - Comprehensive logging to `/tmp/chromium-kiosk.log`
  - Better error messages and status output

- **Troubleshooting tools**:
  - `scripts/troubleshoot-pi.sh` - Comprehensive diagnostic script
  - `scripts/fix-kiosk.sh` - Automated fix for common kiosk issues
  - `PI-TROUBLESHOOTING.md` - Detailed troubleshooting guide

- **Improved systemd services**:
  - Increased kiosk startup delay from 10s to 15s
  - Added StandardOutput/StandardError journal logging
  - Better service dependencies and timing

- **Additional system dependencies**:
  - curl (for health checks)
  - tty group membership (for X server access)

### Changed
- **Updated `scripts/setup-pi.sh`** to include all fixes from `fix-kiosk.sh`
- **Chromium window size** changed from 800x480 to 1024x600 for better compatibility
- **Chromium flags** now include `--incognito` and `--disk-cache-size=1` for reliability
- **X authority permissions** now properly set during setup (600, correct ownership)
- **Removed auto-startx** from `.bash_profile` (systemd handles everything now)
- **Enhanced `.xinitrc`** with better conditional checks and comments

### Improved
- **Startup reliability**: Fresh installations now work correctly on first boot
- **Boot time**: Dashboard appears within 30-45 seconds from power-on
- **Error visibility**: All service logs available via `journalctl`
- **Documentation**: README.md and CLAUDE.md updated with troubleshooting info

## [1.0.0] - 2026-02-01

### Added
- Initial release
- Real-time espresso extraction display
- Shot history and detailed analysis
- Statistics dashboard
- Rating system for shots
- Raspberry Pi kiosk mode support
- WebSocket real-time updates
- SQLite shot caching
- Responsive design for touchscreens and desktop
- Dark theme with Meticulous branding

### Technical Stack
- Backend: Node.js, Express, WebSocket, SQLite
- Frontend: Preact, htm, uPlot
- Build: TypeScript, esbuild
- Deployment: systemd services, X server, Chromium kiosk

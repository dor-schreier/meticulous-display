# X Server Crash Loop Fix

## Problem

X server keeps restarting constantly ("restart counter is at 22"), preventing the kiosk service from starting.

**Symptoms:**
```bash
systemctl status xserver.service
# Shows: restart counter is at 22 (or higher)

systemctl status meticulous-kiosk.service
# Shows: inactive (dead)

journalctl -u meticulous-kiosk.service -b
# Shows: code=killed, status=15/TERM
```

## Root Cause

X server crashes immediately after starting due to **stale lock files** at `/tmp/.X0-lock` and `/tmp/.X11-unix/X0`.

This happens when:
1. X server crashes or is killed improperly
2. Lock files remain on disk
3. On next start, X sees the lock file and thinks another instance is running
4. X exits immediately
5. systemd restarts it
6. Loop repeats infinitely

## Quick Fix

Run the X server fix script:

```bash
cd ~/meticulous-display  # or /opt/meticulous-display
sudo bash scripts/fix-xserver.sh
```

This will:
1. Stop all services cleanly
2. Kill remaining X processes
3. **Remove lock files** (the key fix!)
4. Fix X authority permissions
5. Recreate X server service with lock file cleanup
6. Start X server and verify

## Manual Fix

If you prefer to do it manually:

### Step 1: Clean Up

```bash
# Stop everything
sudo systemctl stop meticulous-kiosk
sudo systemctl stop xserver
sudo killall X Xorg chromium chromium-browser 2>/dev/null || true

# Remove lock files (CRITICAL!)
sudo rm -f /tmp/.X0-lock
sudo rm -f /tmp/.X11-unix/X0
```

### Step 2: Update X Server Service

```bash
sudo nano /etc/systemd/system/xserver.service
```

Add these lines to the `[Service]` section:

```ini
[Service]
# ... existing lines ...

# Add these BEFORE ExecStart:
ExecStartPre=/bin/sh -c 'rm -f /tmp/.X0-lock /tmp/.X11-unix/X0 2>/dev/null || true'

# Keep ExecStart as is:
ExecStart=/usr/bin/X :0 -nolisten tcp vt7

# Add this AFTER ExecStart:
ExecStopPost=/bin/sh -c 'rm -f /tmp/.X0-lock /tmp/.X11-unix/X0 2>/dev/null || true'

# Add restart limits to prevent infinite loops:
StartLimitBurst=5
StartLimitIntervalSec=60
```

### Step 3: Reload and Restart

```bash
sudo systemctl daemon-reload
sudo systemctl start xserver
sleep 3
sudo systemctl status xserver  # Should show "active (running)"
```

### Step 4: Test X Connection

```bash
DISPLAY=:0 xset q
# Should show X server information, not an error
```

### Step 5: Start Kiosk

```bash
sudo systemctl start meticulous-kiosk
```

## Why This Fix Works

### The Problem
X server uses lock files to prevent multiple instances from running on the same display (`:0`). When X crashes, these files can remain:
- `/tmp/.X0-lock` - Contains PID of X process
- `/tmp/.X11-unix/X0` - Unix socket for X connections

### The Solution
**Clean lock files on every start:**
```bash
ExecStartPre=/bin/sh -c 'rm -f /tmp/.X0-lock /tmp/.X11-unix/X0 2>/dev/null || true'
```

This ensures a clean slate before X starts, preventing the crash loop.

**Clean on stop too:**
```bash
ExecStopPost=/bin/sh -c 'rm -f /tmp/.X0-lock /tmp/.X11-unix/X0 2>/dev/null || true'
```

This prevents lock files from accumulating.

**Restart limits prevent infinite loops:**
```ini
StartLimitBurst=5
StartLimitIntervalSec=60
```

If X fails 5 times within 60 seconds, systemd will give up instead of looping forever.

## Verification

After applying the fix, verify everything works:

```bash
# Check X server (should be stable)
systemctl status xserver
# Restart counter should be 0 or very low

# Check X is responding
DISPLAY=:0 xset q
# Should show server info

# Start kiosk
sudo systemctl start meticulous-kiosk

# Check kiosk status
systemctl status meticulous-kiosk
# Should show "active (running)"

# Verify on screen
# Dashboard should appear within 10-20 seconds
```

## Testing Boot Startup

After the fix, test automatic startup:

```bash
# Reboot
sudo reboot

# Wait ~45 seconds

# SSH back in and check
ssh pi@raspberrypi.local
systemctl status xserver
systemctl status meticulous-kiosk

# Both should show "active (running)"
```

## Prevention

The updated `setup-pi.sh` v2.0 and `fix-kiosk-boot.sh` now include this fix automatically. If you're setting up fresh or upgrading:

```bash
cd /opt/meticulous-display
git pull
sudo bash scripts/setup-pi.sh  # Or fix-kiosk-boot.sh
sudo reboot
```

## Diagnostic Command

If you encounter issues, run diagnostics:

```bash
cd ~/meticulous-display
sudo bash scripts/diagnose-xserver.sh
```

This will show:
- X server status and logs
- Xorg log file contents
- Running X processes
- Lock files
- Permission issues

## Common Causes

1. **Improper shutdown** - Powering off Pi without shutdown
2. **X server crashes** - Driver issues, out of memory
3. **Manual X killing** - `killall X` without cleanup
4. **Service restart loops** - Lock files accumulate

## Related Issues

- **"Can't open display :0"** - X not running, lock files present
- **"Server is already active for display 0"** - Stale lock file
- **"Fatal server error: Cannot establish any listening sockets"** - Socket file exists

All these point to lock file problems and are fixed by the same solution.

## See Also

- [KIOSK-BOOT-FIX.md](KIOSK-BOOT-FIX.md) - Boot timing issues
- [PI-TROUBLESHOOTING.md](PI-TROUBLESHOOTING.md) - General troubleshooting
- [fix-xserver.sh](scripts/fix-xserver.sh) - Automated fix script
- [diagnose-xserver.sh](scripts/diagnose-xserver.sh) - Diagnostic script

---

**Quick Command Reference:**

```bash
# Quick fix
cd ~/meticulous-display && sudo bash scripts/fix-xserver.sh

# Manual cleanup
sudo rm -f /tmp/.X0-lock /tmp/.X11-unix/X0
sudo systemctl restart xserver

# Diagnostics
sudo bash scripts/diagnose-xserver.sh

# Full fix (includes boot timing)
sudo bash scripts/fix-kiosk-boot.sh
```

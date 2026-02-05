# Kiosk Boot Issue - Quick Summary

## Problem
Kiosk service doesn't start automatically on boot, but works when started manually.

## Root Cause
Systemd service dependency timing issue:
- Weak dependencies (`Wants` instead of `Requires`/`BindsTo`)
- Wrong systemd target (`multi-user.target` instead of `graphical.target`)
- No explicit readiness checks (fixed sleep instead of active polling)
- Default target not set to `graphical.target`

## Solution Applied

### For Your Pi (Already Deployed)
Run this on your Raspberry Pi:

```bash
cd /opt/meticulous-display
sudo bash scripts/fix-kiosk-boot.sh
sudo reboot
```

### For Fresh Installations
The updated `scripts/setup-pi.sh` now includes all fixes by default.

## What Was Fixed

### 1. Service Dependencies
**Before:**
```ini
After=xserver.service meticulous-display.service
Wants=meticulous-display.service
Requires=xserver.service
```

**After:**
```ini
After=xserver.service meticulous-display.service
Requires=xserver.service
BindsTo=xserver.service
```

### 2. Readiness Checks
**Before:**
```ini
ExecStartPre=/bin/sleep 15
```

**After:**
```ini
ExecStartPre=/bin/bash -c 'timeout 60 bash -c "until systemctl is-active --quiet meticulous-display.service; do sleep 1; done"'
ExecStartPre=/bin/bash -c 'timeout 30 bash -c "until xset -display :0 q &>/dev/null; do sleep 1; done"'
ExecStartPre=/bin/sleep 5
```

### 3. Systemd Targets
**Before:**
```ini
[Install]
WantedBy=multi-user.target
```

**After:**
```ini
[Install]
WantedBy=graphical.target
```

Plus: `systemctl set-default graphical.target`

### 4. Network Dependency
**Before:**
```ini
After=network.target
```

**After:**
```ini
After=network-online.target
Wants=network-online.target
```

## Files Modified

1. `/etc/systemd/system/meticulous-display.service` - Backend service
2. `/etc/systemd/system/xserver.service` - X server
3. `/etc/systemd/system/meticulous-kiosk.service` - Kiosk service
4. System default target set to `graphical.target`

## Testing

After running the fix and rebooting, verify:

```bash
# Check all services are active
systemctl status meticulous-display.service
systemctl status xserver.service
systemctl status meticulous-kiosk.service

# Check default target
systemctl get-default  # Should show: graphical.target

# Check boot logs
journalctl -b | grep -E "meticulous|xserver|kiosk"
```

## Manual Start vs Boot Start

**Why manual start worked but boot didn't:**

| Manual Start | Boot Start |
|-------------|------------|
| ✅ Services already running | ❌ Race conditions |
| ✅ Dependencies satisfied | ❌ Weak dependencies |
| ✅ No timing issues | ❌ Fixed delays too short |
| ✅ User in correct context | ❌ Wrong systemd target |

The fix makes boot start behave like manual start by:
- Adding explicit readiness checks
- Using stronger dependencies
- Setting correct targets
- Ensuring proper service ordering

## Documentation

- **Full explanation:** [KIOSK-BOOT-FIX.md](KIOSK-BOOT-FIX.md)
- **Troubleshooting:** [PI-TROUBLESHOOTING.md](PI-TROUBLESHOOTING.md)
- **Setup script:** [scripts/setup-pi.sh](scripts/setup-pi.sh)
- **Fix script:** [scripts/fix-kiosk-boot.sh](scripts/fix-kiosk-boot.sh)

## Quick Commands

```bash
# Apply fix on existing Pi
cd /opt/meticulous-display
sudo bash scripts/fix-kiosk-boot.sh

# Check service status
systemctl status meticulous-kiosk.service

# View logs
journalctl -u meticulous-kiosk.service -b

# Manual restart for testing
sudo systemctl restart meticulous-kiosk.service

# Reboot
sudo reboot
```

## Prevention

For future setups:
1. Always use the latest `scripts/setup-pi.sh`
2. Set default target: `sudo systemctl set-default graphical.target`
3. Use explicit readiness checks in service files
4. Prefer `Requires`/`BindsTo` over `Wants` for critical dependencies

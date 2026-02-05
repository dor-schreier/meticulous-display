# Kiosk Service Not Starting on Boot - Fix Guide

## Problem

The kiosk service (`meticulous-kiosk.service`) works perfectly when started manually with `systemctl start meticulous-kiosk.service`, but doesn't start automatically on boot.

## Root Causes

This is a classic systemd service dependency and timing issue with multiple contributing factors:

### 1. **Weak Dependency Declarations**
The original service used:
```ini
After=xserver.service meticulous-display.service
Wants=meticulous-display.service
Requires=xserver.service
```

**Problem:** `After=` only controls ordering, not readiness. `Wants=` is weak and won't wait for full activation.

### 2. **Wrong WantedBy Target**
Services were using `WantedBy=multi-user.target` instead of `graphical.target`.

**Problem:** `multi-user.target` is reached before display services are typically ready. `graphical.target` is the correct target for GUI applications.

### 3. **Default Target Not Set**
The system default target might be `multi-user.target` instead of `graphical.target`.

**Problem:** If the default target is `multi-user`, services with `WantedBy=graphical.target` won't start automatically.

### 4. **No Explicit Readiness Checks**
The service was using a simple `sleep 15` delay.

**Problem:** Fixed delays don't account for variable boot times. Services might not be truly ready after 15 seconds on a slower boot.

## The Fix

### Quick Fix (Apply to Existing Installation)

Run this script on your Pi:

```bash
cd /opt/meticulous-display
sudo bash scripts/fix-kiosk-boot.sh
```

Then reboot:
```bash
sudo reboot
```

### What the Fix Does

The fix applies several improvements:

#### 1. **Stronger Dependencies in Kiosk Service**

```ini
[Unit]
After=xserver.service meticulous-display.service
Requires=xserver.service
BindsTo=xserver.service
```

- `Requires=` + `BindsTo=` creates a strong dependency
- If X server fails, kiosk service will also stop
- Ensures proper lifecycle management

#### 2. **Explicit Readiness Checks**

```ini
[Service]
# Wait for backend to be fully active
ExecStartPre=/bin/bash -c 'timeout 60 bash -c "until systemctl is-active --quiet meticulous-display.service; do sleep 1; done"'
# Wait for X server to accept connections
ExecStartPre=/bin/bash -c 'timeout 30 bash -c "until xset -display :0 q &>/dev/null; do sleep 1; done"'
# Additional safety delay
ExecStartPre=/bin/sleep 5
```

**Benefits:**
- Actively checks if services are ready, not just started
- Timeouts prevent infinite waiting
- Multiple verification steps ensure stability

#### 3. **Correct Systemd Targets**

```ini
[Install]
WantedBy=graphical.target
```

And set system default:
```bash
systemctl set-default graphical.target
```

**Why this matters:**
- `graphical.target` is the proper target for GUI services
- Ensures services start in the right boot phase
- Compatible with display/kiosk use cases

#### 4. **Improved Backend Service**

```ini
[Unit]
After=network-online.target
Wants=network-online.target

[Service]
Restart=always  # Changed from on-failure
```

**Benefits:**
- Waits for network to be fully online before starting
- More aggressive restart policy for reliability

#### 5. **Improved X Server Service**

```ini
[Unit]
After=multi-user.target systemd-user-sessions.service
Conflicts=getty@tty7.service

[Install]
WantedBy=graphical.target
```

**Benefits:**
- Waits for user sessions to be ready
- Prevents conflicts with TTY7
- Proper target assignment

## Manual Application (Alternative)

If you want to apply the fix manually without the script:

### Step 1: Edit Backend Service
```bash
sudo nano /etc/systemd/system/meticulous-display.service
```

Change:
- `After=network.target` → `After=network-online.target`
- Add: `Wants=network-online.target`
- `Restart=on-failure` → `Restart=always`
- Add: `StandardOutput=journal` and `StandardError=journal`

### Step 2: Edit X Server Service
```bash
sudo nano /etc/systemd/system/xserver.service
```

Change:
- `After=multi-user.target` → `After=multi-user.target systemd-user-sessions.service`
- Add: `Conflicts=getty@tty7.service`
- `WantedBy=multi-user.target` → `WantedBy=graphical.target`
- `RestartSec=3` → `RestartSec=5`

### Step 3: Edit Kiosk Service
```bash
sudo nano /etc/systemd/system/meticulous-kiosk.service
```

Replace the entire `[Unit]` and `[Service]` sections with:

```ini
[Unit]
Description=Meticulous Display Kiosk
After=xserver.service meticulous-display.service
Requires=xserver.service
BindsTo=xserver.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/pi/.Xauthority
Environment=HOME=/home/pi
ExecStartPre=/bin/bash -c 'timeout 60 bash -c "until systemctl is-active --quiet meticulous-display.service; do sleep 1; done"'
ExecStartPre=/bin/bash -c 'timeout 30 bash -c "until xset -display :0 q &>/dev/null; do sleep 1; done"'
ExecStartPre=/bin/sleep 5
ExecStart=/bin/bash /opt/meticulous-display/scripts/start-kiosk.sh
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=graphical.target
```

(Replace `pi` with your actual username if different)

### Step 4: Set Default Target and Reload
```bash
sudo systemctl set-default graphical.target
sudo systemctl daemon-reload
sudo systemctl reenable meticulous-display.service
sudo systemctl reenable xserver.service
sudo systemctl reenable meticulous-kiosk.service
```

### Step 5: Reboot
```bash
sudo reboot
```

## Verification

After rebooting, check that all services started:

```bash
# Check service status
systemctl status meticulous-display.service
systemctl status xserver.service
systemctl status meticulous-kiosk.service

# Check boot logs
journalctl -u meticulous-kiosk.service -b
journalctl -u xserver.service -b

# Verify default target
systemctl get-default  # Should show: graphical.target
```

## Why Manual Start Works But Boot Doesn't

When you manually run `systemctl start meticulous-kiosk.service`:
- Other services are already running and stable
- Dependencies are already satisfied
- No race conditions or timing issues
- systemd waits for prerequisites

On boot:
- Services start in parallel
- Weak dependencies might not wait properly
- Fixed delays might be too short on slow boots
- Wrong target means service never scheduled to start
- Race conditions between service initialization

The fix addresses all these boot-specific issues.

## Additional Notes

### For Fresh Installations

If you're doing a fresh Pi setup, use the updated `scripts/setup-pi.sh` which now includes all these fixes by default.

### For Debugging

If issues persist after applying the fix:

1. **Check boot logs:**
   ```bash
   journalctl -b | grep -E "meticulous|xserver|kiosk"
   ```

2. **Check X server:**
   ```bash
   ps aux | grep X
   echo $DISPLAY
   xset q
   ```

3. **Check service order:**
   ```bash
   systemctl list-dependencies graphical.target
   ```

4. **Verify readiness checks:**
   ```bash
   # Test if backend is active
   systemctl is-active meticulous-display.service

   # Test if X server accepts connections
   DISPLAY=:0 xset q
   ```

### Recovery

If kiosk mode prevents SSH access:

1. Connect keyboard/monitor to Pi
2. Press `Ctrl+Alt+F2` to switch to TTY2
3. Login and run:
   ```bash
   sudo systemctl stop meticulous-kiosk.service
   sudo systemctl stop xserver.service
   ```
4. Now you can troubleshoot or SSH in

## References

- [systemd Service Documentation](https://www.freedesktop.org/software/systemd/man/systemd.service.html)
- [systemd Target Units](https://www.freedesktop.org/software/systemd/man/systemd.target.html)
- [Raspberry Pi Kiosk Setup Best Practices](https://www.raspberrypi.com/tutorials/how-to-use-a-raspberry-pi-in-kiosk-mode/)

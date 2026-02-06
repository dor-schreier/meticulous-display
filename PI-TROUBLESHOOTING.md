# Raspberry Pi Kiosk Troubleshooting Guide

## Symptoms: Blank Screen with Blinking Cursor

This happens when the X server starts but Chromium (the kiosk browser) doesn't launch properly.

## Quick Fix

SSH into your Raspberry Pi and run:

```bash
cd /opt/meticulous-display
sudo bash scripts/fix-kiosk.sh
```

This script will:
- Stop all services cleanly
- Recreate service configurations with better timing
- Fix permissions and authority files
- Restart everything in the correct order
- Show you detailed logs

## Manual Troubleshooting

### 1. Check Service Status

```bash
# Check which services are running
sudo systemctl status meticulous-display.service
sudo systemctl status xserver.service
sudo systemctl status meticulous-kiosk.service
```

### 2. View Live Logs

```bash
# Watch kiosk service logs (most likely culprit)
journalctl -u meticulous-kiosk.service -f

# Watch X server logs
journalctl -u xserver.service -f

# Watch Node.js app logs
journalctl -u meticulous-display.service -f
```

### 3. Run Diagnostic Script

```bash
sudo bash scripts/troubleshoot-pi.sh
```

This will check:
- Service statuses
- Process running states
- Configuration files
- Build artifacts
- Network connectivity
- Display environment
- Chromium installation

### 4. Manual Service Restart

```bash
# Stop everything
sudo systemctl stop meticulous-kiosk.service
sudo systemctl stop xserver.service
sudo systemctl stop meticulous-display.service

# Start in order
sudo systemctl start meticulous-display.service
sleep 5
sudo systemctl start xserver.service
sleep 5
sudo systemctl start meticulous-kiosk.service
```

### 5. Test Manually

If services won't start, test each component manually:

#### Test Node.js App
```bash
cd /opt/meticulous-display
node dist/server/index.js
# Should see: "Server listening on http://0.0.0.0:3002"
# Press Ctrl+C to stop
```

#### Test X Server
```bash
# Switch to a different TTY first
# Press Ctrl+Alt+F2, login, then:
sudo systemctl stop xserver.service
DISPLAY=:0 startx &
# Check if X starts without errors
```

#### Test Chromium
```bash
# After X server is running
DISPLAY=:0 chromium --kiosk http://localhost:3002
# Should see the dashboard in fullscreen
```

## Common Issues and Solutions

### Issue 1: X Server Won't Start

**Symptoms:** `journalctl -u xserver.service` shows errors

**Solutions:**
```bash
# Check video permissions
sudo usermod -a -G video,input,tty pi

# Fix authority file
touch ~/.Xauthority
chmod 600 ~/.Xauthority

# Restart
sudo systemctl restart xserver.service
```

### Issue 2: Chromium Won't Start

**Symptoms:** X server runs but screen is blank

**Solutions:**
```bash
# Check if Chromium is installed
chromium --version
# or
chromium-browser --version

# If not installed:
sudo apt-get install -y chromium

# Clear Chromium crash flags
rm -rf ~/.config/chromium/Singleton*
rm -rf ~/.config/chromium-browser/Singleton*

# Check kiosk logs
journalctl -u meticulous-kiosk.service -n 50
```

### Issue 3: Node.js App Not Running

**Symptoms:** Services start but can't connect to localhost:3002

**Solutions:**
```bash
# Check if app is built
ls -la /opt/meticulous-display/dist/server/index.js

# If not built:
cd /opt/meticulous-display
npm run build

# Check configuration
cat /opt/meticulous-display/config/local.json

# If missing:
cp /opt/meticulous-display/config/local.json.example \
   /opt/meticulous-display/config/local.json
nano /opt/meticulous-display/config/local.json

# Restart service
sudo systemctl restart meticulous-display.service
```

### Issue 4: Services Start Too Quickly

**Symptoms:** Kiosk tries to start before X server or Node.js are ready

**Solutions:**
The `fix-kiosk.sh` script addresses this by:
- Adding 15-second delay to kiosk service
- Adding health checks in start-kiosk.sh
- Waiting for localhost:3002 to respond

If still too fast, increase delays in `/etc/systemd/system/meticulous-kiosk.service`:
```bash
sudo nano /etc/systemd/system/meticulous-kiosk.service
# Change: ExecStartPre=/bin/sleep 15
# To:     ExecStartPre=/bin/sleep 30
sudo systemctl daemon-reload
sudo systemctl restart meticulous-kiosk.service
```

### Issue 5: Display Not Showing on Physical Screen

**Symptoms:** Services run but nothing on touchscreen

**Solutions:**
```bash
# Check if processes are actually running
ps aux | grep X
ps aux | grep chromium

# Check display configuration
echo $DISPLAY  # Should be :0
xrandr         # Should show display info

# Test display manually
DISPLAY=:0 xset q
```

## Service Dependencies

The services must start in this order:

1. **meticulous-display.service** - Node.js app (serves the web UI)
2. **xserver.service** - X Window System (graphical display)
3. **meticulous-kiosk.service** - Chromium in kiosk mode (displays the UI)

```
meticulous-display  →  xserver  →  meticulous-kiosk
   (Node.js app)      (X Server)    (Chromium browser)
```

## Files to Check

### Service Files
- `/etc/systemd/system/meticulous-display.service`
- `/etc/systemd/system/xserver.service`
- `/etc/systemd/system/meticulous-kiosk.service`

### Scripts
- `/opt/meticulous-display/scripts/start-kiosk.sh`

### Configuration
- `/opt/meticulous-display/config/local.json`
- `/home/pi/.xinitrc`
- `/home/pi/.bash_profile`
- `/home/pi/.Xauthority`

### Logs
```bash
# Service logs
journalctl -u meticulous-display.service
journalctl -u xserver.service
journalctl -u meticulous-kiosk.service

# Chromium log
/tmp/chromium-kiosk.log

# X server log
~/.local/share/xorg/Xorg.0.log
```

## Nuclear Option: Full Reset

If nothing works, reinstall everything:

```bash
# Stop and disable services
sudo systemctl stop meticulous-kiosk.service
sudo systemctl stop xserver.service
sudo systemctl stop meticulous-display.service
sudo systemctl disable meticulous-kiosk.service
sudo systemctl disable xserver.service
sudo systemctl disable meticulous-display.service

# Remove service files
sudo rm /etc/systemd/system/meticulous-display.service
sudo rm /etc/systemd/system/xserver.service
sudo rm /etc/systemd/system/meticulous-kiosk.service
sudo systemctl daemon-reload

# Clean X configuration
rm ~/.xinitrc
rm ~/.Xauthority

# Clean Chromium
rm -rf ~/.config/chromium*
rm -rf ~/.cache/chromium*

# Re-run setup
cd /opt/meticulous-display
sudo bash scripts/setup-pi.sh

# Or use the fix script
sudo bash scripts/fix-kiosk.sh
```

## Testing Without Reboot

After making changes, test without rebooting:

```bash
# Apply changes
sudo systemctl daemon-reload

# Restart in order
sudo systemctl restart meticulous-display.service && \
sleep 3 && \
sudo systemctl restart xserver.service && \
sleep 5 && \
sudo systemctl restart meticulous-kiosk.service

# Watch logs
journalctl -u meticulous-kiosk.service -f
```

## Emergency Access

If the screen is stuck and you can't SSH:

1. **Connect keyboard to Pi**
2. **Press Ctrl+Alt+F2** - Switch to TTY2
3. **Login** with your credentials
4. **Run commands** to fix issues
5. **Press Ctrl+Alt+F7** - Switch back to X server (TTY7)

Alternatively, connect monitor and keyboard before booting.

## Expected Boot Sequence

When everything works correctly:

1. Pi boots (10-20 seconds)
2. Services start automatically
3. X server starts on TTY7 (3-5 seconds)
4. Node.js app starts (2-3 seconds)
5. Chromium launches in kiosk mode (10-15 seconds)
6. Dashboard appears on screen (1-2 seconds)

**Total time from power-on to dashboard: ~30-45 seconds**

## Getting Help

If you're still stuck:

1. Run `sudo bash scripts/troubleshoot-pi.sh` and save the output
2. Check recent logs: `journalctl -u meticulous-kiosk.service -n 100`
3. Check Chromium log: `cat /tmp/chromium-kiosk.log`
4. Include your Pi model and OS version: `cat /etc/os-release`

## Prevention

To avoid these issues in the future:

1. **Always use the fix script** after system updates
2. **Don't modify service files manually** - use the scripts
3. **Check logs regularly**: `journalctl -u meticulous-kiosk.service`
4. **Test after changes**: `sudo systemctl restart meticulous-kiosk.service`
5. **Keep backups** of working configurations

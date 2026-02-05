# Complete Installation Guide - Meticulous Display v2.0

> **One-command installation with automatic boot fix integration**

## Quick Start

### For First-Time Installation

```bash
# 1. Copy project to your Raspberry Pi
scp -r . pi@raspberrypi.local:~/meticulous-display/

# 2. SSH into the Pi
ssh pi@raspberrypi.local

# 3. Run the setup script (includes ALL fixes!)
cd ~/meticulous-display
sudo bash scripts/setup-pi.sh

# 4. Configure your machine IP
sudo nano /opt/meticulous-display/config/local.json
# Change "host": "192.168.1.115" to your machine's IP

# 5. Reboot
sudo reboot
```

**That's it!** The dashboard will appear automatically within 30-45 seconds. ✅

### For Upgrading Existing Installation

```bash
# 1. Pull latest changes
cd /opt/meticulous-display
git pull

# 2. Re-run setup (your config will be preserved!)
sudo bash scripts/setup-pi.sh

# 3. Reboot
sudo reboot
```

---

## What Makes v2.0 Special?

### ✨ All-in-One Installation

**Previous versions required:**
1. Run `setup-pi.sh`
2. Reboot
3. Notice kiosk doesn't start 😞
4. Run `fix-kiosk-boot.sh`
5. Reboot again

**Version 2.0:**
1. Run `setup-pi.sh` ✅
2. Reboot
3. Everything works! 🎉

### 🔧 Technical Improvements

| Feature | v1.x | v2.0 |
|---------|------|------|
| Boot timing | ❌ Manual fix required | ✅ Built-in |
| Service dependencies | ⚠️ Weak (`Wants`) | ✅ Strong (`BindsTo`) |
| Readiness checks | ❌ Fixed delays | ✅ Active polling |
| Systemd target | ❌ Wrong (multi-user) | ✅ Correct (graphical) |
| Network wait | ⚠️ Basic | ✅ network-online |
| Config preservation | ❌ Lost on upgrade | ✅ Automatic backup |
| Verification | ❌ None | ✅ Comprehensive |

### 🎯 Key Features

#### 1. **Automatic Boot Timing Fix**
Services now wait for dependencies to be **actually ready**, not just started:

```bash
# Backend must be fully active (max 60s)
until systemctl is-active --quiet meticulous-display.service; do sleep 1; done

# X server must accept connections (max 30s)
until xset -display :0 q &>/dev/null; do sleep 1; done
```

#### 2. **Strong Service Dependencies**
```ini
[Unit]
After=xserver.service meticulous-display.service
Requires=xserver.service
BindsTo=xserver.service  # 🆕 If X stops, kiosk stops too
```

#### 3. **Correct Systemd Targets**
```ini
[Install]
WantedBy=graphical.target  # 🆕 Was: multi-user.target
```

Plus: `systemctl set-default graphical.target` ensures it's active

#### 4. **Network-Online Dependency**
```ini
[Unit]
After=network-online.target
Wants=network-online.target  # 🆕 Waits for actual connectivity
```

#### 5. **Config Preservation**
Automatically backs up and restores `config/local.json` during upgrades

#### 6. **Installation Verification**
After setup, automatically checks:
- ✅ Node.js installation
- ✅ Chromium installation
- ✅ Build artifacts
- ✅ Service enablement
- ✅ Default systemd target
- ✅ User group membership

---

## Detailed Setup Process

### Prerequisites

**Hardware:**
- Raspberry Pi Zero 2W (or newer)
- 7" touchscreen (800x480 or 1024x600 recommended)
- MicroSD card (8GB minimum, 16GB recommended)
- Power supply (5V 2.5A minimum)

**Software:**
- Raspberry Pi OS Lite (Bookworm or Bullseye)
- SSH enabled
- Network connection

### Step-by-Step Installation

#### Step 1: Prepare the Pi

```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Enable SSH if not already enabled
sudo systemctl enable ssh
sudo systemctl start ssh
```

#### Step 2: Copy Project Files

From your development machine:

```bash
# Option A: Using SCP
scp -r /path/to/meticulous-display pi@raspberrypi.local:~/

# Option B: Using Git (if Pi has internet)
ssh pi@raspberrypi.local
git clone https://github.com/your-repo/meticulous-display.git
cd meticulous-display
```

#### Step 3: Run Setup Script

```bash
cd ~/meticulous-display
sudo bash scripts/setup-pi.sh
```

**What you'll see:**
```
========================================
Meticulous Display - Pi Setup v2.0
========================================
Complete installation with boot fixes

Setting up for user: pi
Home directory: /home/pi

1. Updating system packages...
2. Installing Node.js...
3. Installing build dependencies...
4. Installing Chromium...
5. Installing X server components...
6. Creating app directory at /opt/meticulous-display...
7. Copying app files...
8. Installing npm dependencies...
9. Building the app...
10. Creating systemd service...
11. Adding user to video, input, and tty groups...
12. Creating X server service...
13. Creating kiosk service...
14. Creating kiosk start script...
15. Fixing X authority permissions...
16. Enabling services...
    Setting default systemd target to graphical.target...
17. Applying Pi optimizations...
18. Creating local config template...
19. Verifying installation...
✓ Node.js installed: v20.x.x
✓ Chromium installed: Chromium 120.x.x
✓ App built successfully
✓ meticulous-display.service enabled
✓ xserver.service enabled
✓ meticulous-kiosk.service enabled
✓ Default target set to graphical.target
✓ User pi in correct groups (video, input, tty)

========================================
✅ Setup Complete - All Checks Passed!
========================================
```

#### Step 4: Configure Machine IP

```bash
# Create config from template
cp /opt/meticulous-display/config/local.json.example \
   /opt/meticulous-display/config/local.json

# Edit configuration
sudo nano /opt/meticulous-display/config/local.json
```

Change this:
```json
{
  "machine": {
    "host": "192.168.1.115",  // ← Change to your machine's IP
    "port": 8080
  }
}
```

Save and exit (Ctrl+X, Y, Enter)

#### Step 5: Reboot

```bash
sudo reboot
```

#### Step 6: Verify

After reboot (30-45 seconds), the dashboard should appear automatically.

**If you need to check manually:**
```bash
# SSH back in
ssh pi@raspberrypi.local

# Check all services are active
systemctl status meticulous-display.service
systemctl status xserver.service
systemctl status meticulous-kiosk.service

# All should show: "active (running)" in green
```

---

## Upgrade Guide

### From v1.x to v2.0

If you installed with an older version of the setup script:

```bash
# Pull latest changes
cd /opt/meticulous-display
git pull

# Option 1: Re-run full setup (recommended)
sudo bash scripts/setup-pi.sh
# Your config/local.json will be preserved!

# Option 2: Just apply the boot fix
sudo bash scripts/fix-kiosk-boot.sh

# Reboot
sudo reboot
```

### Verification After Upgrade

```bash
# Check default target (should be graphical.target)
systemctl get-default

# Check service configurations
systemctl cat meticulous-kiosk.service | grep -E "BindsTo|ExecStartPre|WantedBy"

# Should see:
# BindsTo=xserver.service
# ExecStartPre=/bin/bash -c 'timeout 60...'
# WantedBy=graphical.target
```

---

## Configuration Options

### Basic Configuration (`config/local.json`)

```json
{
  "machine": {
    "host": "192.168.1.115",
    "port": 8080
  },
  "server": {
    "port": 3002,
    "host": "0.0.0.0"
  }
}
```

### Advanced Configuration

```json
{
  "machine": {
    "host": "192.168.1.115",
    "port": 8080
  },
  "server": {
    "port": 3002,
    "host": "0.0.0.0"
  },
  "cache": {
    "maxShots": 500,
    "dbPath": "./data/history.db"
  },
  "display": {
    "mode": "auto",
    "compactWidth": 1024,
    "compactHeight": 600
  },
  "realtime": {
    "sampleRate": 10,
    "maxGraphPoints": 300
  }
}
```

### Environment Variables

Override config via environment variables:

```bash
# In /etc/systemd/system/meticulous-display.service
[Service]
Environment=MACHINE_HOST=192.168.1.100
Environment=SERVER_PORT=3003
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl restart meticulous-display
```

---

## Service Management

### Starting/Stopping Services

```bash
# Stop all services
sudo systemctl stop meticulous-kiosk
sudo systemctl stop xserver
sudo systemctl stop meticulous-display

# Start in order
sudo systemctl start meticulous-display
sleep 3
sudo systemctl start xserver
sleep 5
sudo systemctl start meticulous-kiosk
```

### Viewing Logs

```bash
# Real-time logs
journalctl -u meticulous-kiosk -f
journalctl -u xserver -f
journalctl -u meticulous-display -f

# Boot logs (from last boot)
journalctl -u meticulous-kiosk -b

# Last 50 lines
journalctl -u meticulous-kiosk -n 50

# Chromium logs
tail -f /tmp/chromium-kiosk.log
```

### Disabling Auto-Start

To prevent kiosk from starting on boot:

```bash
sudo systemctl disable meticulous-kiosk
sudo systemctl stop meticulous-kiosk
```

Backend will still run, accessible via network.

---

## Troubleshooting

### Problem: Kiosk Doesn't Start on Boot

**Symptoms:** Works with `systemctl start` but not on boot

**Solution:**
```bash
cd /opt/meticulous-display
sudo bash scripts/fix-kiosk-boot.sh
sudo reboot
```

**See:** [KIOSK-BOOT-FIX.md](KIOSK-BOOT-FIX.md)

### Problem: Blank Screen with Cursor

**Symptoms:** X server runs but no dashboard

**Solution:**
```bash
# Check if Chromium is running
ps aux | grep chromium

# If not, check kiosk logs
journalctl -u meticulous-kiosk -n 50

# Run fix script
sudo bash /opt/meticulous-display/scripts/fix-kiosk.sh
```

### Problem: "Cannot connect to machine"

**Symptoms:** Backend starts but can't reach espresso machine

**Solutions:**

1. **Check machine IP:**
   ```bash
   cat /opt/meticulous-display/config/local.json
   ping 192.168.1.115  # Use your IP
   ```

2. **Check machine is on:**
   ```bash
   curl http://192.168.1.115:8080/api/status
   ```

3. **Check firewall (if any):**
   ```bash
   sudo iptables -L
   ```

### Problem: Services Start in Wrong Order

Already fixed in v2.0! But if you still see it:

```bash
# Check service dependencies
systemctl list-dependencies meticulous-kiosk.service

# Should show xserver and meticulous-display as dependencies
```

### Emergency Access

If kiosk prevents access:

1. **Via keyboard:** Press `Ctrl+Alt+F2` to switch to TTY2
2. **Via SSH:** Should still work from another device
3. **Via monitor:** Connect HDMI, use keyboard

Then stop kiosk:
```bash
sudo systemctl stop meticulous-kiosk
```

---

## Performance Tuning

### For Faster Boot

Already optimized in v2.0, but you can tweak:

```bash
# Reduce boot delays (in /etc/systemd/system/meticulous-kiosk.service)
ExecStartPre=/bin/sleep 2  # Reduce from 5 to 2
```

### For More Responsive UI

```json
// In config/local.json
{
  "realtime": {
    "sampleRate": 20,  // Increase from 10
    "maxGraphPoints": 500  // Increase from 300
  }
}
```

⚠️ Warning: May impact Pi Zero 2W performance

---

## Uninstallation

To completely remove:

```bash
# Stop and disable services
sudo systemctl stop meticulous-kiosk
sudo systemctl stop xserver
sudo systemctl stop meticulous-display
sudo systemctl disable meticulous-kiosk
sudo systemctl disable xserver
sudo systemctl disable meticulous-display

# Remove service files
sudo rm /etc/systemd/system/meticulous-display.service
sudo rm /etc/systemd/system/xserver.service
sudo rm /etc/systemd/system/meticulous-kiosk.service
sudo systemctl daemon-reload

# Remove app directory
sudo rm -rf /opt/meticulous-display

# Restore default target (optional)
sudo systemctl set-default multi-user.target

# Remove user groups (optional)
sudo gpasswd -d pi video
sudo gpasswd -d pi input
sudo gpasswd -d pi tty
```

---

## Additional Resources

### Documentation

- **[README.md](README.md)** - Overview and quick start
- **[CLAUDE.md](CLAUDE.md)** - Technical architecture (for developers)
- **[KIOSK-BOOT-FIX.md](KIOSK-BOOT-FIX.md)** - Boot timing issue deep dive
- **[PI-TROUBLESHOOTING.md](PI-TROUBLESHOOTING.md)** - Comprehensive troubleshooting
- **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)** - Command cheat sheet
- **[SETUP-PI-CHANGELOG.md](SETUP-PI-CHANGELOG.md)** - Version 2.0 changelog

### Scripts

- `scripts/setup-pi.sh` - Main installation script (v2.0)
- `scripts/fix-kiosk-boot.sh` - Standalone boot fix
- `scripts/fix-kiosk.sh` - General kiosk fix
- `scripts/troubleshoot-pi.sh` - Diagnostic script

### Support

1. Check documentation above
2. Run diagnostic: `sudo bash /opt/meticulous-display/scripts/troubleshoot-pi.sh`
3. Check logs: `journalctl -u meticulous-kiosk -b`
4. Review [PI-TROUBLESHOOTING.md](PI-TROUBLESHOOTING.md)

---

## What's Next?

After successful installation:

1. **Customize Display**
   - Adjust data series visibility in Settings
   - Configure chart options

2. **Monitor Performance**
   - Check logs periodically: `journalctl -u meticulous-display -f`
   - Monitor disk usage: `df -h`
   - Check memory: `free -h`

3. **Keep Updated**
   ```bash
   cd /opt/meticulous-display
   git pull
   sudo bash scripts/setup-pi.sh  # Config preserved!
   sudo reboot
   ```

4. **Enjoy!** ☕
   - View live extractions
   - Review shot history
   - Analyze statistics

---

**Version:** 2.0
**Last Updated:** 2024-02-05
**Tested On:** Raspberry Pi Zero 2W, Pi OS Bookworm

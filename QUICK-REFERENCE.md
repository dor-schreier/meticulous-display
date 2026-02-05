# Meticulous Display - Quick Reference

## 🚀 Initial Setup

```bash
# Copy to Pi
scp -r . pi@raspberrypi.local:~/meticulous-display/

# SSH and setup
ssh pi@raspberrypi.local
cd ~/meticulous-display
sudo bash scripts/setup-pi.sh

# Configure machine IP
sudo cp /opt/meticulous-display/config/local.json.example \
        /opt/meticulous-display/config/local.json
sudo nano /opt/meticulous-display/config/local.json

# Reboot
sudo reboot
```

## 🔍 Troubleshooting

### Blank Screen on Boot
```bash
# Run automatic fix
sudo bash /opt/meticulous-display/scripts/fix-kiosk.sh

# Or run diagnostics
sudo bash /opt/meticulous-display/scripts/troubleshoot-pi.sh
```

### Check Service Status
```bash
sudo systemctl status meticulous-display
sudo systemctl status xserver
sudo systemctl status meticulous-kiosk
```

### View Logs
```bash
# Live logs
journalctl -u meticulous-display -f
journalctl -u xserver -f
journalctl -u meticulous-kiosk -f

# Recent logs
journalctl -u meticulous-kiosk -n 50

# Chromium log
tail -f /tmp/chromium-kiosk.log
```

## 🔄 Service Management

### Restart Services
```bash
# Restart all (in order)
sudo systemctl restart meticulous-display && \
sleep 3 && \
sudo systemctl restart xserver && \
sleep 5 && \
sudo systemctl restart meticulous-kiosk

# Restart individual service
sudo systemctl restart meticulous-kiosk
```

### Stop Services
```bash
sudo systemctl stop meticulous-kiosk
sudo systemctl stop xserver
sudo systemctl stop meticulous-display
```

### Start Services
```bash
sudo systemctl start meticulous-display
sleep 3
sudo systemctl start xserver
sleep 5
sudo systemctl start meticulous-kiosk
```

### Enable/Disable Auto-start
```bash
# Enable (start on boot)
sudo systemctl enable meticulous-display
sudo systemctl enable xserver
sudo systemctl enable meticulous-kiosk

# Disable (don't start on boot)
sudo systemctl disable meticulous-kiosk
```

## 🛠️ Common Fixes

### Fix Permissions
```bash
touch ~/.Xauthority
chmod 600 ~/.Xauthority
sudo usermod -a -G video,input,tty $USER
```

### Clear Chromium Crash Flags
```bash
rm -rf ~/.config/chromium/Singleton*
rm -rf ~/.config/chromium-browser/Singleton*
sudo systemctl restart meticulous-kiosk
```

### Rebuild Application
```bash
cd /opt/meticulous-display
sudo -u pi npm run build
sudo systemctl restart meticulous-display
```

### Update Machine IP
```bash
sudo nano /opt/meticulous-display/config/local.json
sudo systemctl restart meticulous-display
```

## 🔎 Diagnostics

### Check if Processes Running
```bash
# Node.js app
ps aux | grep "node dist/server/index.js" | grep -v grep

# X server
ps aux | grep "/usr/bin/X" | grep -v grep

# Chromium
ps aux | grep chromium | grep -v grep
```

### Test Node.js App
```bash
curl http://localhost:3002
# Should return HTML
```

### Test X Server
```bash
DISPLAY=:0 xset q
# Should show display settings
```

### Manual Chromium Launch
```bash
# Stop kiosk service first
sudo systemctl stop meticulous-kiosk

# Launch manually to see errors
DISPLAY=:0 chromium --kiosk http://localhost:3002
```

## 📊 System Information

### Check Service Files
```bash
# Node.js service
cat /etc/systemd/system/meticulous-display.service

# X server service
cat /etc/systemd/system/xserver.service

# Kiosk service
cat /etc/systemd/system/meticulous-kiosk.service

# Startup script
cat /opt/meticulous-display/scripts/start-kiosk.sh
```

### Check Configuration
```bash
# App config
cat /opt/meticulous-display/config/local.json

# X config
cat ~/.xinitrc

# Display
echo $DISPLAY
```

### System Resources
```bash
# Memory usage
free -h

# CPU usage
top -bn1 | head -20

# Disk space
df -h
```

## 🌐 Network Access

### Local Access
```
http://localhost:3002
```

### Remote Access (from another device)
```
http://PI_IP_ADDRESS:3002
```

### Find Pi IP Address
```bash
hostname -I | awk '{print $1}'
```

## 🔧 Development Mode

### Run Without Kiosk (for testing)
```bash
# SSH into Pi
ssh pi@raspberrypi.local

# Stop kiosk
sudo systemctl stop meticulous-kiosk

# Run Node.js app manually
cd /opt/meticulous-display
node dist/server/index.js

# Access from another device
# http://PI_IP:3002
```

### Development on Desktop
```bash
# On your development machine
cd meticulous-display
npm install
npm run build

# Create config
cp config/local.json.example config/local.json
nano config/local.json  # Set machine IP

# Run
npm start
# Or for hot reload:
npm run dev

# Open browser
# http://localhost:3002
```

## 📝 Configuration Format

### config/local.json
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
    "maxShots": 500
  }
}
```

## 🔐 Emergency Access

### Switch to Console (when screen is stuck)
```
Press: Ctrl + Alt + F2
Login: pi / your_password
Commands: (run any command)
Switch back: Ctrl + Alt + F7
```

### Force Reboot
```bash
sudo reboot now
```

### Force Shutdown
```bash
sudo shutdown -h now
```

## 📖 Documentation Files

- **README.md** - General project documentation
- **CLAUDE.md** - AI assistant reference (technical details)
- **PI-TROUBLESHOOTING.md** - Comprehensive troubleshooting guide
- **DEPLOYMENT-FIXES.md** - Details of recent fixes
- **CHANGELOG.md** - Version history
- **QUICK-REFERENCE.md** - This file

## 🆘 Getting Help

1. **Check logs:** `journalctl -u meticulous-kiosk -f`
2. **Run diagnostics:** `sudo bash scripts/troubleshoot-pi.sh`
3. **Check documentation:** See PI-TROUBLESHOOTING.md
4. **Check Chromium log:** `tail -f /tmp/chromium-kiosk.log`

## 🎯 Expected Boot Sequence

```
1. Pi boots → 10-20s
2. Node.js starts → 2-3s
3. X server starts → 3-5s
4. Wait 15s (systemd delay)
5. Kiosk script:
   - Wait for X server → 0-5s
   - Wait for Node.js → 0-5s
   - Launch Chromium → 5-10s
6. Dashboard appears → 1-2s

Total: 30-45 seconds
```

## ✅ Success Indicators

When everything is working:
- Services show "active (running)" in `systemctl status`
- Logs show "X server is ready!" and "Node.js app is ready!"
- Dashboard visible on screen within 45 seconds of boot
- No error messages in journalctl
- Chromium process visible in `ps aux`

---

**For detailed troubleshooting, see:** [PI-TROUBLESHOOTING.md](PI-TROUBLESHOOTING.md)

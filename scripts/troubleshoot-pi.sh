#!/bin/bash
# Meticulous Display - Pi Troubleshooting Script
# Run as: sudo bash scripts/troubleshoot-pi.sh

set -e

echo "========================================"
echo "Meticulous Display - Troubleshooting"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash scripts/troubleshoot-pi.sh"
  exit 1
fi

ACTUAL_USER=${SUDO_USER:-$USER}
APP_DIR="/opt/meticulous-display"

echo "Checking system status for user: $ACTUAL_USER"
echo ""

# 1. Check service statuses
echo "1. Service Status Check:"
echo "------------------------"
echo ""
echo "Node.js Server (meticulous-display.service):"
systemctl status meticulous-display.service --no-pager || true
echo ""
echo "X Server (xserver.service):"
systemctl status xserver.service --no-pager || true
echo ""
echo "Kiosk (meticulous-kiosk.service):"
systemctl status meticulous-kiosk.service --no-pager || true
echo ""

# 2. Check if services are enabled
echo "2. Service Enablement Check:"
echo "----------------------------"
systemctl is-enabled meticulous-display.service && echo "✓ meticulous-display.service is enabled" || echo "✗ meticulous-display.service is NOT enabled"
systemctl is-enabled xserver.service && echo "✓ xserver.service is enabled" || echo "✗ xserver.service is NOT enabled"
systemctl is-enabled meticulous-kiosk.service && echo "✓ meticulous-kiosk.service is enabled" || echo "✗ meticulous-kiosk.service is NOT enabled"
echo ""

# 3. Check if X server is running
echo "3. X Server Process Check:"
echo "--------------------------"
if ps aux | grep -v grep | grep "/usr/bin/X" > /dev/null; then
  echo "✓ X server process is running"
  ps aux | grep -v grep | grep "/usr/bin/X"
else
  echo "✗ X server process is NOT running"
fi
echo ""

# 4. Check if Chromium is running
echo "4. Chromium Process Check:"
echo "--------------------------"
if ps aux | grep -v grep | grep chromium > /dev/null; then
  echo "✓ Chromium process is running"
  ps aux | grep -v grep | grep chromium | head -3
else
  echo "✗ Chromium process is NOT running"
fi
echo ""

# 5. Check Node.js app
echo "5. Node.js App Check:"
echo "---------------------"
if ps aux | grep -v grep | grep "node dist/server/index.js" > /dev/null; then
  echo "✓ Node.js app is running"
else
  echo "✗ Node.js app is NOT running"
fi
echo ""

# 6. Check recent logs
echo "6. Recent Service Logs:"
echo "-----------------------"
echo ""
echo "meticulous-display.service (last 10 lines):"
journalctl -u meticulous-display.service -n 10 --no-pager || true
echo ""
echo "xserver.service (last 10 lines):"
journalctl -u xserver.service -n 10 --no-pager || true
echo ""
echo "meticulous-kiosk.service (last 10 lines):"
journalctl -u meticulous-kiosk.service -n 10 --no-pager || true
echo ""

# 7. Check configuration
echo "7. Configuration Check:"
echo "-----------------------"
if [ -f "$APP_DIR/config/local.json" ]; then
  echo "✓ local.json exists"
  echo "Contents:"
  cat "$APP_DIR/config/local.json"
else
  echo "✗ local.json does NOT exist"
  echo "  Create it from: $APP_DIR/config/local.json.example"
fi
echo ""

# 8. Check if app is built
echo "8. Build Check:"
echo "---------------"
if [ -f "$APP_DIR/dist/server/index.js" ]; then
  echo "✓ Server build exists"
else
  echo "✗ Server build does NOT exist"
  echo "  Run: cd $APP_DIR && npm run build"
fi
if [ -f "$APP_DIR/dist/client/index.html" ]; then
  echo "✓ Client build exists"
else
  echo "✗ Client build does NOT exist"
  echo "  Run: cd $APP_DIR && npm run build"
fi
echo ""

# 9. Network connectivity check
echo "9. Network Check:"
echo "-----------------"
if [ -f "$APP_DIR/config/local.json" ]; then
  MACHINE_HOST=$(grep -o '"host"[[:space:]]*:[[:space:]]*"[^"]*"' "$APP_DIR/config/local.json" | cut -d'"' -f4)
  if [ -n "$MACHINE_HOST" ]; then
    echo "Testing connection to machine at $MACHINE_HOST..."
    if ping -c 1 -W 2 "$MACHINE_HOST" > /dev/null 2>&1; then
      echo "✓ Can ping machine"
    else
      echo "✗ Cannot ping machine"
    fi
  fi
fi
echo ""

# 10. Display environment check
echo "10. Display Environment Check:"
echo "------------------------------"
echo "DISPLAY variable for $ACTUAL_USER:"
sudo -u $ACTUAL_USER env | grep DISPLAY || echo "✗ DISPLAY not set"
echo ""
echo "X authority file:"
ls -la /home/$ACTUAL_USER/.Xauthority 2>/dev/null && echo "✓ .Xauthority exists" || echo "✗ .Xauthority does NOT exist"
echo ""

# 11. Chromium check
echo "11. Chromium Installation Check:"
echo "--------------------------------"
if command -v chromium &> /dev/null; then
  echo "✓ chromium command found: $(which chromium)"
elif command -v chromium-browser &> /dev/null; then
  echo "✓ chromium-browser command found: $(which chromium-browser)"
else
  echo "✗ Chromium NOT found"
  echo "  Install: sudo apt-get install -y chromium"
fi
echo ""

echo "========================================"
echo "Troubleshooting Complete"
echo "========================================"
echo ""
echo "Common Solutions:"
echo "----------------"
echo ""
echo "If X server is not running:"
echo "  sudo systemctl start xserver.service"
echo "  sudo systemctl status xserver.service"
echo ""
echo "If Node.js app is not running:"
echo "  sudo systemctl start meticulous-display.service"
echo "  sudo systemctl status meticulous-display.service"
echo ""
echo "If kiosk is not running:"
echo "  sudo systemctl start meticulous-kiosk.service"
echo "  sudo systemctl status meticulous-kiosk.service"
echo ""
echo "To restart all services:"
echo "  sudo systemctl restart meticulous-display.service"
echo "  sudo systemctl restart xserver.service"
echo "  sudo systemctl restart meticulous-kiosk.service"
echo ""
echo "To view live logs:"
echo "  journalctl -u xserver.service -f"
echo "  journalctl -u meticulous-kiosk.service -f"
echo ""
echo "To manually test X server and Chromium:"
echo "  1. Switch to tty1 (Ctrl+Alt+F1)"
echo "  2. Login as $ACTUAL_USER"
echo "  3. Run: DISPLAY=:0 chromium --kiosk http://localhost:3002"
echo ""

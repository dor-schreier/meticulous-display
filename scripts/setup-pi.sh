#!/bin/bash
# Meticulous Display - Raspberry Pi Setup Script (Robust Kiosk Boot)
# Run as: sudo bash scripts/setup-pi.sh
#
# Goal:
# - After clean install, the Pi ALWAYS boots into kiosk mode (even after hard reboot)
# - Single source of truth for X startup (no .bash_profile startx, no separate xserver.service)
# - systemd manages:
#     1) meticulous-display.service (Node server)
#     2) meticulous-kiosk.service (X + Chromium via xinit)

set -euo pipefail

echo "========================================"
echo "Meticulous Display - Pi Setup (Kiosk)"
echo "========================================"
echo ""

# Check if running as root
if [ "${EUID}" -ne 0 ]; then
  echo "Please run as root: sudo bash scripts/setup-pi.sh"
  exit 1
fi

# Get the actual user (not root)
ACTUAL_USER="${SUDO_USER:-$USER}"
ACTUAL_HOME="$(getent passwd "$ACTUAL_USER" | cut -d: -f6)"

if [ -z "${ACTUAL_USER}" ] || [ -z "${ACTUAL_HOME}" ]; then
  echo "Failed to determine ACTUAL_USER / ACTUAL_HOME"
  exit 1
fi

echo "Setting up for user: $ACTUAL_USER"
echo "Home directory: $ACTUAL_HOME"
echo ""

# ----------------------------
# 1) Update system
# ----------------------------
echo "1. Updating system packages..."
apt-get update
apt-get upgrade -y

# Utilities we rely on
echo "1.1 Installing base utilities..."
apt-get install -y ca-certificates curl gnupg

# ----------------------------
# 2) Install Node.js 20 (if not installed)
# ----------------------------
echo "2. Installing Node.js..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "Node.js version: $(node --version)"

# ----------------------------
# 3) Build dependencies for native modules (e.g. better-sqlite3)
# ----------------------------
echo "3. Installing build dependencies..."
apt-get install -y build-essential python3

# ----------------------------
# 4) Install Chromium
# ----------------------------
echo "4. Installing Chromium..."
apt-get install -y chromium 2>/dev/null || apt-get install -y chromium-browser

# ----------------------------
# 5) Install X server components for kiosk (xinit is key)
# ----------------------------
echo "5. Installing X server components..."
apt-get install -y xserver-xorg x11-xserver-utils xinit unclutter

# ----------------------------
# 6) Create app directory
# ----------------------------
APP_DIR="/opt/meticulous-display"
echo "6. Creating app directory at $APP_DIR..."
mkdir -p "$APP_DIR"
chown -R "$ACTUAL_USER:$ACTUAL_USER" "$APP_DIR"

# ----------------------------
# 7) Copy app + install deps + build (if script is run from repo root)
# ----------------------------
if [ -f "package.json" ]; then
  echo "7. Copying app files..."
  # copy contents of current dir into APP_DIR (including scripts/)
  # trailing /. ensures we copy contents not the parent folder name
  cp -r ./. "$APP_DIR/"
  chown -R "$ACTUAL_USER:$ACTUAL_USER" "$APP_DIR"

  echo "8. Installing npm dependencies..."
  cd "$APP_DIR"
  sudo -u "$ACTUAL_USER" npm install

  echo "9. Building the app..."
  sudo -u "$ACTUAL_USER" npm run build
else
  echo "NOTE: package.json not found in current directory."
  echo "      Skipping app copy/install/build."
  echo "      Ensure you run this script from the project root."
fi

# Data directory
mkdir -p "$APP_DIR/data"
chown -R "$ACTUAL_USER:$ACTUAL_USER" "$APP_DIR/data"

# ----------------------------
# 10) Create systemd service for Node server
# ----------------------------
echo "10. Creating systemd service for Meticulous Display server..."
cat > /etc/systemd/system/meticulous-display.service << EOF
[Unit]
Description=Meticulous Display Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$ACTUAL_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

# ----------------------------
# 11) Add user to video/input groups (common for kiosk/X access)
# ----------------------------
echo "11. Adding user to video and input groups..."
usermod -a -G video,input "$ACTUAL_USER"

# ----------------------------
# 12) Disable any display manager / GUI that might steal :0
#     and set default boot to console for appliance-like kiosk behavior
# ----------------------------
echo "12. Disabling display managers (if present) and setting console boot target..."
systemctl disable --now lightdm 2>/dev/null || true
systemctl disable --now gdm 2>/dev/null || true
systemctl disable --now sddm 2>/dev/null || true

# Boot to console; kiosk service will start X itself via xinit
systemctl set-default multi-user.target

# ----------------------------
# 13) Create kiosk session script (runs inside X via xinit)
# ----------------------------
echo "13. Creating kiosk session script..."
mkdir -p "$APP_DIR/scripts"
cat > "$APP_DIR/scripts/kiosk-session.sh" << 'EOF'
#!/bin/bash
set -euo pipefail

# Basic X session hardening
xset s off || true
xset s noblank || true
xset -dpms || true

# Hide cursor
unclutter -idle 0.5 -root &

# Wait for the app server to respond (avoid blank kiosk)
until curl -fsS http://127.0.0.1:3002 >/dev/null 2>&1; do
  echo "Waiting for Meticulous server on http://127.0.0.1:3002 ..."
  sleep 1
done

# Detect chromium command
if command -v chromium &>/dev/null; then
  CHROMIUM_CMD="chromium"
elif command -v chromium-browser &>/dev/null; then
  CHROMIUM_CMD="chromium-browser"
else
  echo "Chromium not found!"
  exit 1
fi

exec $CHROMIUM_CMD \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --no-first-run \
  --start-fullscreen \
  --window-position=0,0 \
  --window-size=1024,600 \
  --disable-translate \
  --disable-features=TranslateUI \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --disable-dev-shm-usage \
  --no-sandbox \
  http://127.0.0.1:3002
EOF

chmod +x "$APP_DIR/scripts/kiosk-session.sh"
chown -R "$ACTUAL_USER:$ACTUAL_USER" "$APP_DIR/scripts"

# ----------------------------
# 14) Create ONE kiosk systemd service (X + Chromium via xinit)
#     No separate xserver.service, no .bash_profile startx
# ----------------------------
echo "14. Creating kiosk systemd service (xinit)..."
cat > /etc/systemd/system/meticulous-kiosk.service << EOF
[Unit]
Description=Meticulous Kiosk (X + Chromium)
After=network-online.target meticulous-display.service
Wants=network-online.target meticulous-display.service

[Service]
User=$ACTUAL_USER
Environment=HOME=$ACTUAL_HOME
WorkingDirectory=$ACTUAL_HOME

# Start Xorg on :0 and run kiosk-session.sh inside it.
# vt7 is typical; if you prefer vt1, change vt7->vt1.
ExecStart=/usr/bin/xinit $APP_DIR/scripts/kiosk-session.sh -- :0 vt7 -nolisten tcp -nocursor

Restart=always
RestartSec=2
TimeoutStopSec=5
KillMode=process

[Install]
WantedBy=multi-user.target
EOF

# ----------------------------
# 15) Remove/disable old conflicting services if they exist
# ----------------------------
echo "15. Disabling any previous conflicting X services (if present)..."
systemctl disable --now xserver.service 2>/dev/null || true
rm -f /etc/systemd/system/xserver.service 2>/dev/null || true

# Also remove the tty1 autologin drop-in if you previously created it (optional)
rm -f /etc/systemd/system/getty@tty1.service.d/autologin.conf 2>/dev/null || true
rmdir /etc/systemd/system/getty@tty1.service.d 2>/dev/null || true

# ----------------------------
# 16) Enable services
# ----------------------------
echo "16. Enabling services..."
systemctl daemon-reload
systemctl enable meticulous-display.service
systemctl enable meticulous-kiosk.service

# ----------------------------
# 17) Pi optimizations (optional)
# ----------------------------
echo "17. Applying Pi optimizations..."
# Reduce GPU memory (tweak if you see rendering issues)
if [ -f /boot/config.txt ] && ! grep -q "^gpu_mem=64" /boot/config.txt; then
  echo "gpu_mem=64" >> /boot/config.txt
fi

# Disable unnecessary services (optional)
systemctl disable bluetooth.service 2>/dev/null || true
systemctl disable hciuart.service 2>/dev/null || true

# ----------------------------
# 18) Local config template
# ----------------------------
echo "18. Creating local config template..."
mkdir -p "$APP_DIR/config"
cat > "$APP_DIR/config/local.json.example" << EOF
{
  "machine": {
    "host": "192.168.1.115",
    "port": 8080
  }
}
EOF
chown -R "$ACTUAL_USER:$ACTUAL_USER" "$APP_DIR/config"

echo ""
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Create and edit local config:"
echo "   cp $APP_DIR/config/local.json.example $APP_DIR/config/local.json"
echo "   nano $APP_DIR/config/local.json"
echo ""
echo "2. Start services now (no reboot required):"
echo "   sudo systemctl start meticulous-display"
echo "   sudo systemctl start meticulous-kiosk"
echo ""
echo "3. Check status:"
echo "   sudo systemctl status meticulous-display --no-pager"
echo "   sudo systemctl status meticulous-kiosk --no-pager"
echo ""
echo "4. View logs:"
echo "   journalctl -u meticulous-display -f"
echo "   journalctl -u meticulous-kiosk -f"
echo ""
echo "5. Reboot to verify kiosk auto-start:"
echo "   sudo reboot"
echo ""
echo "Access the dashboard at:"
echo "  Local:   http://localhost:3002"
echo "  Network: http://$(hostname -I | awk '{print $1}'):3002"
echo ""

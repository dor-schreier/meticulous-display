#!/bin/bash
# Meticulous Display - Raspberry Pi Zero 2W Setup Script (Raspbian 13 "trixie")
# Run as: sudo bash scripts/setup-pi.sh
#
# Goals:
# - Kiosk loads reliably after ANY reboot / hard power loss
# - No desktop display manager fighting for :0
# - systemd manages:
#     1) meticulous-display.service (Node server)
#     2) meticulous-kiosk.service (X + Chromium via xinit)
# - Auto-login to console (tty1) so there is NO password prompt on boot

set -euo pipefail

echo "========================================"
echo "Meticulous Display - Pi Setup (Kiosk)"
echo "Pi: Zero 2W | OS: Raspbian 13 (trixie)"
echo "========================================"
echo ""

# Must run as root
if [ "${EUID}" -ne 0 ]; then
  echo "Please run as root: sudo bash scripts/setup-pi.sh"
  exit 1
fi

# Actual user
ACTUAL_USER="${SUDO_USER:-$USER}"
ACTUAL_HOME="$(getent passwd "$ACTUAL_USER" | cut -d: -f6)"

if [ -z "${ACTUAL_USER}" ] || [ -z "${ACTUAL_HOME}" ]; then
  echo "Failed to determine ACTUAL_USER / ACTUAL_HOME"
  exit 1
fi

echo "Setting up for user: $ACTUAL_USER"
echo "Home directory: $ACTUAL_HOME"
echo ""

APP_DIR="/opt/meticulous-display"

# ----------------------------
# 1) Update system + basics
# ----------------------------
echo "1. Updating system packages..."
apt-get update
apt-get upgrade -y

echo "1.1 Installing base utilities..."
apt-get install -y ca-certificates curl gnupg

# ----------------------------
# 2) Install Node.js 20 (if missing)
# ----------------------------
echo "2. Installing Node.js..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "Node.js version: $(node --version)"

# ----------------------------
# 3) Build deps (better-sqlite3 etc.)
# ----------------------------
echo "3. Installing build dependencies..."
apt-get install -y build-essential python3 pkg-config

# ----------------------------
# 4) Chromium
# ----------------------------
echo "4. Installing Chromium..."
apt-get install -y chromium 2>/dev/null || apt-get install -y chromium-browser

# ----------------------------
# 5) X server stack for kiosk
# ----------------------------
echo "5. Installing X server components..."
apt-get install -y xserver-xorg x11-xserver-utils xinit unclutter

# ----------------------------
# 6) Create app directory
# ----------------------------
echo "6. Creating app directory at $APP_DIR..."
mkdir -p "$APP_DIR"
chown -R "$ACTUAL_USER:$ACTUAL_USER" "$APP_DIR"

# ----------------------------
# 7) Copy app + install deps + build (run from repo root)
# ----------------------------
if [ -f "package.json" ]; then
  echo "7. Copying app files..."
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
  echo "      Run this script from the project root."
fi

# Data dir
mkdir -p "$APP_DIR/data"
chown -R "$ACTUAL_USER:$ACTUAL_USER" "$APP_DIR/data"

# ----------------------------
# 10) Node server systemd unit (restart always)
# ----------------------------
echo "10. Creating meticulous-display.service..."
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
# 11) Permissions for X / input
# ----------------------------
echo "11. Adding user to video and input groups..."
usermod -a -G video,input "$ACTUAL_USER"

# ----------------------------
# 12) Disable display managers + boot to console
# ----------------------------
echo "12. Disabling display managers and setting console boot target..."
systemctl disable --now lightdm 2>/dev/null || true
systemctl disable --now gdm 2>/dev/null || true
systemctl disable --now sddm 2>/dev/null || true

systemctl set-default multi-user.target

# ----------------------------
# 13) Enable console auto-login (tty1) so you don't get a password prompt
# ----------------------------
echo "13. Enabling console auto-login on tty1..."
mkdir -p /etc/systemd/system/getty@tty1.service.d/
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $ACTUAL_USER --noclear %I \$TERM
Type=idle
EOF

# ----------------------------
# 14) Kiosk session script (runs inside X via xinit)
#     - waits for server
#     - launches chromium kiosk
# ----------------------------
echo "14. Creating kiosk session script..."
mkdir -p "$APP_DIR/scripts"
cat > "$APP_DIR/scripts/kiosk-session.sh" << 'EOF'
#!/bin/bash
set -euo pipefail

# Prevent blanking/power save
xset s off || true
xset s noblank || true
xset -dpms || true

# Hide cursor
unclutter -idle 0.5 -root &

# Wait for the Node server to respond
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

# A lightweight writable profile dir (helps avoid "crash restore" prompts)
PROFILE_DIR="${HOME}/.config/meticulous-kiosk-chromium"
mkdir -p "$PROFILE_DIR"

exec $CHROMIUM_CMD \
  --user-data-dir="$PROFILE_DIR" \
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
# 15) Safe cleanup: clear stale :0 lock ONLY if no X is running
#     (prevents rare cases after hard power loss)
# ----------------------------
echo "15. Adding safe stale X lock cleanup..."
cat > "$APP_DIR/scripts/cleanup-x-locks.sh" << 'EOF'
#!/bin/bash
set -euo pipefail

# If any X server is running, do nothing
if pgrep -x Xorg >/dev/null 2>&1 || pgrep -x X >/dev/null 2>&1; then
  exit 0
fi

# Remove stale locks/sockets (safe when no X is running)
rm -f /tmp/.X0-lock 2>/dev/null || true
rm -f /tmp/.X11-unix/X0 2>/dev/null || true
EOF
chmod +x "$APP_DIR/scripts/cleanup-x-locks.sh"
chown "$ACTUAL_USER:$ACTUAL_USER" "$APP_DIR/scripts/cleanup-x-locks.sh"

# ----------------------------
# 16) Kiosk systemd unit: xinit starts X + runs kiosk-session.sh
#     Use vt1 so it shows on the main console, and so autologin is consistent.
# ----------------------------
echo "16. Creating meticulous-kiosk.service..."
cat > /etc/systemd/system/meticulous-kiosk.service << EOF
[Unit]
Description=Meticulous Kiosk (X + Chromium)
After=systemd-user-sessions.service network-online.target meticulous-display.service
Wants=network-online.target meticulous-display.service
Conflicts=getty@tty1.service
After=getty@tty1.service

[Service]
Type=simple

# Run kiosk as user
User=met
WorkingDirectory=/home/met

# Let ExecStartPre run as root if needed, then drop to User=met
PermissionsStartOnly=true
ExecStartPre=/opt/meticulous-display/scripts/cleanup-x-locks.sh

# Make Xorg.wrap consider this a "console" session
PAMName=login
TTYPath=/dev/tty1
TTYReset=yes
TTYVHangup=yes
TTYVTDisallocate=yes
StandardInput=tty
StandardOutput=journal
StandardError=journal
UtmpIdentifier=tty1
UtmpMode=user

Environment=HOME=/home/met
Environment=USER=met
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/met/.Xauthority
Environment=XDG_RUNTIME_DIR=/run/user/1000

ExecStart=/usr/bin/xinit /opt/meticulous-display/scripts/kiosk-session.sh -- :0 vt1 -nolisten tcp -nocursor

Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

# ----------------------------
# 17) Remove/disable old conflicting services (if they exist)
# ----------------------------
echo "17. Disabling any previous conflicting X services..."
systemctl disable --now xserver.service 2>/dev/null || true
rm -f /etc/systemd/system/xserver.service 2>/dev/null || true

# Remove .bash_profile startx hack if it exists (prevents double X)
if [ -f "$ACTUAL_HOME/.bash_profile" ]; then
  # Remove the exact block if present
  sed -i '/# Auto-start X on tty1/,+4d' "$ACTUAL_HOME/.bash_profile" 2>/dev/null || true
  chown "$ACTUAL_USER:$ACTUAL_USER" "$ACTUAL_HOME/.bash_profile" || true
fi

# ----------------------------
# 18) Enable services
# ----------------------------
echo "18. Enabling services..."
systemctl daemon-reload
systemctl enable meticulous-display.service
systemctl enable meticulous-kiosk.service

# Ensure getty@tty1 uses the new drop-in
systemctl daemon-reload
systemctl restart getty@tty1.service || true

# ----------------------------
# 19) Pi Zero 2W optimizations (optional)
# ----------------------------
echo "19. Applying Pi optimizations..."
if [ -f /boot/config.txt ] && ! grep -q "^gpu_mem=64" /boot/config.txt; then
  echo "gpu_mem=64" >> /boot/config.txt
fi

systemctl disable bluetooth.service 2>/dev/null || true
systemctl disable hciuart.service 2>/dev/null || true

# ----------------------------
# 20) Local config template
# ----------------------------
echo "20. Creating local config template..."
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
echo "2. Start services now (optional, no reboot required):"
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
echo "5. Reboot to verify kiosk auto-start and autologin:"
echo "   sudo reboot"
echo ""
echo "Access the dashboard at:"
echo "  Local:   http://localhost:3002"
echo "  Network: http://$(hostname -I | awk '{print $1}'):3002"
echo ""

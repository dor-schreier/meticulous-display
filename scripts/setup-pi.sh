#!/bin/bash
# Meticulous Display - Raspberry Pi Setup Script
# Version: 2.0 (with boot fix integrated)
# Run as: sudo bash scripts/setup-pi.sh
#
# This script includes all fixes for:
# - Boot timing issues (kiosk not starting automatically)
# - Service dependencies (strong BindsTo, explicit readiness checks)
# - Systemd targets (graphical.target for GUI services)
# - Network dependencies (network-online.target)
#
# For upgrades, this will preserve your existing config/local.json

set -e

echo "========================================"
echo "Meticulous Display - Pi Setup v2.0"
echo "========================================"
echo "Complete installation with boot fixes"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash scripts/setup-pi.sh"
  exit 1
fi

# Get the actual user (not root)
ACTUAL_USER=${SUDO_USER:-$USER}
ACTUAL_HOME=$(getent passwd "$ACTUAL_USER" | cut -d: -f6)

echo "Setting up for user: $ACTUAL_USER"
echo "Home directory: $ACTUAL_HOME"
echo ""

# Check if this is an upgrade/re-run
APP_DIR="/opt/meticulous-display"
IS_UPGRADE=false
if [ -d "$APP_DIR" ] && [ -f "/etc/systemd/system/meticulous-display.service" ]; then
  IS_UPGRADE=true
  echo "⚠️  Existing installation detected at $APP_DIR"
  echo "This will upgrade/reinstall the services with latest fixes."
  echo ""
  read -p "Continue? (y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Installation cancelled."
    exit 0
  fi
  echo ""
  echo "Stopping existing services..."
  systemctl stop meticulous-kiosk.service 2>/dev/null || true
  systemctl stop xserver.service 2>/dev/null || true
  systemctl stop meticulous-display.service 2>/dev/null || true
  echo ""
fi

# Update system
echo "1. Updating system packages..."
apt-get update
apt-get upgrade -y

# Install Node.js (if not installed)
echo "2. Installing Node.js..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "Node.js version: $(node --version)"

# Install dependencies for better-sqlite3
echo "3. Installing build dependencies..."
apt-get install -y build-essential python3

# Install Chromium for kiosk mode
echo "4. Installing Chromium..."
# Try chromium first (newer OS), fall back to chromium-browser (older OS)
apt-get install -y chromium 2>/dev/null || apt-get install -y chromium-browser

# Install X server and utils for kiosk
echo "5. Installing X server components..."
apt-get install -y xserver-xorg x11-xserver-utils xinit unclutter curl

# Create/verify app directory (already defined above for upgrade detection)
echo "6. Creating app directory at $APP_DIR..."
mkdir -p $APP_DIR
chown -R $ACTUAL_USER:$ACTUAL_USER $APP_DIR

# Copy app files (assuming we're in the project directory)
if [ -f "package.json" ]; then
  echo "7. Copying app files..."

  # Backup existing config if this is an upgrade
  BACKUP_CONFIG=""
  if [ "$IS_UPGRADE" = true ] && [ -f "$APP_DIR/config/local.json" ]; then
    echo "   Backing up existing config..."
    BACKUP_CONFIG=$(cat $APP_DIR/config/local.json)
  fi

  # Copy all files
  cp -r . $APP_DIR/

  # Restore config if we backed it up
  if [ ! -z "$BACKUP_CONFIG" ]; then
    echo "   Restoring existing config..."
    echo "$BACKUP_CONFIG" > $APP_DIR/config/local.json
  fi

  chown -R $ACTUAL_USER:$ACTUAL_USER $APP_DIR

  echo "8. Installing npm dependencies..."
  cd $APP_DIR
  sudo -u $ACTUAL_USER npm install

  echo "9. Building the app..."
  sudo -u $ACTUAL_USER npm run build
fi

# Create data directory
mkdir -p $APP_DIR/data
chown -R $ACTUAL_USER:$ACTUAL_USER $APP_DIR/data

# Create systemd service
echo "10. Creating systemd service..."
cat > /etc/systemd/system/meticulous-display.service << EOF
[Unit]
Description=Meticulous Display Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$ACTUAL_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Add user to video group for X server hardware access
echo "11. Adding user to video, input, and tty groups..."
usermod -a -G video,input,tty $ACTUAL_USER

# Create X server service
echo "12. Creating X server service..."
cat > /etc/systemd/system/xserver.service << EOF
[Unit]
Description=X Server for Meticulous Kiosk
After=multi-user.target systemd-user-sessions.service
Conflicts=getty@tty7.service

[Service]
Type=simple
User=$ACTUAL_USER
WorkingDirectory=$ACTUAL_HOME
Environment=HOME=$ACTUAL_HOME
TTYPath=/dev/tty7
StandardInput=tty
StandardOutput=journal
StandardError=journal
# Use X directly instead of startx wrapper (systemd-compatible)
ExecStart=/usr/bin/X :0 -nocursor -nolisten tcp vt7
Restart=always
RestartSec=5

[Install]
WantedBy=graphical.target
EOF

# Create kiosk service
echo "13. Creating kiosk service..."
cat > /etc/systemd/system/meticulous-kiosk.service << EOF
[Unit]
Description=Meticulous Display Kiosk
After=xserver.service meticulous-display.service
Requires=xserver.service
BindsTo=xserver.service

[Service]
Type=simple
User=$ACTUAL_USER
WorkingDirectory=$ACTUAL_HOME
Environment=DISPLAY=:0
Environment=XAUTHORITY=$ACTUAL_HOME/.Xauthority
Environment=HOME=$ACTUAL_HOME
# Wait for services to be fully active (key fix for boot timing)
ExecStartPre=/bin/bash -c 'timeout 60 bash -c "until systemctl is-active --quiet meticulous-display.service; do sleep 1; done"'
ExecStartPre=/bin/bash -c 'timeout 30 bash -c "until xset -display :0 q &>/dev/null; do sleep 1; done"'
# Additional safety delay
ExecStartPre=/bin/sleep 5
ExecStart=/bin/bash $APP_DIR/scripts/start-kiosk.sh
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=graphical.target
EOF

# Create kiosk start script
echo "14. Creating kiosk start script..."
cat > $APP_DIR/scripts/start-kiosk.sh << 'EOF'
#!/bin/bash

echo "Kiosk start script initiated at $(date)"

# Wait for X server to be ready (with timeout)
MAX_WAIT=30
WAIT_COUNT=0
echo "Waiting for X server..."
until xset q &>/dev/null; do
  if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo "ERROR: X server did not start within ${MAX_WAIT} seconds"
    exit 1
  fi
  echo "X server not ready yet... ($WAIT_COUNT/$MAX_WAIT)"
  sleep 1
  ((WAIT_COUNT++))
done
echo "X server is ready!"

# Configure X settings
echo "Configuring X settings..."
xset s off         # Disable screensaver
xset s noblank     # Don't blank the screen
xset -dpms         # Disable power management

# Start unclutter to hide cursor
if command -v unclutter &> /dev/null; then
  echo "Starting unclutter..."
  unclutter -idle 1 -root &
fi

# Wait for localhost:3002 to be available (Node.js app)
echo "Waiting for Node.js app at localhost:3002..."
MAX_WAIT=60
WAIT_COUNT=0
until curl -s http://localhost:3002 > /dev/null 2>&1; do
  if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
    echo "WARNING: Node.js app not responding after ${MAX_WAIT} seconds, starting Chromium anyway..."
    break
  fi
  echo "Node.js app not ready yet... ($WAIT_COUNT/$MAX_WAIT)"
  sleep 1
  ((WAIT_COUNT++))
done
echo "Node.js app is ready (or timeout reached)!"

# Detect chromium command
if command -v chromium &> /dev/null; then
  CHROMIUM_CMD="chromium"
elif command -v chromium-browser &> /dev/null; then
  CHROMIUM_CMD="chromium-browser"
else
  echo "ERROR: Chromium not found!"
  exit 1
fi
echo "Using Chromium command: $CHROMIUM_CMD"

# Clear any previous Chromium crash flags
rm -rf ~/.config/chromium/Singleton* 2>/dev/null || true
rm -rf ~/.config/chromium-browser/Singleton* 2>/dev/null || true

# Start Chromium in kiosk mode
echo "Starting Chromium in kiosk mode at $(date)..."
$CHROMIUM_CMD \
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
  --incognito \
  --disk-cache-size=1 \
  http://localhost:3002 2>&1 | tee -a /tmp/chromium-kiosk.log
EOF
chmod +x $APP_DIR/scripts/start-kiosk.sh

# Create autologin for kiosk (backup method)
echo "15. Setting up auto-login (backup method)..."
mkdir -p /etc/systemd/system/getty@tty1.service.d/
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $ACTUAL_USER --noclear %I \$TERM
EOF

# Create .xinitrc for X configuration (used by manual startx only)
cat > $ACTUAL_HOME/.xinitrc << EOF
#!/bin/bash

# Allow connections from local processes
xhost +local:

# Set proper X authority
export XAUTHORITY=\$HOME/.Xauthority

# Disable screen blanking
xset s off
xset s noblank
xset -dpms

# Hide cursor
if command -v unclutter &> /dev/null; then
  unclutter -idle 1 -root &
fi

# Wait indefinitely (kiosk service will handle Chromium)
sleep infinity
EOF
chown $ACTUAL_USER:$ACTUAL_USER $ACTUAL_HOME/.xinitrc
chmod +x $ACTUAL_HOME/.xinitrc

# Fix .Xauthority permissions
echo "15. Fixing X authority permissions..."
touch $ACTUAL_HOME/.Xauthority
chown $ACTUAL_USER:$ACTUAL_USER $ACTUAL_HOME/.Xauthority
chmod 600 $ACTUAL_HOME/.Xauthority

# NOTE: We don't add auto-startx to .bash_profile because systemd handles X server now

# Enable services
echo "16. Enabling services..."
systemctl daemon-reload

# Set default target to graphical (CRITICAL for boot startup!)
echo "Setting default systemd target to graphical.target..."
systemctl set-default graphical.target

systemctl enable meticulous-display.service
systemctl enable xserver.service
systemctl enable meticulous-kiosk.service

# Optimize for Pi Zero 2W
echo "17. Applying Pi optimizations..."

# Reduce GPU memory (we don't need much for Chromium 2D)
if ! grep -q "gpu_mem=64" /boot/config.txt; then
  echo "gpu_mem=64" >> /boot/config.txt
fi

# Disable unnecessary services
systemctl disable bluetooth.service 2>/dev/null || true
systemctl disable hciuart.service 2>/dev/null || true

# Enable network-online.target (needed for network-online.target dependency)
echo "Enabling network-online.target..."
systemctl enable systemd-networkd-wait-online.service 2>/dev/null || true

# Create local config template
echo "18. Creating local config template..."
cat > $APP_DIR/config/local.json.example << EOF
{
  "machine": {
    "host": "192.168.1.115",
    "port": 8080
  }
}
EOF

# Verify installation
echo "19. Verifying installation..."
VERIFICATION_PASSED=true

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found"
  VERIFICATION_PASSED=false
else
  echo "✓ Node.js installed: $(node --version)"
fi

# Check if Chromium is installed
if command -v chromium &> /dev/null || command -v chromium-browser &> /dev/null; then
  CHROMIUM_VERSION=$(chromium --version 2>/dev/null || chromium-browser --version 2>/dev/null)
  echo "✓ Chromium installed: $CHROMIUM_VERSION"
else
  echo "❌ Chromium not found"
  VERIFICATION_PASSED=false
fi

# Check if app is built
if [ -f "$APP_DIR/dist/server/index.js" ]; then
  echo "✓ App built successfully"
else
  echo "❌ App build files not found"
  VERIFICATION_PASSED=false
fi

# Check if services are enabled
for service in meticulous-display xserver meticulous-kiosk; do
  if systemctl is-enabled ${service}.service &> /dev/null; then
    echo "✓ ${service}.service enabled"
  else
    echo "⚠ ${service}.service not enabled (this is unexpected)"
  fi
done

# Check default target
DEFAULT_TARGET=$(systemctl get-default)
if [ "$DEFAULT_TARGET" = "graphical.target" ]; then
  echo "✓ Default target set to graphical.target"
else
  echo "⚠ Default target is $DEFAULT_TARGET (expected graphical.target)"
fi

# Check user groups
if groups $ACTUAL_USER | grep -q video && groups $ACTUAL_USER | grep -q input; then
  echo "✓ User $ACTUAL_USER in correct groups (video, input, tty)"
else
  echo "⚠ User $ACTUAL_USER missing some groups"
fi

echo ""
if [ "$VERIFICATION_PASSED" = true ]; then
  echo "========================================"
  echo "✅ Setup Complete - All Checks Passed!"
  echo "========================================"
else
  echo "========================================"
  echo "⚠️  Setup Complete with Warnings"
  echo "========================================"
  echo "Some checks failed. Review the output above."
fi

echo ""
echo "Next steps:"
echo ""
echo "1. Configure your machine IP:"
echo "   cp $APP_DIR/config/local.json.example $APP_DIR/config/local.json"
echo "   nano $APP_DIR/config/local.json"
echo "   (Edit the 'host' value to your Meticulous machine's IP address)"
echo ""
echo "2. IMPORTANT: Reboot to start kiosk mode automatically:"
echo "   sudo reboot"
echo ""
echo "3. After reboot, verify services are running:"
echo "   systemctl status meticulous-display.service"
echo "   systemctl status xserver.service"
echo "   systemctl status meticulous-kiosk.service"
echo ""
echo "4. View logs if needed:"
echo "   journalctl -u meticulous-kiosk.service -b"
echo "   journalctl -u xserver.service -b"
echo ""
echo "5. Access the dashboard from another device:"
echo "   http://$(hostname -I | awk '{print $1}'):3002"
echo ""
echo "Troubleshooting:"
echo "  - If kiosk doesn't start on boot: See KIOSK-BOOT-FIX.md"
echo "  - For general issues: See PI-TROUBLESHOOTING.md"
echo "  - Run diagnostics: sudo bash $APP_DIR/scripts/troubleshoot-pi.sh"
echo ""
echo "This setup includes all fixes for boot timing issues."
echo "Services will start automatically on every boot."
echo ""

#!/bin/bash
# Meticulous Display - Raspberry Pi Setup Script
# Run as: sudo bash scripts/setup-pi.sh

set -e

echo "========================================"
echo "Meticulous Display - Pi Setup"
echo "========================================"
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
apt-get install -y xserver-xorg x11-xserver-utils xinit unclutter

# Create app directory
APP_DIR="/opt/meticulous-display"
echo "6. Creating app directory at $APP_DIR..."
mkdir -p $APP_DIR
chown -R $ACTUAL_USER:$ACTUAL_USER $APP_DIR

# Copy app files (assuming we're in the project directory)
if [ -f "package.json" ]; then
  echo "7. Copying app files..."
  cp -r . $APP_DIR/
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
After=network.target

[Service]
Type=simple
User=$ACTUAL_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node dist/server/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Add user to video group for X server hardware access
echo "11. Adding user to video and input groups..."
usermod -a -G video,input $ACTUAL_USER

# Create X server service
echo "12. Creating X server service..."
cat > /etc/systemd/system/xserver.service << EOF
[Unit]
Description=X Server for Meticulous Kiosk
After=multi-user.target

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
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Create kiosk service
echo "13. Creating kiosk service..."
cat > /etc/systemd/system/meticulous-kiosk.service << EOF
[Unit]
Description=Meticulous Display Kiosk
After=xserver.service meticulous-display.service
Wants=meticulous-display.service
Requires=xserver.service

[Service]
Type=simple
User=$ACTUAL_USER
WorkingDirectory=$ACTUAL_HOME
Environment=DISPLAY=:0
Environment=XAUTHORITY=$ACTUAL_HOME/.Xauthority
Environment=HOME=$ACTUAL_HOME
ExecStartPre=/bin/sleep 10
ExecStart=/bin/bash $APP_DIR/scripts/start-kiosk.sh
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create kiosk start script
echo "14. Creating kiosk start script..."
cat > $APP_DIR/scripts/start-kiosk.sh << 'EOF'
#!/bin/bash

# Wait for X server to be ready
until xset q &>/dev/null; do
  echo "Waiting for X server..."
  sleep 1
done

echo "X server ready, starting Chromium..."

# Detect chromium command (chromium or chromium-browser)
if command -v chromium &> /dev/null; then
  CHROMIUM_CMD="chromium"
elif command -v chromium-browser &> /dev/null; then
  CHROMIUM_CMD="chromium-browser"
else
  echo "Chromium not found!"
  exit 1
fi

# Start Chromium in kiosk mode
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
  http://localhost:3002
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

# Create .xinitrc for X configuration (used by xserver.service and manual startx)
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
unclutter -idle 1 -root &

# Wait for Chromium to start from systemd service
# This .xinitrc is now only used for manual startx, not kiosk boot
sleep infinity
EOF
chown $ACTUAL_USER:$ACTUAL_USER $ACTUAL_HOME/.xinitrc
chmod +x $ACTUAL_HOME/.xinitrc

# Add startx to .bash_profile
if ! grep -q "startx" $ACTUAL_HOME/.bash_profile 2>/dev/null; then
  cat >> $ACTUAL_HOME/.bash_profile << 'EOF'
# Auto-start X on tty1
if [ -z "$DISPLAY" ] && [ "$XDG_VTNR" = 1 ]; then
  exec startx
fi
EOF
  chown $ACTUAL_USER:$ACTUAL_USER $ACTUAL_HOME/.bash_profile
fi

# Enable services
echo "15. Enabling services..."
systemctl daemon-reload
systemctl enable meticulous-display.service
systemctl enable xserver.service
systemctl enable meticulous-kiosk.service

# Optimize for Pi Zero 2W
echo "16. Applying Pi optimizations..."

# Reduce GPU memory (we don't need much for Chromium 2D)
if ! grep -q "gpu_mem=64" /boot/config.txt; then
  echo "gpu_mem=64" >> /boot/config.txt
fi

# Disable unnecessary services
systemctl disable bluetooth.service 2>/dev/null || true
systemctl disable hciuart.service 2>/dev/null || true

# Create local config template
echo "17. Creating local config template..."
cat > $APP_DIR/config/local.json.example << EOF
{
  "machine": {
    "host": "192.168.1.115",
    "port": 8080
  }
}
EOF

echo ""
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Edit the machine IP in: $APP_DIR/config/local.json"
echo "   cp $APP_DIR/config/local.json.example $APP_DIR/config/local.json"
echo "   nano $APP_DIR/config/local.json"
echo ""
echo "2. Start the service:"
echo "   sudo systemctl start meticulous-display"
echo ""
echo "3. Check status:"
echo "   sudo systemctl status meticulous-display"
echo ""
echo "4. View logs:"
echo "   journalctl -u meticulous-display -f"
echo ""
echo "5. Reboot to start kiosk mode:"
echo "   sudo reboot"
echo ""
echo "Access the dashboard at:"
echo "  Local: http://localhost:3002"
echo "  Network: http://$(hostname -I | awk '{print $1}'):3002"
echo ""

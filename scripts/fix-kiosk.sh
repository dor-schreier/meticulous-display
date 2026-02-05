#!/bin/bash
# Meticulous Display - Fix Kiosk Mode Script
# Run this if you're seeing a blank screen with blinking cursor
# Run as: sudo bash scripts/fix-kiosk.sh

set -e

echo "========================================"
echo "Meticulous Display - Kiosk Fix"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash scripts/fix-kiosk.sh"
  exit 1
fi

ACTUAL_USER=${SUDO_USER:-$USER}
ACTUAL_HOME=$(getent passwd "$ACTUAL_USER" | cut -d: -f6)
APP_DIR="/opt/meticulous-display"

echo "Fixing kiosk configuration for user: $ACTUAL_USER"
echo "Home directory: $ACTUAL_HOME"
echo ""

# Stop all services
echo "1. Stopping services..."
systemctl stop meticulous-kiosk.service 2>/dev/null || true
systemctl stop xserver.service 2>/dev/null || true
systemctl stop meticulous-display.service 2>/dev/null || true
sleep 2

# Kill any remaining X or Chromium processes
echo "2. Cleaning up processes..."
pkill -u $ACTUAL_USER chromium 2>/dev/null || true
pkill -u $ACTUAL_USER X 2>/dev/null || true
sleep 2

# Recreate X server service with better configuration
echo "3. Recreating X server service..."
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
ExecStart=/usr/bin/X :0 -nocursor -nolisten tcp vt7
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Recreate kiosk service with better wait logic
echo "4. Recreating kiosk service..."
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
# Wait longer for X server and Node.js app to be fully ready
ExecStartPre=/bin/sleep 15
ExecStart=/bin/bash $APP_DIR/scripts/start-kiosk.sh
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Update kiosk start script with better error handling
echo "5. Updating kiosk start script..."
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

# Fix .Xauthority permissions
echo "6. Fixing X authority permissions..."
touch $ACTUAL_HOME/.Xauthority
chown $ACTUAL_USER:$ACTUAL_USER $ACTUAL_HOME/.Xauthority
chmod 600 $ACTUAL_HOME/.Xauthority

# Update .xinitrc
echo "7. Updating .xinitrc..."
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

# Fix auto-login in .bash_profile
echo "8. Updating .bash_profile..."
# Remove old startx logic if present
sed -i '/Auto-start X on tty1/,/exec startx/d' $ACTUAL_HOME/.bash_profile 2>/dev/null || true

# Don't add auto-startx since systemd handles it now
chown $ACTUAL_USER:$ACTUAL_USER $ACTUAL_HOME/.bash_profile 2>/dev/null || true

# Ensure user is in correct groups
echo "9. Adding user to required groups..."
usermod -a -G video,input,tty $ACTUAL_USER

# Reload systemd
echo "10. Reloading systemd..."
systemctl daemon-reload

# Enable services
echo "11. Enabling services..."
systemctl enable meticulous-display.service
systemctl enable xserver.service
systemctl enable meticulous-kiosk.service

# Start services
echo "12. Starting services..."
echo "Starting meticulous-display..."
systemctl start meticulous-display.service
sleep 3

echo "Starting xserver..."
systemctl start xserver.service
sleep 5

echo "Starting meticulous-kiosk..."
systemctl start meticulous-kiosk.service
sleep 3

# Check status
echo ""
echo "13. Checking service status..."
echo ""
echo "Node.js Server:"
systemctl status meticulous-display.service --no-pager | head -10
echo ""
echo "X Server:"
systemctl status xserver.service --no-pager | head -10
echo ""
echo "Kiosk:"
systemctl status meticulous-kiosk.service --no-pager | head -10
echo ""

echo "========================================"
echo "Fix Complete!"
echo "========================================"
echo ""
echo "What was fixed:"
echo "1. Recreated X server service with proper configuration"
echo "2. Recreated kiosk service with longer startup delays"
echo "3. Updated kiosk script with better error handling and logging"
echo "4. Fixed .Xauthority permissions"
echo "5. Updated .xinitrc for manual X sessions"
echo "6. Removed conflicting auto-startx logic"
echo "7. Added user to required groups"
echo ""
echo "Next steps:"
echo ""
echo "1. Check if services are running:"
echo "   sudo systemctl status xserver.service"
echo "   sudo systemctl status meticulous-kiosk.service"
echo ""
echo "2. View logs in real-time:"
echo "   journalctl -u meticulous-kiosk.service -f"
echo ""
echo "3. If still not working, check the troubleshooting output:"
echo "   sudo bash scripts/troubleshoot-pi.sh"
echo ""
echo "4. Check Chromium log:"
echo "   tail -f /tmp/chromium-kiosk.log"
echo ""
echo "5. If issues persist, try rebooting:"
echo "   sudo reboot"
echo ""
echo "You should see the dashboard on the screen within 30 seconds."
echo "If you still see a blank screen, the logs will show what's wrong."
echo ""

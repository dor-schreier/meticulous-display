#!/bin/bash
# Fix kiosk service not starting on boot
# This script improves service dependencies and timing

set -e

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash scripts/fix-kiosk-boot.sh"
  exit 1
fi

ACTUAL_USER=${SUDO_USER:-$USER}
ACTUAL_HOME=$(getent passwd "$ACTUAL_USER" | cut -d: -f6)
APP_DIR="/opt/meticulous-display"

echo "========================================"
echo "Fixing Kiosk Boot Issue"
echo "========================================"
echo ""

# Stop all services first
echo "1. Stopping all services..."
systemctl stop meticulous-kiosk.service 2>/dev/null || true
systemctl stop xserver.service 2>/dev/null || true
systemctl stop meticulous-display.service 2>/dev/null || true

# Kill any remaining X processes
killall X 2>/dev/null || true
killall chromium 2>/dev/null || true
killall chromium-browser 2>/dev/null || true

echo "2. Recreating improved systemd services..."

# Backend service (unchanged, but ensuring it's correct)
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

# X server service (improved)
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
ExecStart=/usr/bin/X :0 -nocursor -nolisten tcp vt7
Restart=always
RestartSec=5

[Install]
WantedBy=graphical.target
EOF

# Kiosk service (improved with stronger dependencies)
cat > /etc/systemd/system/meticulous-kiosk.service << EOF
[Unit]
Description=Meticulous Display Kiosk
# Strong dependencies - don't start until both are FULLY started
After=xserver.service meticulous-display.service
Requires=xserver.service
BindsTo=xserver.service
# Wait for both services to be actually active
After=xserver.service meticulous-display.service

[Service]
Type=simple
User=$ACTUAL_USER
WorkingDirectory=$ACTUAL_HOME
Environment=DISPLAY=:0
Environment=XAUTHORITY=$ACTUAL_HOME/.Xauthority
Environment=HOME=$ACTUAL_HOME
# Longer initial delay for boot (not needed for manual start)
ExecStartPre=/bin/sleep 20
ExecStart=/bin/bash $APP_DIR/scripts/start-kiosk.sh
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
# Ensure services are ready before starting
# This is the key fix - we explicitly check readiness
ExecStartPre=/bin/bash -c 'timeout 60 bash -c "until systemctl is-active --quiet meticulous-display.service; do sleep 1; done"'
ExecStartPre=/bin/bash -c 'timeout 30 bash -c "until xset -display :0 q &>/dev/null; do sleep 1; done"'

[Install]
WantedBy=graphical.target
EOF

echo "3. Fixing X authority permissions..."
touch $ACTUAL_HOME/.Xauthority
chown $ACTUAL_USER:$ACTUAL_USER $ACTUAL_HOME/.Xauthority
chmod 600 $ACTUAL_HOME/.Xauthority

echo "4. Ensuring user is in correct groups..."
usermod -a -G video,input,tty $ACTUAL_USER

echo "5. Reloading systemd configuration..."
systemctl daemon-reload

echo "6. Re-enabling services..."
systemctl enable meticulous-display.service
systemctl enable xserver.service
systemctl enable meticulous-kiosk.service

# Set default target to graphical (important!)
echo "7. Setting default target to graphical.target..."
systemctl set-default graphical.target

echo "8. Starting services in correct order..."
systemctl start meticulous-display.service
sleep 3
systemctl start xserver.service
sleep 5
systemctl start meticulous-kiosk.service

echo ""
echo "========================================"
echo "Fix Applied!"
echo "========================================"
echo ""
echo "Checking service status..."
echo ""
echo "Backend service:"
systemctl status meticulous-display.service --no-pager -l | head -10
echo ""
echo "X server service:"
systemctl status xserver.service --no-pager -l | head -10
echo ""
echo "Kiosk service:"
systemctl status meticulous-kiosk.service --no-pager -l | head -10
echo ""
echo "If services are running, test by rebooting:"
echo "  sudo reboot"
echo ""
echo "After reboot, check logs if issue persists:"
echo "  journalctl -u meticulous-kiosk.service -b"
echo "  journalctl -u xserver.service -b"
echo ""

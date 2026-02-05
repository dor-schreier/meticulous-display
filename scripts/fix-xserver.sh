#!/bin/bash
# Fix X server startup issues

set -e

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash scripts/fix-xserver.sh"
  exit 1
fi

ACTUAL_USER=${SUDO_USER:-$USER}
ACTUAL_HOME=$(getent passwd "$ACTUAL_USER" | cut -d: -f6)

echo "========================================"
echo "Fixing X Server Issues"
echo "========================================"
echo ""

echo "1. Stopping all services..."
systemctl stop meticulous-kiosk.service 2>/dev/null || true
systemctl stop xserver.service 2>/dev/null || true
sleep 2

echo "2. Killing any remaining X processes..."
killall X 2>/dev/null || true
killall Xorg 2>/dev/null || true
killall chromium 2>/dev/null || true
killall chromium-browser 2>/dev/null || true
sleep 1

echo "3. Cleaning up X server files..."
rm -f /tmp/.X0-lock 2>/dev/null || true
rm -f /tmp/.X11-unix/X0 2>/dev/null || true

echo "4. Fixing X authority file..."
rm -f $ACTUAL_HOME/.Xauthority
touch $ACTUAL_HOME/.Xauthority
chown $ACTUAL_USER:$ACTUAL_USER $ACTUAL_HOME/.Xauthority
chmod 600 $ACTUAL_HOME/.Xauthority

echo "5. Checking user groups..."
if ! groups $ACTUAL_USER | grep -q video; then
    echo "   Adding $ACTUAL_USER to video group..."
    usermod -a -G video $ACTUAL_USER
fi
if ! groups $ACTUAL_USER | grep -q input; then
    echo "   Adding $ACTUAL_USER to input group..."
    usermod -a -G input $ACTUAL_USER
fi
if ! groups $ACTUAL_USER | grep -q tty; then
    echo "   Adding $ACTUAL_USER to tty group..."
    usermod -a -G tty $ACTUAL_USER
fi

echo "6. Creating improved X server service..."
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
# Remove old lock files before starting
ExecStartPre=/bin/sh -c 'rm -f /tmp/.X0-lock /tmp/.X11-unix/X0 2>/dev/null || true'
# Start X server
ExecStart=/usr/bin/X :0 -nolisten tcp vt7
# Clean up on stop
ExecStopPost=/bin/sh -c 'rm -f /tmp/.X0-lock /tmp/.X11-unix/X0 2>/dev/null || true'
Restart=always
RestartSec=5
# Prevent infinite restart loop
StartLimitBurst=5
StartLimitIntervalSec=60

[Install]
WantedBy=graphical.target
EOF

echo "7. Reloading systemd..."
systemctl daemon-reload

echo "8. Starting X server..."
systemctl start xserver.service
sleep 3

echo "9. Checking X server status..."
if systemctl is-active --quiet xserver.service; then
    echo "✓ X server is running"

    # Test if X is actually responding
    if sudo -u $ACTUAL_USER DISPLAY=:0 xset q &>/dev/null; then
        echo "✓ X server is responding to connections"
    else
        echo "⚠ X server is running but not responding yet (may need more time)"
    fi
else
    echo "❌ X server failed to start"
    echo ""
    echo "Recent logs:"
    journalctl -u xserver.service -n 20 --no-pager
    exit 1
fi

echo ""
echo "========================================"
echo "X Server Fix Complete!"
echo "========================================"
echo ""
echo "Next: Start the kiosk service"
echo "  sudo systemctl start meticulous-kiosk.service"
echo ""
echo "Or reboot to test auto-start:"
echo "  sudo reboot"
echo ""

#!/bin/bash
# Aggressive X server fix - removes all X-related processes and files

set -e

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash scripts/force-fix-xserver.sh"
  exit 1
fi

ACTUAL_USER=${SUDO_USER:-$USER}
ACTUAL_HOME=$(getent passwd "$ACTUAL_USER" | cut -d: -f6)

echo "========================================"
echo "Force X Server Fix"
echo "========================================"
echo ""

echo "1. Stopping all services forcefully..."
systemctl stop meticulous-kiosk.service 2>/dev/null || true
systemctl stop xserver.service 2>/dev/null || true
sleep 2

echo "2. Killing ALL X-related processes..."
# Kill everything that might be holding X
pkill -9 X 2>/dev/null || true
pkill -9 Xorg 2>/dev/null || true
pkill -9 chromium 2>/dev/null || true
pkill -9 chromium-browser 2>/dev/null || true
sleep 2

# Check what's holding /dev/tty7
echo "3. Checking for processes on /dev/tty7..."
HOLDER=$(fuser /dev/tty7 2>/dev/null || true)
if [ ! -z "$HOLDER" ]; then
    echo "   Found process(es) holding /dev/tty7: $HOLDER"
    echo "   Killing process(es)..."
    kill -9 $HOLDER 2>/dev/null || true
    sleep 1
fi

echo "4. Removing ALL X-related lock and socket files..."
rm -rf /tmp/.X0-lock 2>/dev/null || true
rm -rf /tmp/.X11-unix/X0 2>/dev/null || true
rm -rf /tmp/.X11-unix 2>/dev/null || true
mkdir -p /tmp/.X11-unix
chmod 1777 /tmp/.X11-unix
chown root:root /tmp/.X11-unix

echo "5. Checking if files were removed..."
if [ -e /tmp/.X0-lock ]; then
    echo "   ⚠ /tmp/.X0-lock still exists, trying harder..."
    lsof /tmp/.X0-lock 2>/dev/null || true
    rm -f /tmp/.X0-lock 2>/dev/null || true
fi

if [ -e /tmp/.X11-unix/X0 ]; then
    echo "   ⚠ /tmp/.X11-unix/X0 still exists, trying harder..."
    lsof /tmp/.X11-unix/X0 2>/dev/null || true
    rm -f /tmp/.X11-unix/X0 2>/dev/null || true
fi

echo "6. Verifying cleanup..."
if [ -e /tmp/.X0-lock ] || [ -e /tmp/.X11-unix/X0 ]; then
    echo "   ❌ Failed to remove lock files"
    echo "   Listing what's there:"
    ls -la /tmp/.X0-lock 2>/dev/null || true
    ls -la /tmp/.X11-unix/X0 2>/dev/null || true
    echo ""
    echo "   This might require a reboot to clear. Try:"
    echo "   sudo reboot"
    exit 1
else
    echo "   ✓ Lock files removed successfully"
fi

echo "7. Fixing X authority and permissions..."
rm -f $ACTUAL_HOME/.Xauthority
touch $ACTUAL_HOME/.Xauthority
chown $ACTUAL_USER:$ACTUAL_USER $ACTUAL_HOME/.Xauthority
chmod 600 $ACTUAL_HOME/.Xauthority

# Ensure user is in video group
if ! groups $ACTUAL_USER | grep -q video; then
    echo "   Adding $ACTUAL_USER to video group..."
    usermod -a -G video $ACTUAL_USER
fi

echo "8. Testing manual X start..."
echo "   Attempting to start X manually as $ACTUAL_USER..."

# Try to start X in background
sudo -u $ACTUAL_USER /usr/bin/X :0 -nolisten tcp vt7 &
X_PID=$!
sleep 3

# Check if X is running
if ps -p $X_PID > /dev/null; then
    echo "   ✓ X server started successfully (PID: $X_PID)"

    # Test connection
    if sudo -u $ACTUAL_USER DISPLAY=:0 xset q &>/dev/null; then
        echo "   ✓ X server is accepting connections"
    else
        echo "   ⚠ X server running but not accepting connections yet"
    fi

    # Kill it so we can let systemd manage it
    echo "   Stopping manual X instance..."
    kill $X_PID 2>/dev/null || true
    sleep 2
else
    echo "   ❌ X server failed to start manually"
    echo ""
    echo "   Check Xorg logs:"
    if [ -f $ACTUAL_HOME/.local/share/xorg/Xorg.0.log ]; then
        tail -20 $ACTUAL_HOME/.local/share/xorg/Xorg.0.log
    else
        echo "   No Xorg log found"
    fi
    exit 1
fi

echo "9. Starting X server via systemd..."
systemctl start xserver.service
sleep 3

echo "10. Verifying X server service..."
if systemctl is-active --quiet xserver.service; then
    echo "   ✓ X server service is active"

    # Get restart count
    RESTART_COUNT=$(systemctl show xserver.service -p NRestarts --value)
    echo "   Restart count: $RESTART_COUNT"

    if [ "$RESTART_COUNT" -gt 2 ]; then
        echo "   ⚠ Service restarted $RESTART_COUNT times - still unstable"
    fi
else
    echo "   ❌ X server service failed to start"
    echo ""
    echo "Recent logs:"
    journalctl -u xserver.service -n 20 --no-pager
    exit 1
fi

echo ""
echo "========================================"
echo "✓ X Server Fix Complete!"
echo "========================================"
echo ""
echo "X server should now be stable."
echo ""
echo "Next steps:"
echo "1. Start kiosk service:"
echo "   sudo systemctl start meticulous-kiosk"
echo ""
echo "2. Check status:"
echo "   systemctl status xserver"
echo "   systemctl status meticulous-kiosk"
echo ""
echo "3. If still having issues, a full reboot may help:"
echo "   sudo reboot"
echo ""

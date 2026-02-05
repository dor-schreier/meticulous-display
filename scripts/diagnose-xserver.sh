#!/bin/bash
# Quick X server diagnostic script

echo "========================================"
echo "X Server Diagnostics"
echo "========================================"
echo ""

echo "1. Checking X server status..."
systemctl status xserver.service --no-pager -l

echo ""
echo "2. Checking X server logs (last 50 lines)..."
journalctl -u xserver.service -n 50 --no-pager

echo ""
echo "3. Checking Xorg log file..."
if [ -f ~/.local/share/xorg/Xorg.0.log ]; then
    echo "Last 30 lines of Xorg.0.log:"
    tail -n 30 ~/.local/share/xorg/Xorg.0.log
else
    echo "Xorg.0.log not found at ~/.local/share/xorg/Xorg.0.log"
fi

echo ""
echo "4. Checking if X is actually running..."
ps aux | grep -E "(X |Xorg)" | grep -v grep

echo ""
echo "5. Checking display environment..."
echo "DISPLAY=$DISPLAY"
echo "XAUTHORITY=$XAUTHORITY"

echo ""
echo "6. Testing X connection..."
DISPLAY=:0 xset q 2>&1 | head -5

echo ""
echo "7. Checking video groups..."
groups

echo ""
echo "8. Checking /dev/tty7..."
ls -la /dev/tty7

echo ""
echo "9. Checking for conflicting processes..."
fuser /dev/tty7 2>&1

echo ""
echo "========================================"
echo "Diagnostic Complete"
echo "========================================"

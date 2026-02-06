#!/bin/bash
# Meticulous Display - Raspberry Pi Uninstall Script
# Completely removes the application, services, and system modifications
# Run as: sudo bash scripts/uninstall-pi.sh

set -e

echo "========================================"
echo "Meticulous Display - Pi Uninstall"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash scripts/uninstall-pi.sh"
  exit 1
fi

# Get the actual user (not root)
ACTUAL_USER=${SUDO_USER:-$USER}
ACTUAL_HOME=$(getent passwd "$ACTUAL_USER" | cut -d: -f6)
APP_DIR="/opt/meticulous-display"

echo "Uninstalling for user: $ACTUAL_USER"
echo "Home directory: $ACTUAL_HOME"
echo "App directory: $APP_DIR"
echo ""

# Confirm before proceeding
read -p "This will completely remove Meticulous Display and all its data. Continue? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Uninstall cancelled."
  exit 0
fi
echo ""

# ========================================
# 1. Stop and disable systemd services
# ========================================
echo "1. Stopping and disabling services..."

for SERVICE in meticulous-kiosk.service xserver.service meticulous-display.service; do
  if systemctl list-unit-files "$SERVICE" &>/dev/null; then
    echo "   Stopping $SERVICE..."
    systemctl stop "$SERVICE" 2>/dev/null || true
    systemctl disable "$SERVICE" 2>/dev/null || true
  fi
done

# ========================================
# 2. Kill remaining processes
# ========================================
echo "2. Killing remaining processes..."
pkill -u "$ACTUAL_USER" chromium 2>/dev/null || true
pkill -u "$ACTUAL_USER" chromium-browser 2>/dev/null || true
pkill -u "$ACTUAL_USER" X 2>/dev/null || true
pkill -u "$ACTUAL_USER" unclutter 2>/dev/null || true
sleep 2

# ========================================
# 3. Remove systemd service files
# ========================================
echo "3. Removing systemd service files..."
rm -f /etc/systemd/system/meticulous-display.service
rm -f /etc/systemd/system/xserver.service
rm -f /etc/systemd/system/meticulous-kiosk.service

# Remove autologin override
if [ -f /etc/systemd/system/getty@tty1.service.d/autologin.conf ]; then
  echo "   Removing autologin configuration..."
  rm -f /etc/systemd/system/getty@tty1.service.d/autologin.conf
  rmdir /etc/systemd/system/getty@tty1.service.d 2>/dev/null || true
fi

systemctl daemon-reload
echo "   Services removed."

# ========================================
# 4. Remove user home directory files
# ========================================
echo "4. Cleaning up user home directory..."

if [ -f "$ACTUAL_HOME/.xinitrc" ]; then
  echo "   Removing .xinitrc..."
  rm -f "$ACTUAL_HOME/.xinitrc"
fi

if [ -f "$ACTUAL_HOME/.Xauthority" ]; then
  echo "   Removing .Xauthority..."
  rm -f "$ACTUAL_HOME/.Xauthority"
fi

# Remove auto-startx lines from .bash_profile
if [ -f "$ACTUAL_HOME/.bash_profile" ]; then
  echo "   Cleaning .bash_profile..."
  sed -i '/# Auto-start X on tty1/,/exec startx/d' "$ACTUAL_HOME/.bash_profile" 2>/dev/null || true
  # Remove file if it's now empty (only whitespace)
  if [ ! -s "$ACTUAL_HOME/.bash_profile" ] || ! grep -q '[^[:space:]]' "$ACTUAL_HOME/.bash_profile" 2>/dev/null; then
    rm -f "$ACTUAL_HOME/.bash_profile"
    echo "   Removed empty .bash_profile"
  fi
fi

# ========================================
# 5. Remove application directory
# ========================================
echo "5. Removing application directory..."
if [ -d "$APP_DIR" ]; then
  rm -rf "$APP_DIR"
  echo "   Removed $APP_DIR"
else
  echo "   $APP_DIR not found, skipping."
fi

# ========================================
# 6. Remove temp files
# ========================================
echo "6. Removing temp files..."
rm -f /tmp/chromium-kiosk.log

# ========================================
# 7. Revert /boot/config.txt changes
# ========================================
echo "7. Reverting boot configuration..."
if [ -f /boot/config.txt ] && grep -q "gpu_mem=64" /boot/config.txt; then
  sed -i '/^gpu_mem=64$/d' /boot/config.txt
  echo "   Removed gpu_mem=64 from /boot/config.txt"
fi

# ========================================
# 8. Re-enable previously disabled services
# ========================================
echo "8. Re-enabling bluetooth..."
systemctl enable bluetooth.service 2>/dev/null || true
systemctl enable hciuart.service 2>/dev/null || true

# ========================================
# 9. Optionally remove system packages
# ========================================
echo ""
echo "========================================"
echo "Optional: Remove system packages"
echo "========================================"
echo ""
echo "The following packages were installed by the setup script."
echo "They will NOT be removed automatically in case other software needs them."
echo ""
echo "To remove display/kiosk packages:"
echo "  sudo apt-get remove --purge -y chromium chromium-browser xserver-xorg x11-xserver-utils xinit unclutter"
echo ""
echo "To remove build tools:"
echo "  sudo apt-get remove --purge -y build-essential"
echo ""
echo "To remove Node.js:"
echo "  sudo apt-get remove --purge -y nodejs"
echo ""
echo "To clean up unused dependencies after removal:"
echo "  sudo apt-get autoremove -y"
echo ""

read -p "Remove display/kiosk packages (chromium, xserver, unclutter)? [y/N] " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "   Removing display packages..."
  apt-get remove --purge -y chromium 2>/dev/null || true
  apt-get remove --purge -y chromium-browser 2>/dev/null || true
  apt-get remove --purge -y xserver-xorg x11-xserver-utils xinit unclutter 2>/dev/null || true
fi

read -p "Remove Node.js? [y/N] " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "   Removing Node.js..."
  apt-get remove --purge -y nodejs 2>/dev/null || true
  # Remove NodeSource repo
  rm -f /etc/apt/sources.list.d/nodesource.list
  rm -f /usr/share/keyrings/nodesource.gpg
fi

read -p "Remove build tools (build-essential, python3)? [y/N] " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "   Removing build tools..."
  apt-get remove --purge -y build-essential 2>/dev/null || true
fi

# Clean up unused dependencies
echo "9. Cleaning up unused dependencies..."
apt-get autoremove -y 2>/dev/null || true

echo ""
echo "========================================"
echo "Uninstall Complete!"
echo "========================================"
echo ""
echo "What was removed:"
echo "  - systemd services (meticulous-display, xserver, meticulous-kiosk)"
echo "  - Autologin configuration"
echo "  - Application directory ($APP_DIR)"
echo "  - User config files (.xinitrc, .Xauthority, .bash_profile startx lines)"
echo "  - Boot config changes (gpu_mem=64)"
echo "  - Temp files (/tmp/chromium-kiosk.log)"
echo "  - Re-enabled bluetooth"
echo ""
echo "A reboot is recommended: sudo reboot"
echo ""

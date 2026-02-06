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
ExecStart=

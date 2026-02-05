# Meticulous Display

Real-time espresso extraction display and shot history viewer for Meticulous espresso machines.

![Screenshot](docs/screenshot.png)

## Features

- **Real-time extraction view** - Live graph showing pressure, flow, weight, and temperature during brewing
- **Shot history** - Browse past shots with mini-graphs and metadata
- **Shot details** - Full graph and statistics for any shot
- **Rating system** - Like/dislike shots for tracking favorites
- **Statistics dashboard** - Track total shots, daily counts, and profile usage
- **Dark mode** - Meticulous-branded dark theme
- **Touch optimized** - Works great on 7" touchscreens
- **Responsive** - Also works on desktop browsers

## Quick Start

### Prerequisites

- Node.js 18+
- Meticulous espresso machine on the same network

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/meticulous-display.git
cd meticulous-display

# Install dependencies
npm install

# Build the app
npm run build

# Configure machine IP
cp config/local.json.example config/local.json
# Edit config/local.json with your machine's IP address

# Start the server
npm start
```

Open http://localhost:3002 in your browser.

### Development

```bash
# Run in development mode with hot reload
npm run dev
```

## Configuration

Create `config/local.json` to override default settings:

```json
{
  "machine": {
    "host": "192.168.1.115",
    "port": 8080
  },
  "server": {
    "port": 3002
  }
}
```

### Environment Variables

- `MACHINE_HOST` - Override machine IP address
- `MACHINE_PORT` - Override machine port
- `SERVER_PORT` - Override server port

## Raspberry Pi Deployment

### Recommended Hardware

- Raspberry Pi Zero 2W
- 7" touchscreen (800x480 or 1024x600)
- MicroSD card (8GB+)

### Automatic Setup (One Command!)

```bash
# Copy the project to your Pi
scp -r . pi@raspberrypi.local:~/meticulous-display/

# SSH into the Pi
ssh pi@raspberrypi.local

# Run the setup script (v2.0 - includes all boot fixes!)
cd ~/meticulous-display
sudo bash scripts/setup-pi.sh
```

**What the setup script does:**

1. ✅ Installs Node.js 20+ and build dependencies
2. ✅ Installs Chromium browser and X server components
3. ✅ Builds the application
4. ✅ Creates three systemd services with **strong dependencies**:
   - `meticulous-display.service` - Node.js backend server
   - `xserver.service` - X Window System for graphics
   - `meticulous-kiosk.service` - Chromium in kiosk mode
5. ✅ Configures **boot-time startup** with readiness checks (fixes timing issues!)
6. ✅ Sets systemd target to `graphical.target` (required for GUI)
7. ✅ Fixes permissions and X server authentication
8. ✅ Optimizes for Pi Zero 2W (GPU memory, disabled Bluetooth)
9. ✅ Verifies installation with comprehensive checks

**Upgrade-safe:** If you're upgrading, the script will preserve your existing `config/local.json`.

After setup completes, configure your machine IP and reboot:

```bash
# Create configuration file
cp /opt/meticulous-display/config/local.json.example \
   /opt/meticulous-display/config/local.json

# Edit with your machine's IP address
sudo nano /opt/meticulous-display/config/local.json

# Reboot to start kiosk mode
sudo reboot
```

The dashboard will appear on the screen within 30-45 seconds after boot.

**Note:** Setup v2.0 includes all boot timing fixes. Services will start automatically on every reboot - no additional configuration needed! 🎉

### Manual Service Management

```bash
# Start/stop/restart services
sudo systemctl start meticulous-display
sudo systemctl start xserver
sudo systemctl start meticulous-kiosk

# View logs
journalctl -u meticulous-display -f
journalctl -u meticulous-kiosk -f

# Check status
sudo systemctl status meticulous-display
sudo systemctl status xserver
sudo systemctl status meticulous-kiosk
```

### Troubleshooting

**Kiosk not starting on boot?**

If you installed with an older version of the setup script:
```bash
cd /opt/meticulous-display
git pull
sudo bash scripts/fix-kiosk-boot.sh
sudo reboot
```

**Other issues:**

```bash
# Run the diagnostic script
sudo bash /opt/meticulous-display/scripts/troubleshoot-pi.sh

# Or fix common issues automatically
sudo bash /opt/meticulous-display/scripts/fix-kiosk.sh

# Check logs
journalctl -u meticulous-kiosk -b
tail -f /tmp/chromium-kiosk.log
```

**Documentation:**
- **[KIOSK-BOOT-FIX.md](KIOSK-BOOT-FIX.md)** - Boot timing issue explanation and fix
- **[PI-TROUBLESHOOTING.md](PI-TROUBLESHOOTING.md)** - Comprehensive troubleshooting guide
- **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)** - Common commands cheat sheet
- **[SETUP-PI-CHANGELOG.md](SETUP-PI-CHANGELOG.md)** - What's new in v2.0

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Raspberry Pi / PC                       │
├─────────────────────────────────────────────────────┤
│  Node.js Backend                                    │
│  ├── Express.js (HTTP server)                       │
│  ├── WebSocket (real-time updates)                  │
│  ├── SQLite (history cache)                         │
│  └── @meticulous-home/espresso-api                  │
├─────────────────────────────────────────────────────┤
│  Frontend (Preact + uPlot)                          │
│  ├── Live extraction view                           │
│  ├── History list                                   │
│  ├── Shot detail with graphs                        │
│  └── Statistics dashboard                           │
└─────────────────────────────────────────────────────┘
         │                           │
         ▼                           ▼
   Touchscreen                 Remote Browser
   (Kiosk Mode)               (Phone/Tablet/PC)
```

## API Endpoints

| Endpoint                | Method    | Description            |
| ----------------------- | --------- | ---------------------- |
| `/api/status`           | GET       | Current machine status |
| `/api/history`          | GET       | List shots (paginated) |
| `/api/history/:id`      | GET       | Get shot details       |
| `/api/history/:id/rate` | POST      | Rate a shot            |
| `/api/stats`            | GET       | Statistics             |
| `/api/last-shot`        | GET       | Most recent shot       |
| `/ws`                   | WebSocket | Real-time updates      |

## WebSocket Events

| Event                  | Description                     |
| ---------------------- | ------------------------------- |
| `status`               | Machine state updates           |
| `shot-start`           | Extraction started              |
| `shot-data`            | Real-time extraction data point |
| `shot-end`             | Extraction complete             |
| `machine-connected`    | Connection established          |
| `machine-disconnected` | Connection lost                 |

## Tech Stack

- **Backend**: Node.js, Express, WebSocket (ws), better-sqlite3
- **Frontend**: Preact, htm, uPlot
- **Build**: TypeScript, esbuild
- **Styling**: CSS custom properties, responsive design

## License

MIT

## Credits

Built for use with [Meticulous](https://meticuloushome.com/) espresso machines.
Uses [@meticulous-home/espresso-api](https://github.com/MeticulousHome/meticulous-typescript-api) for machine communication.

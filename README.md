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

### Automatic Setup

```bash
# Copy the project to your Pi
scp -r . pi@raspberrypi.local:~/meticulous-display/

# SSH into the Pi
ssh pi@raspberrypi.local

# Run the setup script
cd ~/meticulous-display
sudo bash scripts/setup-pi.sh
```

The setup script will:

1. Install Node.js 20+ and build dependencies
2. Install Chromium browser and X server components
3. Build the application
4. Create three systemd services:
   - `meticulous-display.service` - Node.js backend server
   - `xserver.service` - X Window System for graphics
   - `meticulous-kiosk.service` - Chromium in kiosk mode
5. Configure proper startup timing and permissions
6. Optimize settings for Pi Zero 2W (GPU memory, disabled services)

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

If you see a blank screen after reboot:

```bash
# Run the diagnostic script
sudo bash scripts/troubleshoot-pi.sh

# Or fix common issues automatically
sudo bash scripts/fix-kiosk.sh

# Check logs
journalctl -u meticulous-kiosk -f
tail -f /tmp/chromium-kiosk.log
```

**Documentation:**
- **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)** - Common commands and quick fixes
- **[PI-TROUBLESHOOTING.md](PI-TROUBLESHOOTING.md)** - Detailed troubleshooting guide
- **[DEPLOYMENT-FIXES.md](DEPLOYMENT-FIXES.md)** - Technical details of recent improvements

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

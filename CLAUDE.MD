# CLAUDE.MD - Meticulous Display

> Documentation for AI assistants working with the Meticulous Display codebase

## Project Overview

**Meticulous Display** is a real-time espresso extraction display and shot history viewer designed specifically for Meticulous espresso machines. It's a full-stack web application that provides:

- Live monitoring of espresso extractions with real-time graphs
- Historical shot analysis and statistics
- Touch-optimized interface for 7" touchscreens
- Responsive design for desktop browsers

**Primary Deployment Target:** Raspberry Pi Zero 2W with 7" touchscreen running in kiosk mode

**Key Use Case:** Monitor espresso machine in real-time, review historical shots, and analyze extraction performance.

## Architecture

### Tech Stack

**Backend:**
- Node.js with TypeScript
- Express.js for HTTP server
- WebSocket (ws library) for real-time communication
- SQLite (better-sqlite3) for shot history caching
- @meticulous-home/espresso-api for machine integration

**Frontend:**
- Preact (lightweight React alternative)
- htm (hyperscript tagged templates - JSX alternative)
- uPlot for lightweight charting
- Vanilla JavaScript (no React/Vue/Angular)
- Custom pub/sub state management

**Build Tools:**
- TypeScript compiler for server code
- esbuild for client bundling
- npm scripts for development workflow

### System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Meticulous Espresso Machine              │
│                  (Network: 192.168.1.115:8080)           │
└────────────────────────┬─────────────────────────────────┘
                         │
                         │ @meticulous-home/espresso-api
                         │
┌────────────────────────▼─────────────────────────────────┐
│              Node.js Backend (Express + WebSocket)        │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ REST API       │  │ WebSocket    │  │ SQLite Cache │ │
│  │ (Static Data)  │  │ (Real-time)  │  │ (History)    │ │
│  └────────────────┘  └──────────────┘  └──────────────┘ │
└────────────────────────┬─────────────────────────────────┘
                         │
                         │ HTTP/WebSocket
                         │
┌────────────────────────▼─────────────────────────────────┐
│         Preact Frontend (SPA with uPlot charts)          │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │
│  │ Live View  │  │ History    │  │ Stats & Settings   │ │
│  └────────────┘  └────────────┘  └────────────────────┘ │
└────────────────────────┬─────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
┌────────▼────────┐           ┌─────────▼──────────┐
│  7" Touchscreen │           │  Remote Browser    │
│  (Kiosk Mode)   │           │  (Phone/Desktop)   │
└─────────────────┘           └────────────────────┘
```

### Data Flow

1. **Machine → Backend:** Meticulous machine streams sensor data via @meticulous-home/espresso-api
2. **Backend → Cache:** Shot data saved to SQLite for persistence
3. **Backend → Frontend:**
   - REST API for static data (history, stats, config)
   - WebSocket for real-time updates (live shot data, status changes)
4. **Frontend → User:** Preact renders UI, uPlot displays charts

## Project Structure

```
meticulous-display/
├── src/
│   ├── server/                      # Backend TypeScript
│   │   ├── index.ts                 # Main entry: Express + WebSocket setup
│   │   ├── config.ts                # 3-tier configuration system
│   │   ├── meticulous-client.ts     # Machine API wrapper & event handling
│   │   ├── cache.ts                 # SQLite database manager
│   │   ├── websocket.ts             # WebSocket server logic
│   │   └── routes/
│   │       └── api.ts               # REST API route handlers
│   │
│   └── client/                      # Frontend JavaScript
│       ├── index.html               # SPA entry point
│       ├── styles/
│       │   └── main.css             # Dark theme styling
│       └── js/
│           ├── app.js               # Main Preact app (583 lines)
│           ├── api/
│           │   └── client.js        # HTTP & WebSocket client
│           ├── components/
│           │   ├── chart.js         # uPlot chart wrapper
│           │   ├── shotHistory.js   # History list component
│           │   ├── shotDetail.js    # Detail view with graph
│           │   ├── stats.js         # Statistics dashboard
│           │   └── settings.js      # Settings panel
│           ├── config/
│           │   └── chartConfig.js   # uPlot configuration
│           ├── state/
│           │   └── store.js         # Pub/sub state management
│           └── utils/
│               ├── formatting.js    # Number/date formatting
│               └── storage.js       # localStorage wrapper
│
├── dist/                            # Build output
│   ├── server/                      # Compiled TypeScript
│   └── client/                      # Bundled JavaScript + HTML
│
├── config/                          # Configuration files
│   ├── default.json                 # Default configuration
│   └── local.json                   # Local overrides (gitignored)
│
├── data/                            # SQLite database location
│   └── shots.db                     # Shot history cache
│
├── scripts/
│   └── setup-pi.sh                  # Raspberry Pi deployment script
│
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # TypeScript configuration
├── esbuild.config.js                # Frontend build configuration
├── README.md                        # User documentation
└── CLAUDE.MD                        # This file (AI assistant docs)
```

## Key Features

### 1. Real-time Extraction View (Live Mode)
- Live graph displaying pressure, flow, weight, temperature during brewing
- Updates every 100ms via WebSocket
- Status indicator (brewing/idle/error)
- Configurable data series visibility

### 2. Shot History
- Paginated list of past shots
- Shows: yield weight, duration, timestamp, rating
- Click to view detailed analysis

### 3. Shot Details View
- Full graph visualization of historical shot
- Detailed statistics: duration, yield, profile name, date
- Like/dislike rating system

### 4. Statistics Dashboard
- Total shots count (all-time)
- Daily and weekly shot counts
- Average extraction duration
- Profile breakdown (most used profiles)
- Rating breakdown (likes/dislikes/unrated)

### 5. Settings Panel
- Data series selector (toggle pressure, flow, weight, temp, etc.)
- Chart configuration options
- Reset to defaults

## API Reference

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Current machine status (state, temperature, etc.) |
| `/api/current-shot` | GET | Current shot data during extraction |
| `/api/device` | GET | Device information (machine model, serial) |
| `/api/history` | GET | Paginated shot history (params: `limit`, `offset`) |
| `/api/history/:id` | GET | Full shot details with graph data |
| `/api/history/:id/rate` | POST | Rate a shot (body: `{ rating: 'like' \| 'dislike' \| null }`) |
| `/api/last-shot` | GET | Most recent shot from cache |
| `/api/stats` | GET | Statistics (local cache + machine stats) |
| `/api/profiles` | GET | Available espresso profiles |
| `/api/data-series` | GET | Available sensor data series configuration |
| `/api/config` | GET/POST | App configuration (display mode, cache settings) |

### WebSocket Events

**Server → Client:**

| Event | Payload | Description |
|-------|---------|-------------|
| `status` | `MachineStatus` | Machine state updates (idle/brewing/error) |
| `shot-start` | `{ shotId, timestamp }` | Extraction started |
| `shot-data` | `{ shotId, data: SensorReading }` | Real-time extraction data point |
| `shot-end` | `{ shotId, summary }` | Extraction complete with summary |
| `machine-connected` | `{}` | Connection to machine established |
| `machine-disconnected` | `{}` | Connection to machine lost |
| `temperatures` | `{ sensors: {...} }` | Temperature sensor updates |

**Client → Server:**
- `ping` / `pong` - Connection keep-alive

## Development Workflow

### Build System

1. **TypeScript Compilation** (Server)
   - Input: `src/server/**/*.ts`
   - Output: `dist/server/**/*.js`
   - Command: `tsc` (configured via tsconfig.json)

2. **esbuild Bundling** (Client)
   - Input: `src/client/js/**/*.js`, `src/client/index.html`
   - Output: `dist/client/bundle.js`, `dist/client/index.html`
   - Command: `npm run build:client`

### Key Commands

```bash
# Development mode (hot reload)
npm run dev

# Production build
npm run build              # Builds both server and client
npm run build:server       # TypeScript only
npm run build:client       # esbuild only

# Run production
npm start

# Clean build artifacts
npm run clean
```

### Configuration System

Three-tier hierarchy (lowest to highest priority):

1. **Default Configuration** (hardcoded in `src/server/config.ts`)
2. **Configuration Files:**
   - `config/default.json` - Base configuration
   - `config/local.json` - Local overrides (gitignored)
   - `/etc/meticulous-display/config.json` - System-wide (Pi deployment)
3. **Environment Variables:**
   - `MACHINE_HOST` - Override machine IP
   - `MACHINE_PORT` - Override machine port (default: 8080)
   - `SERVER_PORT` - Override server port (default: 3002)

**Example `config/local.json`:**
```json
{
  "machine": {
    "host": "192.168.1.115",
    "port": 8080
  },
  "server": {
    "port": 3002,
    "host": "0.0.0.0"
  },
  "cache": {
    "maxShots": 500
  }
}
```

## State Management

### Frontend State (Pub/Sub Pattern)

Located in `src/client/js/state/store.js`

**Store API:**
```javascript
import { store } from './state/store.js'

// Get current state
const shots = store.get('shots')

// Set state (triggers subscribers)
store.set('shots', newShots)

// Subscribe to changes
const unsubscribe = store.subscribe('shots', (newValue) => {
  console.log('Shots updated:', newValue)
})

// Unsubscribe
unsubscribe()
```

**State Keys:**
- `shots` - Shot history array
- `currentShot` - Active extraction data
- `stats` - Statistics object
- `status` - Machine status
- `selectedShot` - Shot ID for detail view
- `settings` - User preferences (visible data series)
- `view` - Current view ('live' | 'history' | 'stats' | 'settings')

### Why No Redux/Zustand?

- **Bundle size:** Custom solution is ~2KB vs Redux ~50KB
- **Simplicity:** No boilerplate, just `get`/`set`/`subscribe`
- **Performance:** Direct state access without selectors/mappers
- **Resource constraints:** Optimized for Raspberry Pi Zero 2W

## Data Model

### Shot Data Structure

```typescript
interface Shot {
  id: string                    // Unique shot identifier
  machineId: string             // Machine serial number
  timestamp: number             // Unix timestamp (ms)
  duration: number              // Shot duration (seconds)
  yield: number                 // Output weight (grams)
  profile: string               // Profile name
  rating: 'like' | 'dislike' | null  // User rating

  // Time-series data (arrays of equal length)
  data: {
    time: number[]              // Timestamps (ms)
    pressure: number[]          // Bar (0-12)
    flow: number[]              // ml/s
    weight: number[]            // g
    temperature: number[]       // °C
    pressureSetpoint: number[]  // Target pressure
    flowSetpoint: number[]      // Target flow
    tempSetpoint: number[]      // Target temperature

    // Extended sensors (optional)
    tempBarUpper?: number[]     // Group head temp
    tempBarLower?: number[]     // Lower group temp
    motorPosition?: number[]    // Motor position
    motorSpeed?: number[]       // Motor speed
    // ... more sensors
  }
}
```

### Machine Status

```typescript
interface MachineStatus {
  state: 'idle' | 'brewing' | 'steaming' | 'error'
  temperature: number           // Current temp (°C)
  targetTemperature: number     // Target temp (°C)
  pressure: number              // Current pressure (bar)
  connected: boolean            // Connection status
}
```

## Frontend Components

### Component Architecture

Built with Preact + htm (no JSX):

```javascript
import { html } from 'htm/preact'
import { h } from 'preact'

// Example component
function MyComponent({ prop1, prop2 }) {
  return html`
    <div class="my-component">
      <h2>${prop1}</h2>
      <p>${prop2}</p>
    </div>
  `
}
```

### Main Components

**App Component** (`src/client/js/app.js`)
- Root component managing view routing
- 583 lines - handles all view switching
- Subscribes to state changes
- Manages WebSocket connection lifecycle

**Chart Component** (`src/client/js/components/chart.js`)
- uPlot wrapper for time-series visualization
- Configurable data series (pressure, flow, weight, temp)
- Responsive sizing for touchscreen and desktop
- Zoom/pan support

**Shot History** (`src/client/js/components/shotHistory.js`)
- Paginated list of historical shots
- Mini-graphs with key metrics
- Click to navigate to detail view

**Shot Detail** (`src/client/js/components/shotDetail.js`)
- Full-size chart with all sensor data
- Statistics summary
- Rating UI (thumbs up/down)

**Statistics** (`src/client/js/components/stats.js`)
- Dashboard cards showing:
  - Total/daily/weekly shot counts
  - Average duration
  - Profile breakdown
  - Rating distribution

**Settings** (`src/client/js/components/settings.js`)
- Data series visibility toggles
- Chart configuration options
- Reset to defaults button

### Responsive Design

**Breakpoints:**
- **Compact mode:** < 800px wide (touchscreen optimized)
- **Desktop mode:** ≥ 800px wide (larger charts, more info)

**Touch Optimizations:**
- Large tap targets (min 44x44px)
- No hover states (touch-first)
- Simplified navigation
- Full-screen chart view

## Common Development Tasks

### Adding a New API Endpoint

1. **Add route handler** in `src/server/routes/api.ts`:
```typescript
router.get('/api/my-endpoint', async (req, res) => {
  try {
    const data = await getMyData()
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
```

2. **Add TypeScript types** if needed (inline or in types file)

3. **Update frontend client** in `src/client/js/api/client.js`:
```javascript
export async function getMyData() {
  const response = await fetch('/api/my-endpoint')
  return response.json()
}
```

### Adding a New UI Component

1. **Create component** in `src/client/js/components/myComponent.js`:
```javascript
import { html } from 'htm/preact'

export function MyComponent({ data }) {
  return html`
    <div class="my-component">
      <h3>My Component</h3>
      <p>${data}</p>
    </div>
  `
}
```

2. **Import and use** in `src/client/js/app.js`:
```javascript
import { MyComponent } from './components/myComponent.js'

// In render method:
html`<${MyComponent} data=${myData} />`
```

3. **Subscribe to state** if needed:
```javascript
import { store } from './state/store.js'

export function MyComponent() {
  const [data, setData] = useState(store.get('myData'))

  useEffect(() => {
    return store.subscribe('myData', setData)
  }, [])

  return html`<div>${data}</div>`
}
```

### Modifying Chart Data Series

1. **Update chart config** in `src/client/js/config/chartConfig.js`:
```javascript
export const dataSeries = [
  { key: 'myNewSeries', label: 'My New Series', color: '#ff0000', unit: 'units' }
]
```

2. **Ensure backend provides data** in correct format:
```typescript
// In src/server/routes/api.ts
const shotData = {
  time: [...],
  pressure: [...],
  myNewSeries: [...]  // Add new data series
}
```

3. **Test with live data** and historical shots

### Debugging WebSocket Issues

**Server-side logging:**
```typescript
// In src/server/websocket.ts
ws.on('message', (data) => {
  console.log('[WS] Received:', data)
})
```

**Client-side logging:**
```javascript
// In src/client/js/api/client.js
this.ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  console.log('[WS] Received:', message.type, message.data)
}
```

**Check connection status:**
- Backend logs: `journalctl -u meticulous-display -f`
- Frontend: Browser console + Network tab (WS connections)

## Deployment Notes

### Raspberry Pi Setup

**Automated Installation** (recommended):
```bash
# Copy project to Pi
scp -r . pi@raspberrypi.local:~/meticulous-display/

# SSH and run setup
ssh pi@raspberrypi.local
cd ~/meticulous-display
sudo bash scripts/setup-pi.sh
```

**What the setup script does:**
1. Installs Node.js 20+ and build dependencies
2. Installs Chromium browser and X server components (including curl, unclutter)
3. Builds the application (`npm install && npm run build`)
4. Creates three systemd services with proper dependencies:
   - `meticulous-display.service` - Node.js backend
   - `xserver.service` - X Window System
   - `meticulous-kiosk.service` - Chromium kiosk with 15s startup delay
5. Creates enhanced startup script with health checks:
   - Waits for X server to be ready (max 30s)
   - Configures X settings (disable screensaver, power management)
   - Waits for Node.js app to respond on localhost:3002 (max 60s)
   - Clears Chromium crash flags
   - Launches Chromium with optimized flags (incognito, disk-cache-size=1)
   - Logs to `/tmp/chromium-kiosk.log`
6. Fixes permissions:
   - Creates `.Xauthority` with correct ownership (600)
   - Adds user to video, input, and tty groups
7. Optimizes Pi Zero 2W settings (GPU memory 64MB, disables Bluetooth)

**Key improvements over basic setup:**
- **Proper timing**: 15-second delay before kiosk starts + health checks
- **Error handling**: Timeouts and error messages in startup script
- **Logging**: Chromium output logged to `/tmp/chromium-kiosk.log`
- **Reliability**: Clears crash flags, uses incognito mode, minimal cache
- **Debuggability**: All services log to journalctl with StandardOutput/Error

**Manual Service Management:**
```bash
# Start/stop/restart
sudo systemctl start meticulous-display
sudo systemctl stop meticulous-display
sudo systemctl restart meticulous-display

# View logs
journalctl -u meticulous-display -f

# Check status
sudo systemctl status meticulous-display
```

### Production Considerations

**Performance:**
- SQLite cache limited to 500 shots (configurable)
- Chart data limited to 5000 points max (configurable)
- Compression middleware for HTTP responses
- WebSocket reconnection with exponential backoff

**Reliability:**
- Auto-reconnect to machine on disconnect
- SQLite persistence survives server restarts
- Graceful degradation when machine offline

**Security:**
- No authentication (trusted local network)
- CORS enabled for development only
- No sensitive data stored

## Important Design Decisions

### Why Preact over React?
- **Bundle size:** Preact ~4KB vs React ~40KB (gzipped)
- **Performance:** Faster rendering on resource-constrained Pi
- **API compatibility:** Nearly identical to React (easy migration if needed)

### Why HTM over JSX?
- **No build step:** Works directly in ES modules
- **Browser compatibility:** No Babel/transpilation needed
- **Tagged templates:** Native ES6 feature
- **Bundle size:** No JSX runtime needed

### Why uPlot over Chart.js?
- **Performance:** Hardware-accelerated canvas rendering
- **Bundle size:** ~45KB vs Chart.js ~250KB
- **Touch support:** Better zoom/pan on touchscreens
- **Data capacity:** Handles 10k+ points smoothly

### Why SQLite over PostgreSQL/MongoDB?
- **Simplicity:** Single file, no server required
- **Performance:** Fast enough for 500 shots
- **Embedded:** Perfect for Raspberry Pi deployment
- **Reliability:** ACID compliance, crash recovery

### Why Custom State Management?
- **Bundle size:** ~2KB vs Redux ~50KB
- **Simplicity:** No boilerplate, no learning curve
- **Performance:** Direct state access (no selectors)
- **Fit for purpose:** Pub/sub pattern perfect for event-driven updates

### Why WebSocket over Server-Sent Events (SSE)?
- **Bi-directional:** Client can send commands (future feature)
- **Binary data:** Support for future optimizations
- **Lower latency:** No HTTP overhead on each message
- **Better tooling:** Easier to debug with browser DevTools

## Troubleshooting

### Common Issues

**Issue:** Machine not connecting
- Check machine IP in `config/local.json`
- Verify machine is on same network
- Test with: `curl http://192.168.1.115:8080/api/status`

**Issue:** WebSocket disconnecting frequently
- Check network stability
- Review reconnection logic in `src/client/js/api/client.js`
- Increase timeout in WebSocket config

**Issue:** Charts not rendering
- Check browser console for errors
- Verify uPlot is loaded (CDN dependency)
- Ensure data format matches chart config

**Issue:** Database locked error
- SQLite doesn't support concurrent writes well
- Check for multiple server instances
- Restart server: `sudo systemctl restart meticulous-display`

**Issue:** Pi shows blank screen with blinking cursor
- This means X server started but Chromium didn't launch
- Run diagnostic: `sudo bash scripts/troubleshoot-pi.sh`
- Auto-fix: `sudo bash scripts/fix-kiosk.sh`
- Check logs: `journalctl -u meticulous-kiosk -f`
- See [PI-TROUBLESHOOTING.md](PI-TROUBLESHOOTING.md) for full guide

**Issue:** Services starting too quickly
- The setup script now includes proper timing delays (15s for kiosk)
- Kiosk script waits for X server (`xset q`) and Node.js app (`curl localhost:3002`)
- If still having issues, increase sleep in `/etc/systemd/system/meticulous-kiosk.service`

**Issue:** Chromium won't start
- Clear crash flags: `rm -rf ~/.config/chromium*/Singleton*`
- Check if installed: `chromium --version` or `chromium-browser --version`
- View Chromium log: `tail -f /tmp/chromium-kiosk.log`
- Restart kiosk: `sudo systemctl restart meticulous-kiosk`

**Issue:** X server permission denied
- Fix authority file: `touch ~/.Xauthority && chmod 600 ~/.Xauthority`
- Check groups: `groups` (should include video, input, tty)
- Add to groups: `sudo usermod -a -G video,input,tty $USER`

## Testing

### Manual Testing Checklist

**Live View:**
- [ ] Real-time chart updates during extraction
- [ ] Status indicator changes correctly
- [ ] Data series toggles work
- [ ] WebSocket reconnects on disconnect

**History View:**
- [ ] Pagination works (next/prev buttons)
- [ ] Shots load correctly
- [ ] Click opens detail view
- [ ] Empty state shows when no shots

**Shot Detail:**
- [ ] Full chart renders with all data
- [ ] Statistics show correct values
- [ ] Rating buttons work (like/dislike)
- [ ] Back button returns to history

**Statistics:**
- [ ] Counts are accurate
- [ ] Profile breakdown matches reality
- [ ] Rating distribution correct

**Settings:**
- [ ] Data series toggles persist
- [ ] Reset to defaults works
- [ ] Changes apply immediately

### API Testing

Use curl or Postman to test endpoints:

```bash
# Get machine status
curl http://localhost:3002/api/status

# Get shot history
curl http://localhost:3002/api/history?limit=10&offset=0

# Get shot details
curl http://localhost:3002/api/history/SHOT_ID

# Rate a shot
curl -X POST http://localhost:3002/api/history/SHOT_ID/rate \
  -H "Content-Type: application/json" \
  -d '{"rating": "like"}'
```

## Contributing Guidelines

When working on this codebase:

1. **Maintain lightweight approach** - Avoid heavy libraries
2. **Test on Pi** - Performance matters on resource-constrained devices
3. **Keep bundle small** - Every KB counts on slow networks
4. **Touch-first** - Design for touchscreen, enhance for desktop
5. **Offline-first** - Handle machine disconnects gracefully
6. **Type safety** - Use TypeScript for server code
7. **Code style** - Follow existing patterns (functional components, pub/sub)

## Resources

- **Meticulous API Docs:** https://github.com/MeticulousHome/meticulous-typescript-api
- **Preact Docs:** https://preactjs.com/
- **uPlot Docs:** https://github.com/leeoniya/uPlot
- **HTM Docs:** https://github.com/developit/htm
- **SQLite Docs:** https://www.sqlite.org/docs.html

---

**Last Updated:** 2026-02-01
**Version:** 1.0.0
**Maintainer:** Dor Schreier

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Meticulous Display is a real-time espresso extraction dashboard and shot history viewer for Meticulous espresso machines. It's designed to run as a kiosk on a Raspberry Pi Zero 2W, displaying live extraction data and maintaining a local cache of shot history.

## Build & Development Commands

```bash
# Development (watch mode with hot reload)
npm run dev

# Build everything (server + client)
npm run build

# Build individual parts
npm run build:server    # TypeScript compilation (tsc)
npm run build:client    # esbuild bundling

# Run production server
npm start

# Database migration (if schema changes)
npm run migrate

# Raspberry Pi deployment
sudo bash scripts/setup-pi.sh
```

## Architecture

### Server (TypeScript - `src/server/`)

- **index.ts**: Express server entry point, initializes all components, sets up middleware and graceful shutdown
- **meticulous-client.ts**: Singleton client connecting to the Meticulous machine API (`@meticulous-home/espresso-api`). Emits events: `status`, `temperatures`, `shot-start`, `shot-data`, `shot-end`, `connected`, `disconnected`
- **websocket.ts**: WebSocket server at `/ws` that broadcasts machine events to all connected browser clients
- **cache.ts**: SQLite persistence layer using better-sqlite3. Stores shot history locally with support for incremental sync from machine
- **config.ts**: Configuration loader with cascade: defaults -> `config/default.json` -> `config/local.json` -> `/etc/meticulous-display/config.json` -> env vars (`MACHINE_HOST`, `MACHINE_PORT`, `SERVER_PORT`)
- **routes/api.ts**: REST API endpoints for history, stats, profiles, ratings, and config

### Client (Preact/HTM - `src/client/`)

- **app.js**: Main application component with view routing (Live, History, Stats, Settings)
- **api/client.js**: WebSocket and HTTP API clients (singletons: `wsClient`, `api`)
- **components/**: Chart rendering, settings panel, shot history list, idle sensors display
- **state/store.js**: Simple state management
- **utils/**: Formatting helpers and localStorage persistence for user preferences

### Data Flow

1. Server connects to Meticulous machine via `@meticulous-home/espresso-api`
2. Real-time sensor data (pressure, flow, weight, temperature, etc.) flows via WebSocket
3. Shot data is cached in SQLite (`data/history.db`) for offline access
4. Client connects via WebSocket for live updates, falls back to REST API for history

### Configuration

Create `config/local.json` based on `config/local.json.example`:
```json
{
  "machine": {
    "host": "192.168.1.115",
    "port": 8080
  }
}
```

## Key Patterns

- Singleton instances for core services: `meticulousClient`, `cacheManager`
- WebSocket events mirror the machine API events but are broadcast to all connected clients
- The client uses Preact with HTM (tagged template literals) instead of JSX
- Profile images are cached locally in `data/images/` to work offline

## Deployment

The `scripts/setup-pi.sh` script creates two systemd services:
- `meticulous-display.service`: Node.js server
- `meticulous-kiosk.service`: X + Chromium in kiosk mode

Useful commands after deployment:
```bash
sudo systemctl status meticulous-display
sudo systemctl status meticulous-kiosk
journalctl -u meticulous-display -f
journalctl -u meticulous-kiosk -f
```

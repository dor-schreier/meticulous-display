import express from 'express';
import compression from 'compression';
import path from 'path';
import { createServer } from 'http';
import { config } from './config';
import { meticulousClient } from './meticulous-client';
import { cacheManager } from './cache';
import { setupWebSocket } from './websocket';
import apiRoutes from './routes/api';

const app = express();
const server = createServer(app);

// Middleware
app.use(compression());
app.use(express.json());

// Security headers
app.use((req, res, next) => {
  // Allow API connections and WebSocket, CDN scripts, and source maps
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss: https://cdn.jsdelivr.net; img-src 'self' data:");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// API routes
app.use('/api', apiRoutes);

// Static files (frontend)
// When compiled (dist/server), serve from dist/client
// When running tsx (src/server), serve from src/client  
const clientPath = __dirname.includes('dist') 
  ? path.join(__dirname, '..', 'client')
  : path.join(__dirname, '..', '..', 'dist', 'client');
app.use(express.static(clientPath));
console.log(`Serving static files from: ${clientPath}`);

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

// Setup WebSocket
const wss = setupWebSocket(server);

// Initialize
async function initialize() {
  console.log('Meticulous Display Server');
  console.log('========================');
  console.log(`Machine: ${config.machine.host}:${config.machine.port}`);
  console.log(`Server: ${config.server.host}:${config.server.port}`);
  console.log('');

  // Connect to Meticulous machine
  await meticulousClient.connect();

  // Initial history sync
  console.log('Syncing history from machine...');
  try {
    const history = await meticulousClient.getHistoryListing();
    for (const shot of history) {
      cacheManager.upsertShotListing(shot);
    }
    console.log(`Cached ${history.length} shots from machine`);
  } catch (err) {
    console.error('Failed to sync history:', err);
  }

  // Periodic cache cleanup
  setInterval(() => {
    cacheManager.cleanup();
  }, 60 * 60 * 1000); // Every hour

  // Start server
  server.listen(config.server.port, config.server.host, () => {
    console.log('');
    console.log(`✓ Server running at http://${config.server.host}:${config.server.port}`);
    console.log(`✓ WebSocket available at ws://${config.server.host}:${config.server.port}/ws`);
    console.log('');
    console.log('Access the dashboard:');
    console.log(`  Local:   http://localhost:${config.server.port}`);
    console.log(`  Network: http://<your-ip>:${config.server.port}`);
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  meticulousClient.disconnect();
  cacheManager.close();
  wss.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nTerminating...');
  meticulousClient.disconnect();
  cacheManager.close();
  wss.close();
  server.close(() => {
    process.exit(0);
  });
});

// Start
initialize().catch((err) => {
  console.error('Failed to initialize:', err);
  process.exit(1);
});

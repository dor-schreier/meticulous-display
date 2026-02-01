import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { meticulousClient, ShotDataPoint } from './meticulous-client';
import { StatusData, Temperatures } from '@meticulous-home/espresso-api';

interface WSMessage {
  type: string;
  data: any;
}

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  const broadcast = (message: WSMessage) => {
    const payload = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  };

  // Forward events from Meticulous client to all WebSocket clients
  meticulousClient.on('status', (data: StatusData) => {
    broadcast({
      type: 'status',
      data: {
        state: data.state,
        extracting: data.extracting,
        time: data.profile_time,
        profile: data.loaded_profile,
        profileId: data.id,
        sensors: data.sensors,
        setpoints: data.setpoints
      }
    });
  });

  meticulousClient.on('temperatures', (data: Temperatures) => {
    broadcast({
      type: 'temperatures',
      data
    });
  });

  meticulousClient.on('shot-start', (data: { profile: string; profileId: string }) => {
    broadcast({
      type: 'shot-start',
      data
    });
  });

  meticulousClient.on('shot-data', (data: ShotDataPoint) => {
    broadcast({
      type: 'shot-data',
      data
    });
  });

  meticulousClient.on('shot-end', (data: { profile: string; profileId: string; data: ShotDataPoint[] }) => {
    broadcast({
      type: 'shot-end',
      data: {
        profile: data.profile,
        profileId: data.profileId,
        pointCount: data.data.length,
        duration: data.data.length > 0 ? data.data[data.data.length - 1].time : 0
      }
    });
  });

  meticulousClient.on('connected', (deviceInfo: any) => {
    broadcast({
      type: 'machine-connected',
      data: {
        name: deviceInfo?.name,
        model: deviceInfo?.model_version,
        firmware: deviceInfo?.firmware
      }
    });
  });

  meticulousClient.on('disconnected', () => {
    broadcast({
      type: 'machine-disconnected',
      data: null
    });
  });

  // Handle client connections
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    // Send current state to new client
    const state = meticulousClient.getState();
    ws.send(JSON.stringify({
      type: 'init',
      data: {
        connected: state.connected,
        brewing: state.brewing,
        status: state.status,
        currentShot: meticulousClient.getCurrentShot()
      }
    }));

    // Handle messages from client
    ws.on('message', (message) => {
      try {
        const parsed = JSON.parse(message.toString()) as WSMessage;
        handleClientMessage(ws, parsed);
      } catch (err) {
        console.error('Invalid WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  });

  return wss;
}

function handleClientMessage(ws: WebSocket, message: WSMessage): void {
  switch (message.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', data: Date.now() }));
      break;

    case 'get-state':
      const state = meticulousClient.getState();
      ws.send(JSON.stringify({
        type: 'state',
        data: {
          connected: state.connected,
          brewing: state.brewing,
          status: state.status
        }
      }));
      break;

    case 'get-current-shot':
      ws.send(JSON.stringify({
        type: 'current-shot',
        data: meticulousClient.getCurrentShot()
      }));
      break;

    default:
      console.log('Unknown message type:', message.type);
  }
}

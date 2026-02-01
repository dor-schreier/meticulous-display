// API Client - handles all HTTP and WebSocket communication

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit('connected');
    };
    
    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        this.emit(msg.type, msg.data);
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };
    
    this.ws.onclose = () => {
      this.emit('disconnected');
      this.scheduleReconnect();
    };
    
    this.ws.onerror = (err) => console.error('WS error:', err);
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= 10) return;
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), 1000 * Math.min(this.reconnectAttempts, 5));
  }

  on(event, cb) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(cb);
    return () => this.off(event, cb);
  }

  off(event, cb) {
    this.listeners.get(event)?.delete(cb);
  }

  emit(event, data) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

class ApiClient {
  constructor() {
    this.baseUrl = '';
  }

  async get(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  async post(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  // API endpoints
  getStatus() {
    return this.get('/api/status');
  }

  getHistory(limit = 50, offset = 0) {
    return this.get(`/api/history?limit=${limit}&offset=${offset}`);
  }

  getShot(id) {
    return this.get(`/api/history/${id}`);
  }

  getLastShot() {
    return this.get('/api/last-shot');
  }

  getStats() {
    return this.get('/api/stats');
  }

  rateShot(id, rating) {
    return this.post(`/api/history/${id}/rate`, { rating });
  }

  getDataSeries() {
    return this.get('/api/data-series');
  }
}

// Singleton instances
export const wsClient = new WebSocketClient();
export const api = new ApiClient();

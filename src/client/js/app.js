// Meticulous Display App
// Using Preact + htm for lightweight rendering

import { h, render } from 'preact';
import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import htm from 'htm';

const html = htm.bind(h);

// ============================================
// Constants & Utilities
// ============================================

const STORAGE_KEYS = {
  visibleSeries: 'meticulous_visible_series'
};

const loadVisibleSeries = (dataSeries) => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.visibleSeries);
    if (saved) return JSON.parse(saved);
  } catch (e) { console.error('Failed to load visible series:', e); }
  return dataSeries.filter(s => s.defaultVisible).map(s => s.id);
};

const saveVisibleSeries = (seriesIds) => {
  try {
    localStorage.setItem(STORAGE_KEYS.visibleSeries, JSON.stringify(seriesIds));
  } catch (e) { console.error('Failed to save visible series:', e); }
};

const formatTime = (seconds) => seconds == null ? '--' : `${seconds.toFixed(1)}s`;
const formatWeight = (grams) => grams == null ? '--' : `${grams.toFixed(1)}g`;
const formatFlow = (mlPerSec) => mlPerSec == null ? '--' : `${mlPerSec.toFixed(1)}`;
const formatTemp = (celsius) => celsius == null ? '--' : `${celsius.toFixed(1)}°C`;

const formatTimeOfDay = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Get value from live data point
const getSeriesValue = (point, seriesId) => {
  if (['pressure', 'flow', 'weight', 'temperature', 'gravimetricFlow', 'setpointPressure', 'setpointFlow', 'setpointTemp'].includes(seriesId)) {
    return point[seriesId];
  }
  if (seriesId.startsWith('t_')) return point.sensors?.[seriesId];
  if (['m_pos', 'm_spd', 'm_pwr', 'm_cur', 'bh_pwr'].includes(seriesId)) return point.actuators?.[seriesId];
  return null;
};

// Get value from historical data point
const getHistoricalSeriesValue = (point, seriesId) => {
  const shot = point.shot || {};
  const sensors = point.sensors || {};
  const mapping = {
    pressure: shot.pressure, flow: shot.flow, weight: shot.weight,
    temperature: shot.temperature, gravimetricFlow: shot.gravimetric_flow,
    t_ext_1: sensors.external_1, t_ext_2: sensors.external_2,
    t_bar_up: sensors.bar_up, t_bar_mu: sensors.bar_mid_up,
    t_bar_md: sensors.bar_mid_down, t_bar_down: sensors.bar_down,
    t_tube: sensors.tube, t_valv: sensors.valve,
    m_pos: sensors.motor_position, m_spd: sensors.motor_speed,
    m_pwr: sensors.motor_power, m_cur: sensors.motor_current,
    bh_pwr: sensors.bandheater_power,
  };
  return mapping[seriesId];
};

// ============================================
// WebSocket Client
// ============================================

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    
    this.ws.onopen = () => { this.reconnectAttempts = 0; this.emit('connected'); };
    this.ws.onmessage = (e) => {
      try { const msg = JSON.parse(e.data); this.emit(msg.type, msg.data); }
      catch (err) { console.error('WS parse error:', err); }
    };
    this.ws.onclose = () => { this.emit('disconnected'); this.scheduleReconnect(); };
    this.ws.onerror = (err) => console.error('WS error:', err);
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= 10) return;
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), 1000 * Math.min(this.reconnectAttempts, 5));
  }

  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
    return () => this.off(event, cb);
  }

  off(event, cb) { this.listeners.get(event)?.delete(cb); }
  emit(event, data) { this.listeners.get(event)?.forEach(cb => cb(data)); }
}

const wsClient = new WebSocketClient();

// ============================================
// API Client
// ============================================

const api = {
  async get(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
  async post(url, data) {
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
  getStatus: () => api.get('/api/status'),
  getHistory: (limit = 50, offset = 0) => api.get(`/api/history?limit=${limit}&offset=${offset}`),
  getShot: (id) => api.get(`/api/history/${id}`),
  getLastShot: () => api.get('/api/last-shot'),
  getStats: () => api.get('/api/stats'),
  rateShot: (id, rating) => api.post(`/api/history/${id}/rate`, { rating }),
  getDataSeries: () => api.get('/api/data-series')
};

// ============================================
// Icons
// ============================================

const Icons = {
  coffee: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg>`,
  home: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  history: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`,
  stats: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>`,
  settings: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  back: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`,
  chevronRight: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>`,
  close: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
};

// ============================================
// Components
// ============================================

function StatusIndicator({ status, connected }) {
  let state = 'disconnected', label = 'Disconnected';
  if (connected) {
    if (status?.state === 'brewing' || status?.extracting) { state = 'brewing'; label = 'Brewing'; }
    else if (status?.state === 'error') { state = 'error'; label = 'Error'; }
    else { state = 'idle'; label = 'Idle'; }
  }
  return html`<div class="status-indicator status-indicator--${state}"><span class="status-indicator__dot"></span><span>${label}</span></div>`;
}

function Navigation({ currentView, onNavigate, onOpenSettings }) {
  const items = [
    { id: 'live', icon: Icons.home, label: 'Live' },
    { id: 'history', icon: Icons.history, label: 'History' },
    { id: 'stats', icon: Icons.stats, label: 'Stats' },
    { id: 'settings', icon: Icons.settings, label: 'Settings' }
  ];
  return html`
    <nav class="app-nav">
      ${items.map(item => html`
        <button class="nav-button ${currentView === item.id ? 'nav-button--active' : ''}"
          onClick=${() => item.id === 'settings' ? onOpenSettings() : onNavigate(item.id)}>
          <span class="nav-button__icon">${item.icon}</span><span>${item.label}</span>
        </button>
      `)}
    </nav>`;
}

function DataSeriesSelector({ dataSeries, visibleSeries, onToggle, onClose, onReset }) {
  const groups = useMemo(() => {
    const g = {};
    dataSeries.forEach(s => { if (!g[s.group]) g[s.group] = []; g[s.group].push(s); });
    return g;
  }, [dataSeries]);

  const groupLabels = {
    shot: 'Shot Metrics', setpoints: 'Setpoints',
    temperatures: 'Temperature Sensors', motor: 'Motor / Actuators', other: 'Other'
  };

  return html`
    <div class="modal-overlay" onClick=${onClose}>
      <div class="modal" onClick=${e => e.stopPropagation()}>
        <div class="modal__header">
          <h2>Graph Settings</h2>
          <button class="modal__close" onClick=${onClose}>${Icons.close}</button>
        </div>
        <div class="modal__body">
          ${Object.entries(groups).map(([group, series]) => html`
            <div class="series-group">
              <h3 class="series-group__title">${groupLabels[group] || group}</h3>
              <div class="series-group__items">
                ${series.map(s => html`
                  <label class="series-toggle" key=${s.id}>
                    <input type="checkbox" checked=${visibleSeries.includes(s.id)} onChange=${() => onToggle(s.id)} />
                    <span class="series-toggle__color" style="background: ${s.color}"></span>
                    <span class="series-toggle__label">${s.label}</span>
                    <span class="series-toggle__unit">${s.unit}</span>
                  </label>
                `)}
              </div>
            </div>
          `)}
        </div>
        <div class="modal__footer">
          <button class="button button--secondary" onClick=${onReset}>Reset to Defaults</button>
          <button class="button button--primary" onClick=${onClose}>Done</button>
        </div>
      </div>
    </div>`;
}

function StatsGrid({ data }) {
  const metrics = [
    { key: 'time', icon: '⏱️', format: formatTime },
    { key: 'weight', icon: '⚖️', format: formatWeight },
    { key: 'flow', icon: '💧', format: formatFlow },
    { key: 'temperature', icon: '🌡️', format: formatTemp }
  ];
  return html`
    <div class="stats-grid">
      ${metrics.map(m => html`
        <div class="stat-card" key=${m.key}>
          <div class="stat-card__icon">${m.icon}</div>
          <div class="stat-card__value">${m.format(data[m.key])}</div>
          <div class="stat-card__label">${m.key.charAt(0).toUpperCase() + m.key.slice(1)}</div>
        </div>
      `)}
    </div>`;
}

function ConfigurableChart({ data, dataSeries, visibleSeries, height = 200, isHistorical = false }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  
  const activeSeries = useMemo(() => dataSeries.filter(s => visibleSeries.includes(s.id)), [dataSeries, visibleSeries]);
  const getScale = (s) => ['weight'].includes(s.id) ? 'y2' : ['m_pos', 'm_spd'].includes(s.id) ? 'y3' : 'y';

  useEffect(() => {
    if (!containerRef.current || activeSeries.length === 0) return;
    
    const opts = {
      width: containerRef.current.offsetWidth, height,
      scales: { x: { time: false }, y: { auto: true }, y2: { auto: true, side: 1 }, y3: { auto: true, side: 1 } },
      axes: [
        { stroke: '#666', grid: { stroke: 'rgba(255,255,255,0.05)' } },
        { stroke: '#666', grid: { stroke: 'rgba(255,255,255,0.05)' }, size: 50 },
        { stroke: '#666', side: 1, size: 50, grid: { show: false } },
        { stroke: '#666', side: 1, size: 50, grid: { show: false }, show: false }
      ],
      series: [{}, ...activeSeries.map(s => ({ label: s.label, stroke: s.color, width: 2, scale: getScale(s) }))],
      cursor: { show: true }, legend: { show: true }
    };

    const getValue = isHistorical ? getHistoricalSeriesValue : getSeriesValue;
    const chartData = [
      data.map(d => isHistorical ? (d.time / 1000) : d.time),
      ...activeSeries.map(s => data.map(d => getValue(d, s.id) ?? null))
    ];
    
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new uPlot(opts, chartData, containerRef.current);
    
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [activeSeries, height, isHistorical]);
  
  useEffect(() => {
    if (chartRef.current && data.length > 0 && activeSeries.length > 0) {
      const getValue = isHistorical ? getHistoricalSeriesValue : getSeriesValue;
      chartRef.current.setData([
        data.map(d => isHistorical ? (d.time / 1000) : d.time),
        ...activeSeries.map(s => data.map(d => getValue(d, s.id) ?? null))
      ]);
    }
  }, [data, activeSeries, isHistorical]);
  
  if (activeSeries.length === 0) {
    return html`<div class="chart-container chart-container--empty"><p>No data series selected. Open settings to choose what to display.</p></div>`;
  }

  return html`
    <div class="chart-container">
      <div ref=${containerRef}></div>
      <div class="chart-legend">
        ${activeSeries.map(s => html`<span class="chart-legend__item" key=${s.id}><span class="chart-legend__color" style="background: ${s.color}"></span>${s.label} (${s.unit})</span>`)}
      </div>
    </div>`;
}

function LiveView({ status, shotData, connected, dataSeries, visibleSeries }) {
  const [lastShot, setLastShot] = useState(null);
  const isBrewing = status?.extracting || status?.state === 'brewing';
  
  useEffect(() => { if (!isBrewing) api.getLastShot().then(setLastShot).catch(console.error); }, [isBrewing]);
  
  if (!connected) {
    return html`<div class="idle-view"><div class="idle-view__icon">☕</div><div class="idle-view__title">Connecting...</div><div class="idle-view__time">Waiting for machine connection</div></div>`;
  }
  
  if (isBrewing) {
    const latest = shotData[shotData.length - 1] || {};
    return html`
      <div>
        <${ConfigurableChart} data=${shotData} dataSeries=${dataSeries} visibleSeries=${visibleSeries} height=${220} />
        <${StatsGrid} data=${{ time: latest.time, weight: latest.weight, flow: latest.flow, temperature: latest.temperature }} />
      </div>`;
  }
  
  return html`
    <div class="idle-view">
      <div class="idle-view__icon">☕</div>
      ${lastShot ? html`
        <div class="idle-view__title">Last Shot</div>
        <div class="idle-view__time">${formatTimeOfDay(lastShot.time)}</div>
        <div class="idle-view__profile">${lastShot.name || lastShot.profile?.name || 'Unknown Profile'}</div>
        <div class="idle-view__stats">${formatWeight(lastShot.yieldWeight || 0)} • ${formatTime(lastShot.duration || 0)}${lastShot.rating === 'like' ? ' 👍' : lastShot.rating === 'dislike' ? ' 👎' : ''}</div>
      ` : html`<div class="idle-view__title">Ready</div><div class="idle-view__time">Waiting for extraction</div>`}
    </div>`;
}

function ShotItem({ shot, onClick }) {
  return html`
    <div class="shot-item" onClick=${onClick}>
      <div class="shot-item__main">
        <div class="shot-item__profile">${shot.profileName || 'Unknown'}</div>
        <div class="shot-item__stats">
          <span class="shot-item__stat">
            <span class="shot-item__stat-icon">⚖️</span>
            <span class="shot-item__stat-value">${formatWeight(shot.yieldWeight)}</span>
          </span>
          <span class="shot-item__stat">
            <span class="shot-item__stat-icon">⏱️</span>
            <span class="shot-item__stat-value">${formatTime(shot.duration)}</span>
          </span>
        </div>
      </div>
      <div class="shot-item__right">
        <div class="shot-item__time">${formatTimeOfDay(shot.time)}</div>
        <div class="shot-item__rating">${shot.rating === 'like' ? '👍' : shot.rating === 'dislike' ? '👎' : '−'}</div>
      </div>
      <span class="shot-item__chevron">${Icons.chevronRight}</span>
    </div>`;
}

function HistoryView({ onSelectShot }) {
  const [shots, setShots] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    api.getHistory(50, 0).then(data => { setShots(data.shots || []); setLoading(false); })
      .catch(err => { console.error('Failed to load history:', err); setLoading(false); });
  }, []);
  
  if (loading) return html`<div class="loading"><div class="loading__spinner"></div><span>Loading history...</span></div>`;
  
  const grouped = {};
  shots.forEach(shot => {
    const date = new Date(shot.time).toDateString();
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(shot);
  });
  
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const formatDateHeader = (d) => d === today ? 'Today' : d === yesterday ? 'Yesterday' : new Date(d).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  
  return html`
    <div class="shot-list">
      ${Object.entries(grouped).map(([date, dayShots]) => html`
        <div class="section-header">${formatDateHeader(date)}</div>
        ${dayShots.map(shot => html`<${ShotItem} shot=${shot} onClick=${() => onSelectShot(shot.id)} />`)}
      `)}
    </div>`;
}

function ShotDetailView({ shotId, onBack, dataSeries, visibleSeries }) {
  const [shot, setShot] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    setLoading(true);
    api.getShot(shotId).then(data => { setShot(data); setLoading(false); })
      .catch(err => { console.error('Failed to load shot:', err); setLoading(false); });
  }, [shotId]);
  
  const handleRate = async (rating) => {
    const newRating = shot.rating === rating ? null : rating;
    try { await api.rateShot(shotId, newRating); setShot(prev => ({ ...prev, rating: newRating })); }
    catch (err) { console.error('Failed to rate shot:', err); }
  };
  
  if (loading) return html`<div class="loading"><div class="loading__spinner"></div><span>Loading shot...</span></div>`;
  if (!shot) return html`<div class="loading"><span>Shot not found</span><button class="button button--secondary" onClick=${onBack}>Go Back</button></div>`;
  
  return html`
    <div>
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px">
        <button class="button button--secondary" onClick=${onBack}><span class="nav-button__icon">${Icons.back}</span>Back</button>
        <h2 style="flex: 1">${shot.profileName}</h2>
        <div class="rating-buttons">
          <button class="rating-button ${shot.rating === 'like' ? 'rating-button--active' : ''}" onClick=${() => handleRate('like')}>👍</button>
          <button class="rating-button ${shot.rating === 'dislike' ? 'rating-button--active' : ''}" onClick=${() => handleRate('dislike')}>👎</button>
        </div>
      </div>
      ${shot.data?.length > 0 ? html`<${ConfigurableChart} data=${shot.data} dataSeries=${dataSeries} visibleSeries=${visibleSeries} height=${250} isHistorical=${true} />` 
        : html`<div class="card" style="text-align: center; padding: 32px"><p style="color: var(--text-muted)">No graph data available</p></div>`}
      <div class="stats-grid" style="margin-top: 16px">
        <div class="stat-card"><div class="stat-card__label">Duration</div><div class="stat-card__value">${formatTime(shot.duration)}</div></div>
        <div class="stat-card"><div class="stat-card__label">Yield</div><div class="stat-card__value">${formatWeight(shot.yieldWeight)}</div></div>
        <div class="stat-card"><div class="stat-card__label">Profile</div><div class="stat-card__value" style="font-size: 14px">${shot.profileName}</div></div>
        <div class="stat-card"><div class="stat-card__label">Date</div><div class="stat-card__value" style="font-size: 14px">${new Date(shot.time).toLocaleDateString()}</div></div>
      </div>
    </div>`;
}

function StatsView() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    api.getStats().then(data => { setStats(data); setLoading(false); })
      .catch(err => { console.error('Failed to load stats:', err); setLoading(false); });
  }, []);
  
  if (loading) return html`<div class="loading"><div class="loading__spinner"></div><span>Loading statistics...</span></div>`;
  
  const local = stats?.local || {};
  
  return html`
    <div>
      <div class="stats-grid" style="margin-bottom: 24px">
        <div class="stat-card"><div class="stat-card__icon">☕</div><div class="stat-card__value">${local.totalShots || 0}</div><div class="stat-card__label">Total Shots</div></div>
        <div class="stat-card"><div class="stat-card__icon">📅</div><div class="stat-card__value">${local.todayShots || 0}</div><div class="stat-card__label">Today</div></div>
        <div class="stat-card"><div class="stat-card__icon">📊</div><div class="stat-card__value">${local.weekShots || 0}</div><div class="stat-card__label">This Week</div></div>
        <div class="stat-card"><div class="stat-card__icon">⏱️</div><div class="stat-card__value">${formatTime(local.avgDuration)}</div><div class="stat-card__label">Avg Duration</div></div>
      </div>
      ${local.profileBreakdown?.length > 0 && html`
        <div class="card">
          <div class="card__header"><h3 class="card__title">Top Profiles</h3></div>
          <div class="card__body">
            ${local.profileBreakdown.slice(0, 5).map(p => html`
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-subtle)">
                <span>${p.name}</span><span style="color: var(--text-muted)">${p.count} shots</span>
              </div>`)}
          </div>
        </div>`}
      ${local.ratingBreakdown && html`
        <div class="card" style="margin-top: 16px">
          <div class="card__header"><h3 class="card__title">Ratings</h3></div>
          <div class="card__body">
            <div style="display: flex; gap: 24px">
              <div>👍 ${local.ratingBreakdown.likes || 0} likes</div>
              <div>👎 ${local.ratingBreakdown.dislikes || 0} dislikes</div>
              <div style="color: var(--text-muted)">${local.ratingBreakdown.unrated || 0} unrated</div>
            </div>
          </div>
        </div>`}
    </div>`;
}

// ============================================
// Main App
// ============================================

function App() {
  const [currentView, setCurrentView] = useState('live');
  const [selectedShotId, setSelectedShotId] = useState(null);
  const [status, setStatus] = useState(null);
  const [shotData, setShotData] = useState([]);
  const [connected, setConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dataSeries, setDataSeries] = useState([]);
  const [visibleSeries, setVisibleSeries] = useState([]);
  
  useEffect(() => {
    api.getDataSeries().then(series => {
      setDataSeries(series);
      setVisibleSeries(loadVisibleSeries(series));
    }).catch(err => {
      console.error('Failed to load data series:', err);
      const fallback = [
        { id: 'pressure', label: 'Pressure', unit: 'bar', color: '#3b82f6', group: 'shot', defaultVisible: true },
        { id: 'flow', label: 'Flow', unit: 'ml/s', color: '#22c55e', group: 'shot', defaultVisible: true },
        { id: 'weight', label: 'Weight', unit: 'g', color: '#f97316', group: 'shot', defaultVisible: true },
        { id: 'temperature', label: 'Temperature', unit: '°C', color: '#ef4444', group: 'shot', defaultVisible: true }
      ];
      setDataSeries(fallback);
      setVisibleSeries(loadVisibleSeries(fallback));
    });
  }, []);
  
  const handleToggleSeries = useCallback((id) => {
    setVisibleSeries(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      saveVisibleSeries(next);
      return next;
    });
  }, []);
  
  const handleResetSeries = useCallback(() => {
    const defaults = dataSeries.filter(s => s.defaultVisible).map(s => s.id);
    setVisibleSeries(defaults);
    saveVisibleSeries(defaults);
  }, [dataSeries]);
  
  useEffect(() => {
    wsClient.connect();
    const unsubs = [
      wsClient.on('init', (data) => { setConnected(data.connected); setStatus(data.status); if (data.currentShot) setShotData(data.currentShot); }),
      wsClient.on('status', (data) => { setStatus(data); setConnected(true); }),
      wsClient.on('shot-data', (point) => setShotData(prev => [...prev, point])),
      wsClient.on('shot-start', () => setShotData([])),
      wsClient.on('shot-end', () => {}),
      wsClient.on('machine-connected', () => setConnected(true)),
      wsClient.on('machine-disconnected', () => setConnected(false))
    ];
    return () => unsubs.forEach(fn => fn());
  }, []);
  
  const handleNavigate = (view) => { setCurrentView(view); setSelectedShotId(null); };
  const handleSelectShot = (id) => { setSelectedShotId(id); setCurrentView('detail'); };
  const handleBackFromDetail = () => { setSelectedShotId(null); setCurrentView('history'); };
  
  let mainContent;
  switch (currentView) {
    case 'live': mainContent = html`<${LiveView} status=${status} shotData=${shotData} connected=${connected} dataSeries=${dataSeries} visibleSeries=${visibleSeries} />`; break;
    case 'history': mainContent = html`<${HistoryView} onSelectShot=${handleSelectShot} />`; break;
    case 'detail': mainContent = html`<${ShotDetailView} shotId=${selectedShotId} onBack=${handleBackFromDetail} dataSeries=${dataSeries} visibleSeries=${visibleSeries} />`; break;
    case 'stats': mainContent = html`<${StatsView} />`; break;
    default: mainContent = html`<${LiveView} status=${status} shotData=${shotData} connected=${connected} dataSeries=${dataSeries} visibleSeries=${visibleSeries} />`;
  }
  
  return html`
    <div class="app-container">
      <header class="app-header">
        <div class="app-header__title"><span class="app-header__logo">${Icons.coffee}</span><span>Meticulous</span></div>
        <div class="app-header__status">
          ${status?.loaded_profile && html`<span class="app-header__profile">${status.loaded_profile}</span>`}
          <${StatusIndicator} status=${status} connected=${connected} />
        </div>
      </header>
      <main class="app-main">${mainContent}</main>
      <${Navigation} currentView=${currentView === 'detail' ? 'history' : currentView} onNavigate=${handleNavigate} onOpenSettings=${() => setShowSettings(true)} />
      ${showSettings && html`<${DataSeriesSelector} dataSeries=${dataSeries} visibleSeries=${visibleSeries} onToggle=${handleToggleSeries} onClose=${() => setShowSettings(false)} onReset=${handleResetSeries} />`}
    </div>`;
}

render(html`<${App} />`, document.getElementById('app'));

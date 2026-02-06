// Meticulous Display App - Refactored Modular Architecture
import { h, render } from 'preact';
import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import htm from 'htm';

// API & State
import { wsClient, api } from './api/client.js';
import { store } from './state/store.js';

// Config & Utils
import { DATA_SERIES } from './config/chartConfig.js';
import { loadVisibleSeries, saveVisibleSeries, loadIdleVisibleSeries, saveIdleVisibleSeries, loadSeriesColors, saveSeriesColors } from './utils/storage.js';
import { formatTime, formatWeight, formatFlow, formatTemp, formatTimeOfDay } from './utils/formatting.js';

// Components
import { useChart } from './components/chart.js';
import { DataSeriesSelector } from './components/settings.js';
import { HistoryView } from './components/shotHistory.js';
import { IdleSensors } from './components/idleSensors.js';

const html = htm.bind(h);

// ============================================
// Icons
// ============================================

const Icons = {
  coffee: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg>`,
  home: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  history: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`,
  stats: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>`,
  settings: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  back: html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`
};

// ============================================
// UI Components
// ============================================

function StatusIndicator({ status, connected }) {
  let state = 'disconnected', label = 'Disconnected';
  if (connected) {
    if (status?.state === 'brewing' || status?.extracting) {
      state = 'brewing';
      label = 'Brewing';
    } else if (status?.state === 'error') {
      state = 'error';
      label = 'Error';
    } else {
      state = 'idle';
      label = 'Idle';
    }
  }
  return html`
    <div class="status-indicator status-indicator--${state}">
      <span class="status-indicator__dot"></span>
      <span>${label}</span>
    </div>
  `;
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
        <button 
          class="nav-button ${currentView === item.id ? 'nav-button--active' : ''}"
          onClick=${() => item.id === 'settings' ? onOpenSettings() : onNavigate(item.id)}
          key=${item.id}
        >
          <span class="nav-button__icon">${item.icon}</span>
          <span>${item.label}</span>
        </button>
      `)}
    </nav>
  `;
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
          <div class="stat-card__label">
            ${m.key.charAt(0).toUpperCase() + m.key.slice(1)}
          </div>
        </div>
      `)}
    </div>
  `;
}

function ConfigurableChart({ data, dataSeries, visibleSeries, height = 200, isHistorical = false }) {
  const containerRef = useRef(null);
  const [hoverValues, setHoverValues] = useState(null);
  const activeSeries = useMemo(() =>
    dataSeries.filter(s => visibleSeries.includes(s.id)),
    [dataSeries, visibleSeries]
  );

  const handleHover = useCallback((values) => {
    setHoverValues(values);
  }, []);

  useChart(containerRef, activeSeries, data, height, isHistorical, handleHover);

  if (activeSeries.length === 0) {
    return html`
      <div class="chart-container chart-container--empty">
        <p>No data series selected. Open settings to choose what to display.</p>
      </div>
    `;
  }

  return html`
    <div class="chart-container">
      <div ref=${containerRef}></div>
      <div class="chart-legend">
        ${activeSeries.map(s => {
          const value = hoverValues && hoverValues[s.id] !== null && hoverValues[s.id] !== undefined
            ? hoverValues[s.id].toFixed(2)
            : '—';
          return html`
            <span class="chart-legend__item" key=${s.id}>
              <span class="chart-legend__color" style="background: ${s.color}"></span>
              ${s.label}: <strong>${value}</strong> ${s.unit}
            </span>
          `;
        })}
      </div>
    </div>
  `;
}

// ============================================
// View Components
// ============================================

function LiveView({ status, shotData, connected, dataSeries, visibleSeries, idleVisibleSeries, temperatures }) {
  const [lastShot, setLastShot] = useState(null);
  const isBrewing = status?.extracting || status?.state === 'brewing';

  useEffect(() => {
    if (!isBrewing) {
      api.getLastShot()
        .then(setLastShot)
        .catch(console.error);
    }
  }, [isBrewing]);

  if (!connected) {
    return html`
      <div class="idle-view">
        <div class="idle-view__icon">☕</div>
        <div class="idle-view__title">Connecting...</div>
        <div class="idle-view__time">Waiting for machine connection</div>
      </div>
    `;
  }

  if (isBrewing) {
    const latest = shotData[shotData.length - 1] || {};
    return html`
      <div>
        <${ConfigurableChart}
          data=${shotData}
          dataSeries=${dataSeries}
          visibleSeries=${visibleSeries}
          height=${220}
        />
        <${StatsGrid} data=${{
          time: latest.time,
          weight: latest.weight,
          flow: latest.flow,
          temperature: latest.temperature
        }} />
      </div>
    `;
  }

  // Prefer local cached image, fall back to remote
  const profileImage = lastShot?.profileImageLocal || lastShot?.profileImage || lastShot?.profile?.display?.image;
  const imageUrl = profileImage ? `/api/profile-image/${encodeURIComponent(profileImage)}` : null;

  return html`
    <div class="idle-view">
      ${imageUrl ? html`
        <div class="idle-view__image">
          <img src=${imageUrl} alt=${lastShot?.name || 'Profile'} />
        </div>
      ` : html`
        <div class="idle-view__icon">☕</div>
      `}
      ${lastShot ? html`
        <div class="idle-view__title">Last Shot</div>
        <div class="idle-view__time">${formatTimeOfDay(lastShot.time)}</div>
        <div class="idle-view__profile">
          ${lastShot.name || lastShot.profile?.name || 'Unknown Profile'}
        </div>
        <div class="idle-view__stats">
          ${formatWeight(lastShot.yieldWeight || 0)} • ${formatTime(lastShot.duration || 0)}${
            lastShot.rating === 'like' ? ' 👍' :
            lastShot.rating === 'dislike' ? ' 👎' : ''
          }
        </div>
      ` : html`
        <div class="idle-view__title">Ready</div>
        <div class="idle-view__time">Waiting for extraction</div>
      `}

      <${IdleSensors}
        status=${status}
        temperatures=${temperatures}
        dataSeries=${dataSeries}
        visibleSeries=${idleVisibleSeries}
      />
    </div>
  `;
}

function ShotDetailView({ shotId, onBack, dataSeries, visibleSeries }) {
  const [shot, setShot] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    setLoading(true);
    api.getShot(shotId)
      .then(data => {
        setShot(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load shot:', err);
        setLoading(false);
      });
  }, [shotId]);
  
  const handleRate = async (rating) => {
    const newRating = shot.rating === rating ? null : rating;
    try {
      await api.rateShot(shotId, newRating);
      setShot(prev => ({ ...prev, rating: newRating }));
    } catch (err) {
      console.error('Failed to rate shot:', err);
    }
  };
  
  if (loading) {
    return html`
      <div class="loading">
        <div class="loading__spinner"></div>
        <span>Loading shot...</span>
      </div>
    `;
  }
  
  if (!shot) {
    return html`
      <div class="loading">
        <span>Shot not found</span>
        <button class="button button--secondary" onClick=${onBack}>
          Go Back
        </button>
      </div>
    `;
  }
  
  // Prefer local cached image, fall back to remote
  const profileImage = shot.profileImageLocal || shot.profileImage || shot.profile?.display?.image;
  const imageUrl = profileImage ? `/api/profile-image/${encodeURIComponent(profileImage)}` : null;

  return html`
    <div class="shot-detail">
      <div class="shot-detail__header">
        <button class="button button--secondary" onClick=${onBack}>
          <span class="nav-button__icon">${Icons.back}</span>
          Back
        </button>
        ${imageUrl && html`
          <div class="shot-detail__image">
            <img src=${imageUrl} alt=${shot.profileName} />
          </div>
        `}
        <h2 style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${shot.profileName}</h2>
        <div class="rating-buttons">
          <button
            class="rating-button ${shot.rating === 'like' ? 'rating-button--active' : ''}"
            onClick=${() => handleRate('like')}
          >
            👍
          </button>
          <button
            class="rating-button ${shot.rating === 'dislike' ? 'rating-button--active' : ''}"
            onClick=${() => handleRate('dislike')}
          >
            👎
          </button>
        </div>
      </div>
      <div class="shot-detail__content">
        ${shot.data?.length > 0 ? html`
          <${ConfigurableChart}
            data=${shot.data}
            dataSeries=${dataSeries}
            visibleSeries=${visibleSeries}
            height=${350}
            isHistorical=${true}
          />
        ` : html`
          <div class="card" style="text-align: center; padding: 32px">
            <p style="color: var(--text-muted)">No graph data available</p>
          </div>
        `}
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-card__icon">⏱️</div>
            <div class="stat-card__label">Duration</div>
            <div class="stat-card__value">${formatTime(shot.duration)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__icon">⚖️</div>
            <div class="stat-card__label">Yield</div>
            <div class="stat-card__value">${formatWeight(shot.yieldWeight)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__icon">☕</div>
            <div class="stat-card__label">Profile</div>
            <div class="stat-card__value stat-card__value--small">${shot.profileName}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__icon">📅</div>
            <div class="stat-card__label">Date</div>
            <div class="stat-card__value stat-card__value--small">
              ${new Date(shot.time < 10000000000 ? shot.time * 1000 : shot.time).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function StatsView() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    api.getStats()
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load stats:', err);
        setLoading(false);
      });
  }, []);
  
  if (loading) {
    return html`
      <div class="loading">
        <div class="loading__spinner"></div>
        <span>Loading statistics...</span>
      </div>
    `;
  }
  
  const local = stats?.local || {};
  
  return html`
    <div>
      <div class="stats-grid" style="margin-bottom: 24px">
        <div class="stat-card">
          <div class="stat-card__icon">☕</div>
          <div class="stat-card__value">${local.totalShots || 0}</div>
          <div class="stat-card__label">Total Shots</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__icon">📅</div>
          <div class="stat-card__value">${local.todayShots || 0}</div>
          <div class="stat-card__label">Today</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__icon">📊</div>
          <div class="stat-card__value">${local.weekShots || 0}</div>
          <div class="stat-card__label">This Week</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__icon">⏱️</div>
          <div class="stat-card__value">${formatTime(local.avgDuration)}</div>
          <div class="stat-card__label">Avg Duration</div>
        </div>
      </div>
      ${local.profileBreakdown?.length > 0 && html`
        <div class="card">
          <div class="card__header">
            <h3 class="card__title">Top Profiles</h3>
          </div>
          <div class="card__body">
            ${local.profileBreakdown.slice(0, 5).map(p => html`
              <div 
                key=${p.name}
                style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-subtle)"
              >
                <span>${p.name}</span>
                <span style="color: var(--text-muted)">${p.count} shots</span>
              </div>
            `)}
          </div>
        </div>
      `}
      ${local.ratingBreakdown && html`
        <div class="card" style="margin-top: 16px">
          <div class="card__header">
            <h3 class="card__title">Ratings</h3>
          </div>
          <div class="card__body">
            <div style="display: flex; gap: 24px">
              <div>👍 ${local.ratingBreakdown.likes || 0} likes</div>
              <div>👎 ${local.ratingBreakdown.dislikes || 0} dislikes</div>
              <div style="color: var(--text-muted)">
                ${local.ratingBreakdown.unrated || 0} unrated
              </div>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
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
  const [temperatures, setTemperatures] = useState(null);
  const [dataSeries, setDataSeries] = useState([]);
  const [visibleSeries, setVisibleSeries] = useState([]);
  const [idleVisibleSeries, setIdleVisibleSeries] = useState([]);

  // Load data series configuration with custom colors
  useEffect(() => {
    api.getDataSeries()
      .then(series => {
        const seriesWithColors = loadSeriesColors(series);
        setDataSeries(seriesWithColors);
        setVisibleSeries(loadVisibleSeries(seriesWithColors));
        setIdleVisibleSeries(loadIdleVisibleSeries(seriesWithColors));
      })
      .catch(err => {
        console.error('Failed to load data series:', err);
        // Fallback to default config
        const seriesWithColors = loadSeriesColors(DATA_SERIES);
        setDataSeries(seriesWithColors);
        setVisibleSeries(loadVisibleSeries(seriesWithColors));
        setIdleVisibleSeries(loadIdleVisibleSeries(seriesWithColors));
      });
  }, []);

  // Handle chart view series visibility toggle
  const handleToggleSeries = useCallback((id) => {
    setVisibleSeries(prev => {
      const next = prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id];
      saveVisibleSeries(next);
      return next;
    });
  }, []);

  // Handle idle view series visibility toggle
  const handleToggleIdleSeries = useCallback((id) => {
    setIdleVisibleSeries(prev => {
      const next = prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id];
      saveIdleVisibleSeries(next);
      return next;
    });
  }, []);

  // Handle color change
  const handleColorChange = useCallback((seriesId, color) => {
    console.log('[handleColorChange]', seriesId, color);

    const updatedSeries = dataSeries.map(s =>
      s.id === seriesId ? { ...s, color } : s
    );

    console.log('[handleColorChange] Updated series:', updatedSeries.find(s => s.id === seriesId));
    setDataSeries(updatedSeries);

    // Save only custom colors to localStorage
    const colorMap = {};
    updatedSeries.forEach(s => {
      const defaultSeries = DATA_SERIES.find(ds => ds.id === s.id);
      if (s.color !== defaultSeries?.color) {
        colorMap[s.id] = s.color;
      }
    });

    console.log('[handleColorChange] Saving colorMap:', colorMap);
    saveSeriesColors(colorMap);
  }, [dataSeries]);

  // Reset to default series
  const handleResetSeries = useCallback(() => {
    const defaults = dataSeries.filter(s => s.defaultVisible).map(s => s.id);
    setVisibleSeries(defaults);
    saveVisibleSeries(defaults);

    const idleDefaults = ['pressure', 'temperature', 'flow', 'weight'];
    setIdleVisibleSeries(idleDefaults);
    saveIdleVisibleSeries(idleDefaults);

    // Reset colors
    setDataSeries(DATA_SERIES);
    localStorage.removeItem('meticulous_series_colors');
  }, [dataSeries]);
  
  // WebSocket connection and event handlers
  useEffect(() => {
    wsClient.connect();

    const unsubs = [
      wsClient.on('init', (data) => {
        setConnected(data.connected);
        setStatus(data.status);
        if (data.currentShot) setShotData(data.currentShot);
      }),
      wsClient.on('status', (data) => {
        setStatus(data);
        setConnected(true);
      }),
      wsClient.on('temperatures', (data) => {
        setTemperatures(data);
      }),
      wsClient.on('shot-data', (point) => {
        setShotData(prev => [...prev, point]);
      }),
      wsClient.on('shot-start', () => {
        setShotData([]);
      }),
      wsClient.on('shot-end', () => {
        // Shot ended - data is complete
      }),
      wsClient.on('machine-connected', () => {
        setConnected(true);
      }),
      wsClient.on('machine-disconnected', () => {
        setConnected(false);
      })
    ];

    return () => unsubs.forEach(fn => fn());
  }, []);
  
  // Navigation handlers
  const handleNavigate = (view) => {
    setCurrentView(view);
    setSelectedShotId(null);
  };
  
  const handleSelectShot = (id) => {
    setSelectedShotId(id);
    setCurrentView('detail');
  };
  
  const handleBackFromDetail = () => {
    setSelectedShotId(null);
    setCurrentView('history');
  };
  
  // Render appropriate view
  let mainContent;
  switch (currentView) {
    case 'live':
      mainContent = html`
        <${LiveView}
          status=${status}
          shotData=${shotData}
          connected=${connected}
          dataSeries=${dataSeries}
          visibleSeries=${visibleSeries}
          idleVisibleSeries=${idleVisibleSeries}
          temperatures=${temperatures}
        />
      `;
      break;
    case 'history':
      mainContent = html`<${HistoryView} onSelectShot=${handleSelectShot} />`;
      break;
    case 'detail':
      mainContent = html`
        <${ShotDetailView}
          shotId=${selectedShotId}
          onBack=${handleBackFromDetail}
          dataSeries=${dataSeries}
          visibleSeries=${visibleSeries}
        />
      `;
      break;
    case 'stats':
      mainContent = html`<${StatsView} />`;
      break;
    default:
      mainContent = html`
        <${LiveView}
          status=${status}
          shotData=${shotData}
          connected=${connected}
          dataSeries=${dataSeries}
          visibleSeries=${visibleSeries}
          idleVisibleSeries=${idleVisibleSeries}
          temperatures=${temperatures}
        />
      `;
  }
  
  return html`
    <div class="app-container">
      <header class="app-header">
        <div class="app-header__title">
          <span class="app-header__logo">${Icons.coffee}</span>
          <span>Meticulous</span>
        </div>
        <div class="app-header__status">
          ${status?.loaded_profile && html`
            <span class="app-header__profile">${status.loaded_profile}</span>
          `}
          <${StatusIndicator} status=${status} connected=${connected} />
        </div>
      </header>
      
      <main class="app-main">
        ${mainContent}
      </main>
      
      <${Navigation} 
        currentView=${currentView === 'detail' ? 'history' : currentView} 
        onNavigate=${handleNavigate} 
        onOpenSettings=${() => setShowSettings(true)} 
      />
      
      ${showSettings && html`
        <${DataSeriesSelector}
          dataSeries=${dataSeries}
          visibleSeries=${visibleSeries}
          idleVisibleSeries=${idleVisibleSeries}
          onToggle=${handleToggleSeries}
          onIdleToggle=${handleToggleIdleSeries}
          onColorChange=${handleColorChange}
          onClose=${() => setShowSettings(false)}
          onReset=${handleResetSeries}
        />
      `}
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('app'));

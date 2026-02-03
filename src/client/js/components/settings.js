// Settings Component - modal for configuring visible data series and colors
import { h } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import htm from 'htm';
import { GROUP_LABELS } from '../config/chartConfig.js';
import { saveVisibleSeries, saveIdleVisibleSeries, saveSeriesColors } from '../utils/storage.js';

const html = htm.bind(h);

const CloseIcon = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

export function DataSeriesSelector({
  dataSeries,
  visibleSeries,
  idleVisibleSeries,
  onToggle,
  onIdleToggle,
  onColorChange,
  onClose,
  onReset
}) {
  const [activeTab, setActiveTab] = useState('chart'); // 'chart', 'idle', 'colors'

  const groups = useMemo(() => {
    const g = {};
    dataSeries.forEach(s => {
      if (!g[s.group]) g[s.group] = [];
      g[s.group].push(s);
    });
    return g;
  }, [dataSeries]);

  const handleToggleSeries = (seriesId, forIdle = false) => {
    if (forIdle) {
      onIdleToggle(seriesId);
    } else {
      onToggle(seriesId);
    }
  };

  const renderSeriesGroup = (group, series, forIdle = false) => {
    const selectedSeries = forIdle ? idleVisibleSeries : visibleSeries;

    return html`
      <div class="series-group" key=${group}>
        <h3 class="series-group__title">${GROUP_LABELS[group] || group}</h3>
        <div class="series-group__items">
          ${series.map(s => html`
            <label class="series-toggle" key=${s.id}>
              <input
                type="checkbox"
                checked=${selectedSeries.includes(s.id)}
                onChange=${() => handleToggleSeries(s.id, forIdle)}
              />
              <span class="series-toggle__color" style="background: ${s.color}"></span>
              <span class="series-toggle__label">${s.label}</span>
              <span class="series-toggle__unit">${s.unit}</span>
            </label>
          `)}
        </div>
      </div>
    `;
  };

  const renderColorPickers = (group, series) => {
    return html`
      <div class="series-group" key=${group}>
        <h3 class="series-group__title">${GROUP_LABELS[group] || group}</h3>
        <div class="series-group__items">
          ${series.map(s => html`
            <div class="color-picker-item" key=${s.id}>
              <span class="series-toggle__color" style="background: ${s.color}"></span>
              <span class="series-toggle__label">${s.label}</span>
              <input
                type="color"
                class="color-picker"
                value=${s.color}
                onChange=${(e) => onColorChange(s.id, e.target.value)}
              />
            </div>
          `)}
        </div>
      </div>
    `;
  };

  return html`
    <div class="modal-overlay" onClick=${onClose}>
      <div class="modal" onClick=${e => e.stopPropagation()}>
        <div class="modal__header">
          <h2>Settings</h2>
          <button class="modal__close" onClick=${onClose}>${CloseIcon}</button>
        </div>

        <!-- Tabs -->
        <div class="settings__tabs">
          <button
            class="settings__tab ${activeTab === 'chart' ? 'settings__tab--active' : ''}"
            onClick=${() => setActiveTab('chart')}
          >
            Chart View
          </button>
          <button
            class="settings__tab ${activeTab === 'idle' ? 'settings__tab--active' : ''}"
            onClick=${() => setActiveTab('idle')}
          >
            Idle View
          </button>
          <button
            class="settings__tab ${activeTab === 'colors' ? 'settings__tab--active' : ''}"
            onClick=${() => setActiveTab('colors')}
          >
            Colors
          </button>
        </div>

        <div class="modal__body">
          ${activeTab === 'chart' && html`
            <div class="settings__description">
              Select which sensors to display on the live chart during brewing.
            </div>
            ${Object.entries(groups).map(([group, series]) => renderSeriesGroup(group, series, false))}
          `}

          ${activeTab === 'idle' && html`
            <div class="settings__description">
              Select which sensors to display when the machine is idle.
            </div>
            ${Object.entries(groups).map(([group, series]) => renderSeriesGroup(group, series, true))}
          `}

          ${activeTab === 'colors' && html`
            <div class="settings__description">
              Customize the color for each data series.
            </div>
            ${Object.entries(groups).map(([group, series]) => renderColorPickers(group, series))}
          `}
        </div>

        <div class="modal__footer">
          <button class="button button--secondary" onClick=${onReset}>
            Reset to Defaults
          </button>
          <button class="button button--primary" onClick=${onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  `;
}

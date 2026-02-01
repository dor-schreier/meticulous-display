// Settings Component - modal for configuring visible data series
import { h } from 'preact';
import { useMemo } from 'preact/hooks';
import htm from 'htm';
import { GROUP_LABELS } from '../config/chartConfig.js';

const html = htm.bind(h);

const CloseIcon = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

export function DataSeriesSelector({ dataSeries, visibleSeries, onToggle, onClose, onReset }) {
  const groups = useMemo(() => {
    const g = {};
    dataSeries.forEach(s => {
      if (!g[s.group]) g[s.group] = [];
      g[s.group].push(s);
    });
    return g;
  }, [dataSeries]);

  return html`
    <div class="modal-overlay" onClick=${onClose}>
      <div class="modal" onClick=${e => e.stopPropagation()}>
        <div class="modal__header">
          <h2>Graph Settings</h2>
          <button class="modal__close" onClick=${onClose}>${CloseIcon}</button>
        </div>
        <div class="modal__body">
          ${Object.entries(groups).map(([group, series]) => html`
            <div class="series-group" key=${group}>
              <h3 class="series-group__title">${GROUP_LABELS[group] || group}</h3>
              <div class="series-group__items">
                ${series.map(s => html`
                  <label class="series-toggle" key=${s.id}>
                    <input 
                      type="checkbox" 
                      checked=${visibleSeries.includes(s.id)} 
                      onChange=${() => onToggle(s.id)} 
                    />
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

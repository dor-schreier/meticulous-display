// LocalStorage utilities for persistent preferences

export const STORAGE_KEYS = {
  visibleSeries: 'meticulous_visible_series',           // Chart view
  idleVisibleSeries: 'meticulous_idle_visible_series',  // Idle view
  seriesColors: 'meticulous_series_colors'               // Custom colors
};

export const loadVisibleSeries = (dataSeries) => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.visibleSeries);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load visible series:', e);
  }
  return dataSeries.filter(s => s.defaultVisible).map(s => s.id);
};

export const saveVisibleSeries = (seriesIds) => {
  try {
    localStorage.setItem(STORAGE_KEYS.visibleSeries, JSON.stringify(seriesIds));
  } catch (e) {
    console.error('Failed to save visible series:', e);
  }
};

export const loadIdleVisibleSeries = (dataSeries) => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.idleVisibleSeries);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to load idle visible series:', e);
  }
  // Default: show primary sensors (pressure, temperature, flow, weight)
  return ['pressure', 'temperature', 'flow', 'weight'];
};

export const saveIdleVisibleSeries = (seriesIds) => {
  try {
    localStorage.setItem(STORAGE_KEYS.idleVisibleSeries, JSON.stringify(seriesIds));
  } catch (e) {
    console.error('Failed to save idle visible series:', e);
  }
};

export const loadSeriesColors = (dataSeries) => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.seriesColors);
    if (saved) {
      const customColors = JSON.parse(saved);
      // Merge custom colors with defaults
      return dataSeries.map(s => ({
        ...s,
        color: customColors[s.id] || s.color
      }));
    }
  } catch (e) {
    console.error('Failed to load series colors:', e);
  }
  return dataSeries;
};

export const saveSeriesColors = (colorMap) => {
  try {
    localStorage.setItem(STORAGE_KEYS.seriesColors, JSON.stringify(colorMap));
  } catch (e) {
    console.error('Failed to save series colors:', e);
  }
};

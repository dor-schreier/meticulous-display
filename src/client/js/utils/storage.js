// LocalStorage utilities for persistent preferences

export const STORAGE_KEYS = {
  visibleSeries: 'meticulous_visible_series'
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

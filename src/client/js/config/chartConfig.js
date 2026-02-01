// Chart configuration: series definitions, colors, and groupings

export const DATA_SERIES = [
  // Shot Metrics
  { id: 'pressure', label: 'Pressure', unit: 'bar', color: '#3b82f6', group: 'shot', defaultVisible: true },
  { id: 'flow', label: 'Flow', unit: 'ml/s', color: '#22c55e', group: 'shot', defaultVisible: true },
  { id: 'weight', label: 'Weight', unit: 'g', color: '#f97316', group: 'shot', defaultVisible: true },
  { id: 'temperature', label: 'Temperature', unit: '°C', color: '#ef4444', group: 'shot', defaultVisible: true },
  { id: 'gravimetricFlow', label: 'Gravimetric Flow', unit: 'g/s', color: '#8b5cf6', group: 'shot', defaultVisible: false },
  
  // Setpoints
  { id: 'setpointPressure', label: 'Setpoint Pressure', unit: 'bar', color: '#06b6d4', group: 'setpoints', defaultVisible: false },
  { id: 'setpointFlow', label: 'Setpoint Flow', unit: 'ml/s', color: '#10b981', group: 'setpoints', defaultVisible: false },
  { id: 'setpointTemp', label: 'Setpoint Temp', unit: '°C', color: '#f59e0b', group: 'setpoints', defaultVisible: false },
  
  // Temperature Sensors
  { id: 't_ext_1', label: 'T Ext 1', unit: '°C', color: '#ec4899', group: 'temperatures', defaultVisible: false },
  { id: 't_ext_2', label: 'T Ext 2', unit: '°C', color: '#f472b6', group: 'temperatures', defaultVisible: false },
  { id: 't_bar_up', label: 'T Bar Up', unit: '°C', color: '#fb923c', group: 'temperatures', defaultVisible: false },
  { id: 't_bar_mu', label: 'T Bar Mid Up', unit: '°C', color: '#fbbf24', group: 'temperatures', defaultVisible: false },
  { id: 't_bar_md', label: 'T Bar Mid Down', unit: '°C', color: '#facc15', group: 'temperatures', defaultVisible: false },
  { id: 't_bar_down', label: 'T Bar Down', unit: '°C', color: '#a3e635', group: 'temperatures', defaultVisible: false },
  { id: 't_tube', label: 'T Tube', unit: '°C', color: '#4ade80', group: 'temperatures', defaultVisible: false },
  { id: 't_valv', label: 'T Valve', unit: '°C', color: '#2dd4bf', group: 'temperatures', defaultVisible: false },
  
  // Motor / Actuators
  { id: 'm_pos', label: 'Motor Position', unit: 'mm', color: '#60a5fa', group: 'motor', defaultVisible: false },
  { id: 'm_spd', label: 'Motor Speed', unit: 'mm/s', color: '#818cf8', group: 'motor', defaultVisible: false },
  { id: 'm_pwr', label: 'Motor Power', unit: '%', color: '#a78bfa', group: 'motor', defaultVisible: false },
  { id: 'm_cur', label: 'Motor Current', unit: 'A', color: '#c084fc', group: 'motor', defaultVisible: false },
  { id: 'bh_pwr', label: 'Band Heater Power', unit: '%', color: '#e879f9', group: 'motor', defaultVisible: false }
];

export const GROUP_LABELS = {
  shot: 'Shot Metrics',
  setpoints: 'Setpoints',
  temperatures: 'Temperature Sensors',
  motor: 'Motor / Actuators',
  other: 'Other'
};

// Chart scale mapping
export const getScale = (seriesId) => {
  if (['weight'].includes(seriesId)) return 'y2';
  if (['m_pos', 'm_spd'].includes(seriesId)) return 'y3';
  return 'y';
};

// uPlot base options
export const BASE_CHART_OPTIONS = {
  scales: {
    x: { time: false },
    y: { auto: true },
    y2: { auto: true, side: 1 },
    y3: { auto: true, side: 1 }
  },
  axes: [
    { stroke: '#666', grid: { stroke: 'rgba(255,255,255,0.05)' } },
    { stroke: '#666', grid: { stroke: 'rgba(255,255,255,0.05)' }, size: 50 },
    { stroke: '#666', side: 1, size: 50, grid: { show: false } },
    { stroke: '#666', side: 1, size: 50, grid: { show: false }, show: false }
  ],
  cursor: { show: true },
  legend: { show: false }  // Disable default legend, we'll use custom
};

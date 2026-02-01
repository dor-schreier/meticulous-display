// Chart Component - uPlot wrapper for data visualization
import { useRef, useEffect, useMemo } from 'preact/hooks';
import { BASE_CHART_OPTIONS, getScale } from '../config/chartConfig.js';

// Extract values from data points
export const getSeriesValue = (point, seriesId) => {
  if (['pressure', 'flow', 'weight', 'temperature', 'gravimetricFlow', 'setpointPressure', 'setpointFlow', 'setpointTemp'].includes(seriesId)) {
    return point[seriesId];
  }
  if (seriesId.startsWith('t_')) return point.sensors?.[seriesId];
  if (['m_pos', 'm_spd', 'm_pwr', 'm_cur', 'bh_pwr'].includes(seriesId)) return point.actuators?.[seriesId];
  return null;
};

export const getHistoricalSeriesValue = (point, seriesId) => {
  const shot = point.shot || {};
  const sensors = point.sensors || {};
  const mapping = {
    pressure: shot.pressure,
    flow: shot.flow,
    weight: shot.weight,
    temperature: shot.temperature,
    gravimetricFlow: shot.gravimetric_flow,
    t_ext_1: sensors.external_1,
    t_ext_2: sensors.external_2,
    t_bar_up: sensors.bar_up,
    t_bar_mu: sensors.bar_mid_up,
    t_bar_md: sensors.bar_mid_down,
    t_bar_down: sensors.bar_down,
    t_tube: sensors.tube,
    t_valv: sensors.valve,
    m_pos: sensors.motor_position,
    m_spd: sensors.motor_speed,
    m_pwr: sensors.motor_power,
    m_cur: sensors.motor_current,
    bh_pwr: sensors.bandheater_power,
  };
  return mapping[seriesId];
};

export function useChart(containerRef, activeSeries, data, height, isHistorical = false, onHover = null) {
  const chartRef = useRef(null);

  // Build chart on mount/series change
  useEffect(() => {
    if (!containerRef.current || activeSeries.length === 0) return;

    const opts = {
      ...BASE_CHART_OPTIONS,
      width: containerRef.current.offsetWidth,
      height,
      series: [
        {},
        ...activeSeries.map(s => ({
          label: s.label,
          stroke: s.color,
          width: 2,
          scale: getScale(s.id)
        }))
      ],
      hooks: {
        setCursor: [
          (u) => {
            if (onHover) {
              const idx = u.cursor.idx;
              if (idx !== null && idx !== undefined) {
                const hoverValues = {};
                activeSeries.forEach((s, i) => {
                  const value = u.data[i + 1][idx];
                  hoverValues[s.id] = value;
                });
                onHover(hoverValues);
              } else {
                onHover(null);
              }
            }
          }
        ]
      }
    };

    const getValue = isHistorical ? getHistoricalSeriesValue : getSeriesValue;
    const chartData = [
      data.map(d => isHistorical ? (d.time / 1000) : d.time),
      ...activeSeries.map(s => data.map(d => getValue(d, s.id) ?? null))
    ];

    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new uPlot(opts, chartData, containerRef.current);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [activeSeries, height, isHistorical, onHover]);

  // Update data
  useEffect(() => {
    if (chartRef.current && data.length > 0 && activeSeries.length > 0) {
      const getValue = isHistorical ? getHistoricalSeriesValue : getSeriesValue;
      chartRef.current.setData([
        data.map(d => isHistorical ? (d.time / 1000) : d.time),
        ...activeSeries.map(s => data.map(d => getValue(d, s.id) ?? null))
      ]);
    }
  }, [data, activeSeries, isHistorical]);

  return chartRef;
}

export function ChartLegend({ series }) {
  return series.map(s => ({
    id: s.id,
    color: s.color,
    label: s.label,
    unit: s.unit
  }));
}

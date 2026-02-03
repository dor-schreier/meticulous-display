import { html } from 'htm/preact';

export function IdleSensors({ status, temperatures, dataSeries, visibleSeries }) {
  // Need status or temperatures data to show sensors
  if (!status && !temperatures) {
    return null;
  }

  // Debug: log what we're receiving
  //console.log('[IdleSensors] status:', status);
  //console.log('[IdleSensors] temperatures:', temperatures);
  //console.log('[IdleSensors] visibleSeries:', visibleSeries);

  // Combine sensor data from multiple sources
  const sensorData = {};

  // Extract primary sensors from status
  if (status) {
    // The API uses abbreviated keys: p, f, w, t, g
    if (status.sensors) {
      sensorData.pressure = status.sensors.p;
      sensorData.flow = status.sensors.f;
      sensorData.weight = status.sensors.w;
      sensorData.temperature = status.sensors.t;
      sensorData.gravimetricFlow = status.sensors.g;
    }

    // Extract setpoints (these use full names)
    if (status.setpoints) {
      sensorData.setpointPressure = status.setpoints.pressure;
      sensorData.setpointFlow = status.setpoints.flow;
      sensorData.setpointTemp = status.setpoints.temp;
    }
  }

  // Extract temperature sensors and motor data from temperatures event
  if (temperatures) {
    // Temperature sensors have full names: t_ext_1, t_bar_up, etc.
    // Motor sensors are: m_pos, m_spd, m_pwr, m_cur, bh_pwr
    // These can be used directly
    Object.assign(sensorData, temperatures);
  }

  //console.log('[IdleSensors] sensorData:', sensorData);

  // Filter to visible sensors only and exclude null/undefined values
  const visibleData = dataSeries
    .filter(s => {
      const isVisible = visibleSeries.includes(s.id);
      const hasValue = sensorData[s.id] != null && !isNaN(sensorData[s.id]);
      return isVisible && hasValue;
    })
    .map(s => ({
      ...s,
      value: sensorData[s.id]
    }));

  //console.log('[IdleSensors] visibleData:', visibleData);

  if (visibleData.length === 0) {
    //console.log('[IdleSensors] No visible data, returning null');
    return null;
  }

  return html`
    <div class="idle-sensors">
      <div class="idle-sensors__title">Live Sensors</div>
      <div class="idle-sensors__grid">
        ${visibleData.map(sensor => html`
          <div class="idle-sensor" key=${sensor.id}>
            <div class="idle-sensor__label">
              <span class="idle-sensor__indicator" style="background: ${sensor.color}"></span>
              ${sensor.label}
            </div>
            <div class="idle-sensor__value">
              ${formatSensorValue(sensor.value, sensor.unit)}
            </div>
          </div>
        `)}
      </div>
    </div>
  `;
}

function formatSensorValue(value, unit) {
  if (value == null || isNaN(value)) return '--';

  const formatted = value.toFixed(1);
  return unit ? `${formatted}${unit}` : formatted;
}

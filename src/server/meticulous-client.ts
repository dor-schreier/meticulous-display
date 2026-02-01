import Api, {
  StatusData,
  Temperatures,
  Actuators,
  HistoryEntry,
  HistoryListingEntry,
  HistoryStats,
  DeviceInfo,
  ShotRating,
  ProfileIdent
} from '@meticulous-home/espresso-api';
import { EventEmitter } from 'events';
import { config } from './config';

// Sensor data from temperatures socket event
export interface SensorTemperatures {
  t_ext_1: number;
  t_ext_2: number;
  t_bar_up: number;
  t_bar_mu: number;
  t_bar_md: number;
  t_bar_down: number;
  t_tube: number;
  t_valv: number;
}

// Motor/actuator data from actuators socket event
export interface SensorActuators {
  m_pos: number;
  m_spd: number;
  m_pwr: number;
  m_cur: number;
  bh_pwr: number;
}

// Complete shot data point with all available sensor data
export interface ShotDataPoint {
  time: number;
  // Primary shot metrics
  pressure: number;
  flow: number;
  weight: number;
  temperature: number;
  gravimetricFlow: number;
  // Setpoints
  setpointPressure?: number;
  setpointFlow?: number;
  setpointTemp?: number;
  // Extended temperature sensors
  sensors?: {
    t_ext_1?: number;
    t_ext_2?: number;
    t_bar_up?: number;
    t_bar_mu?: number;
    t_bar_md?: number;
    t_bar_down?: number;
    t_tube?: number;
    t_valv?: number;
  };
  // Motor/actuator data
  actuators?: {
    m_pos?: number;
    m_spd?: number;
    m_pwr?: number;
    m_cur?: number;
    bh_pwr?: number;
  };
}

// Data series metadata for UI configuration
export interface DataSeriesConfig {
  id: string;
  label: string;
  unit: string;
  color: string;
  group: 'shot' | 'setpoints' | 'temperatures' | 'motor' | 'other';
  defaultVisible: boolean;
  minValue?: number;
  maxValue?: number;
}

// All available data series
export const DATA_SERIES: DataSeriesConfig[] = [
  // Primary shot metrics
  { id: 'pressure', label: 'Pressure', unit: 'bar', color: '#3b82f6', group: 'shot', defaultVisible: true, minValue: 0, maxValue: 12 },
  { id: 'flow', label: 'Flow', unit: 'ml/s', color: '#22c55e', group: 'shot', defaultVisible: true, minValue: 0, maxValue: 10 },
  { id: 'weight', label: 'Weight', unit: 'g', color: '#f97316', group: 'shot', defaultVisible: true, minValue: 0 },
  { id: 'temperature', label: 'Temperature', unit: '°C', color: '#ef4444', group: 'shot', defaultVisible: true, minValue: 80, maxValue: 100 },
  { id: 'gravimetricFlow', label: 'Gravimetric Flow', unit: 'g/s', color: '#a855f7', group: 'shot', defaultVisible: false, minValue: 0, maxValue: 10 },
  
  // Setpoints
  { id: 'setpointPressure', label: 'Pressure Setpoint', unit: 'bar', color: '#93c5fd', group: 'setpoints', defaultVisible: false, minValue: 0, maxValue: 12 },
  { id: 'setpointFlow', label: 'Flow Setpoint', unit: 'ml/s', color: '#86efac', group: 'setpoints', defaultVisible: false, minValue: 0, maxValue: 10 },
  { id: 'setpointTemp', label: 'Temp Setpoint', unit: '°C', color: '#fca5a5', group: 'setpoints', defaultVisible: false, minValue: 80, maxValue: 100 },
  
  // Temperature sensors
  { id: 't_ext_1', label: 'External Temp 1', unit: '°C', color: '#f87171', group: 'temperatures', defaultVisible: false },
  { id: 't_ext_2', label: 'External Temp 2', unit: '°C', color: '#fb923c', group: 'temperatures', defaultVisible: false },
  { id: 't_bar_up', label: 'Bar Upper', unit: '°C', color: '#fbbf24', group: 'temperatures', defaultVisible: false },
  { id: 't_bar_mu', label: 'Bar Mid-Upper', unit: '°C', color: '#a3e635', group: 'temperatures', defaultVisible: false },
  { id: 't_bar_md', label: 'Bar Mid-Lower', unit: '°C', color: '#4ade80', group: 'temperatures', defaultVisible: false },
  { id: 't_bar_down', label: 'Bar Lower', unit: '°C', color: '#2dd4bf', group: 'temperatures', defaultVisible: false },
  { id: 't_tube', label: 'Tube Temp', unit: '°C', color: '#22d3ee', group: 'temperatures', defaultVisible: false },
  { id: 't_valv', label: 'Valve Temp', unit: '°C', color: '#818cf8', group: 'temperatures', defaultVisible: false },
  
  // Motor/actuator data
  { id: 'm_pos', label: 'Motor Position', unit: 'steps', color: '#c084fc', group: 'motor', defaultVisible: false },
  { id: 'm_spd', label: 'Motor Speed', unit: 'rpm', color: '#e879f9', group: 'motor', defaultVisible: false },
  { id: 'm_pwr', label: 'Motor Power', unit: 'W', color: '#f472b6', group: 'motor', defaultVisible: false },
  { id: 'm_cur', label: 'Motor Current', unit: 'A', color: '#fb7185', group: 'motor', defaultVisible: false },
  { id: 'bh_pwr', label: 'Band Heater Power', unit: 'W', color: '#fdba74', group: 'other', defaultVisible: false },
];

export interface MachineState {
  status: StatusData | null;
  temperatures: Temperatures | null;
  actuators: Actuators | null;
  connected: boolean;
  brewing: boolean;
  currentShot: ShotDataPoint[];
}

export class MeticulousClient extends EventEmitter {
  private api: Api;
  private state: MachineState = {
    status: null,
    temperatures: null,
    actuators: null,
    connected: false,
    brewing: false,
    currentShot: []
  };
  private reconnectTimer: NodeJS.Timeout | null = null;
  private lastSampleTime = 0;
  private sampleInterval: number;
  private isShuttingDown = false;

  constructor() {
    super();
    
    const baseUrl = `http://${config.machine.host}:${config.machine.port}/`;
    this.sampleInterval = 1000 / config.realtime.sampleRate;
    
    this.api = new Api(
      {
        onStatus: this.handleStatus.bind(this),
        onTemperatures: this.handleTemperatures.bind(this),
        onActuators: this.handleActuators.bind(this)
      },
      baseUrl
    );
  }

  async connect(): Promise<void> {
    try {
      console.log(`Connecting to Meticulous at ${config.machine.host}:${config.machine.port}...`);
      
      // Test connection with a simple API call
      const deviceInfo = await this.api.getDeviceInfo();
      if (deviceInfo.data && 'error' in deviceInfo.data) {
        throw new Error(deviceInfo.data.error);
      }
      
      // Connect to WebSocket for real-time data
      this.api.connectToSocket();
      
      this.state.connected = true;
      this.emit('connected', deviceInfo.data);
      console.log('Connected to Meticulous machine');
      
      // Clear reconnect timer if it was running
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      
      // Monitor socket connection
      const socket = this.api.getSocket();
      if (socket) {
        socket.on('disconnect', () => {
          console.log('Disconnected from Meticulous');
          this.state.connected = false;
          this.emit('disconnected');
          this.scheduleReconnect();
        });
        
        socket.on('connect_error', (err) => {
          console.error('Socket connection error:', err.message);
          this.state.connected = false;
          this.emit('error', err);
        });
      }
    } catch (err) {
      console.error('Failed to connect to Meticulous:', err);
      this.state.connected = false;
      this.emit('error', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.isShuttingDown) return;
    
    console.log('Scheduling reconnect in 5 seconds...');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }

  private handleStatus(data: StatusData): void {
    const wasBrewing = this.state.brewing;
    const isBrewing = data.state === 'brewing' || data.extracting;
    
    this.state.status = data;
    this.state.brewing = isBrewing;
    
    // Detect shot start
    if (!wasBrewing && isBrewing) {
      this.state.currentShot = [];
      this.emit('shot-start', {
        profile: data.loaded_profile,
        profileId: data.id
      });
    }
    
    // Collect shot data during brewing (throttled)
    if (isBrewing) {
      const now = Date.now();
      if (now - this.lastSampleTime >= this.sampleInterval) {
        this.lastSampleTime = now;
        
        const dataPoint: ShotDataPoint = {
          time: data.profile_time / 1000, // Convert to seconds
          // Primary shot metrics
          pressure: data.sensors.p,
          flow: data.sensors.f,
          weight: data.sensors.w,
          temperature: data.sensors.t,
          gravimetricFlow: data.sensors.g,
          // Setpoints
          setpointPressure: data.setpoints.pressure,
          setpointFlow: data.setpoints.flow,
          setpointTemp: data.setpoints.temperature,
          // Include current temperature sensor readings if available
          sensors: this.state.temperatures ? {
            t_ext_1: this.state.temperatures.t_ext_1,
            t_ext_2: this.state.temperatures.t_ext_2,
            t_bar_up: this.state.temperatures.t_bar_up,
            t_bar_mu: this.state.temperatures.t_bar_mu,
            t_bar_md: this.state.temperatures.t_bar_md,
            t_bar_down: this.state.temperatures.t_bar_down,
            t_tube: this.state.temperatures.t_tube,
            t_valv: this.state.temperatures.t_valv,
          } : undefined,
          // Include current actuator readings if available
          actuators: this.state.actuators ? {
            m_pos: this.state.actuators.m_pos,
            m_spd: this.state.actuators.m_spd,
            m_pwr: this.state.actuators.m_pwr,
            m_cur: this.state.actuators.m_cur,
            bh_pwr: this.state.actuators.bh_pwr,
          } : undefined,
        };
        
        this.state.currentShot.push(dataPoint);
        
        // Limit buffer size
        if (this.state.currentShot.length > config.realtime.maxGraphPoints) {
          this.state.currentShot.shift();
        }
        
        this.emit('shot-data', dataPoint);
      }
    }
    
    // Detect shot end
    if (wasBrewing && !isBrewing) {
      this.emit('shot-end', {
        profile: data.loaded_profile,
        profileId: data.id,
        data: [...this.state.currentShot]
      });
    }
    
    this.emit('status', data);
  }

  private handleTemperatures(data: Temperatures): void {
    this.state.temperatures = data;
    this.emit('temperatures', data);
  }

  private handleActuators(data: Actuators): void {
    this.state.actuators = data;
    this.emit('actuators', data);
  }

  getState(): MachineState {
    return { ...this.state };
  }

  getCurrentShot(): ShotDataPoint[] {
    return [...this.state.currentShot];
  }

  // API wrapper methods
  async getDeviceInfo(): Promise<DeviceInfo | null> {
    try {
      const response = await this.api.getDeviceInfo();
      if ('error' in response.data) return null;
      return response.data as DeviceInfo;
    } catch {
      return null;
    }
  }

  async getHistoryListing(maxResults: number = 500): Promise<HistoryListingEntry[]> {
    try {
      // Use searchHistory with higher max_results instead of getHistoryShortListing (defaults to ~20)
      const response = await this.api.searchHistory({
        max_results: maxResults,
        dump_data: true
      });
      // Map to HistoryListingEntry (data is null when dump_data is false)
      return (response.data.history || []).map(entry => ({
        ...entry,
        data: entry.data ?? null,
      })) as unknown as HistoryListingEntry[];
    } catch {
      return [];
    }
  }

  async getHistoryEntry(id: number | string): Promise<HistoryEntry | null> {
    try {
      const response = await this.api.searchHistory({ ids: [id], dump_data: true });
      if (response.data.history && response.data.history.length > 0) {
        return response.data.history[0];
      }
      return null;
    } catch {
      return null;
    }
  }

  async getHistoryStats(): Promise<HistoryStats | null> {
    try {
      const response = await this.api.getHistoryStatistics();
      return response.data;
    } catch {
      return null;
    }
  }

  async getLastShot(): Promise<HistoryEntry | null> {
    try {
      const response = await this.api.getLastShot();
      return response.data;
    } catch {
      return null;
    }
  }

  async rateShot(shotId: number, rating: ShotRating): Promise<boolean> {
    try {
      const response = await this.api.rateShot(shotId, rating);
      return !('error' in response.data);
    } catch {
      return false;
    }
  }

  async listProfiles(): Promise<ProfileIdent[]> {
    try {
      const response = await this.api.listProfiles();
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch {
      return [];
    }
  }

  disconnect(): void {
    this.isShuttingDown = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.api.disconnectSocket();
    this.state.connected = false;
  }
}

// Singleton instance
export const meticulousClient = new MeticulousClient();

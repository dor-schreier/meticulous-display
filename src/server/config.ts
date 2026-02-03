import fs from 'fs';
import path from 'path';

export interface MachineConfig {
  host: string;
  port: number;
}

export interface ServerConfig {
  port: number;
  host: string;
}

export interface DisplayConfig {
  mode: 'auto' | 'compact' | 'desktop';
  compactWidth: number;
  compactHeight: number;
}

export interface CacheConfig {
  maxShots: number;
  dbPath: string;
  resetSchemaOnStart: boolean;
  imagesPath: string;
}

export interface RealtimeConfig {
  sampleRate: number;
  maxGraphPoints: number;
  bufferSize: number;
}

export interface AppConfig {
  machine: MachineConfig;
  server: ServerConfig;
  display: DisplayConfig;
  cache: CacheConfig;
  realtime: RealtimeConfig;
}

const defaultConfig: AppConfig = {
  machine: {
    host: '192.168.1.115',
    port: 8080
  },
  server: {
    port: 3002,
    host: '0.0.0.0'
  },
  display: {
    mode: 'auto',
    compactWidth: 1024,
    compactHeight: 600
  },
  cache: {
    maxShots: 500,
    dbPath: './data/history.db',
    resetSchemaOnStart: false,
    imagesPath: './data/images'
  },
  realtime: {
    sampleRate: 10,
    maxGraphPoints: 300,
    bufferSize: 50
  }
};

export function loadConfig(): AppConfig {
  const configPaths = [
    path.join(process.cwd(), 'config', 'default.json'),
    path.join(process.cwd(), 'config', 'local.json'),
    '/etc/meticulous-display/config.json'
  ];

  let config = { ...defaultConfig };

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        config = deepMerge(config, fileConfig);
        console.log(`Loaded config from ${configPath}`);
      } catch (err) {
        console.error(`Failed to load config from ${configPath}:`, err);
      }
    }
  }

  // Environment variable overrides
  if (process.env.MACHINE_HOST) {
    config.machine.host = process.env.MACHINE_HOST;
  }
  if (process.env.MACHINE_PORT) {
    config.machine.port = parseInt(process.env.MACHINE_PORT, 10);
  }
  if (process.env.SERVER_PORT) {
    config.server.port = parseInt(process.env.SERVER_PORT, 10);
  }

  return config;
}

function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        target[key] !== null
      ) {
        (result as any)[key] = deepMerge(target[key] as object, source[key] as object);
      } else {
        (result as any)[key] = source[key];
      }
    }
  }
  
  return result;
}

export const config = loadConfig();

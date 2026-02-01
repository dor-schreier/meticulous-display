import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { HistoryEntry, HistoryListingEntry, ShotRating } from '@meticulous-home/espresso-api';

export interface CachedShot {
  id: number;
  machineId: string;
  time: number;
  profileName: string;
  profileId: string;
  duration: number;
  yieldWeight: number;
  rating: ShotRating;
  hasFullData: boolean;
  data: string | null; // JSON stringified shot data
}

export interface ShotStats {
  totalShots: number;
  todayShots: number;
  weekShots: number;
  avgDuration: number;
  profileBreakdown: { name: string; count: number }[];
  ratingBreakdown: { likes: number; dislikes: number; unrated: number };
}

export class CacheManager {
  private db: Database.Database;

  constructor() {
    // Ensure data directory exists
    const dbDir = path.dirname(config.cache.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(config.cache.dbPath);
    this.db.pragma('journal_mode = WAL'); // Better performance for Pi
    this.initSchema();
  }

  private initSchema(): void {
    // Drop existing table to ensure clean schema
    this.db.exec(`DROP TABLE IF EXISTS shots;`);
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shots (
        id INTEGER NOT NULL,
        machine_id TEXT NOT NULL,
        time INTEGER NOT NULL,
        profile_name TEXT NOT NULL,
        profile_id TEXT,
        duration REAL,
        yield_weight REAL,
        rating TEXT,
        has_full_data INTEGER DEFAULT 0,
        data TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (machine_id, id)
      );

      CREATE INDEX IF NOT EXISTS idx_shots_time ON shots(time DESC);
      CREATE INDEX IF NOT EXISTS idx_shots_profile ON shots(profile_name);
      
      CREATE TABLE IF NOT EXISTS machine_info (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);
  }

  // Store or update shot listing (without full data)
  upsertShotListing(shot: HistoryListingEntry): void {
    const duration = this.extractDuration(shot);
    const yieldWeight = this.extractYield(shot);

    const stmt = this.db.prepare(`
      INSERT INTO shots (id, machine_id, time, profile_name, profile_id, duration, yield_weight, rating, has_full_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(machine_id, id) DO UPDATE SET
        time = excluded.time,
        profile_name = excluded.profile_name,
        profile_id = excluded.profile_id,
        duration = COALESCE(excluded.duration, shots.duration),
        yield_weight = COALESCE(excluded.yield_weight, shots.yield_weight),
        rating = COALESCE(excluded.rating, shots.rating)
    `);

    stmt.run(
      shot.db_key || parseInt(shot.id),
      shot.id,
      shot.time,
      shot.name || shot.profile?.name || 'Unknown',
      shot.profile?.id || null,
      duration,
      yieldWeight,
      shot.rating || null
    );
  }

  // Store full shot data
  upsertFullShot(shot: HistoryEntry): void {
    const duration = this.extractDuration(shot);
    const yieldWeight = this.extractYield(shot);
    const dataJson = JSON.stringify(shot.data);

    const stmt = this.db.prepare(`
      INSERT INTO shots (id, machine_id, time, profile_name, profile_id, duration, yield_weight, rating, has_full_data, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(machine_id, id) DO UPDATE SET
        time = excluded.time,
        profile_name = excluded.profile_name,
        profile_id = excluded.profile_id,
        duration = excluded.duration,
        yield_weight = excluded.yield_weight,
        rating = COALESCE(excluded.rating, shots.rating),
        has_full_data = 1,
        data = excluded.data
    `);

    stmt.run(
      shot.db_key || parseInt(shot.id),
      shot.id,
      shot.time,
      shot.name || shot.profile?.name || 'Unknown',
      shot.profile?.id || null,
      duration,
      yieldWeight,
      shot.rating || null,
      dataJson
    );
  }

  // Get shot listing (paginated)
  getShots(limit: number = 50, offset: number = 0): CachedShot[] {
    const stmt = this.db.prepare(`
      SELECT id, machine_id as machineId, time, profile_name as profileName, 
             profile_id as profileId, duration, yield_weight as yieldWeight, 
             rating, has_full_data as hasFullData
      FROM shots
      ORDER BY time DESC
      LIMIT ? OFFSET ?
    `);
    
    return stmt.all(limit, offset) as CachedShot[];
  }

  // Get full shot data
  getShot(id: number): CachedShot | null {
    const stmt = this.db.prepare(`
      SELECT id, machine_id as machineId, time, profile_name as profileName,
             profile_id as profileId, duration, yield_weight as yieldWeight,
             rating, has_full_data as hasFullData, data
      FROM shots
      WHERE id = ?
    `);
    
    return stmt.get(id) as CachedShot | null;
  }

  // Check if we have full data for a shot
  hasFullData(id: number): boolean {
    const stmt = this.db.prepare('SELECT has_full_data FROM shots WHERE id = ?');
    const row = stmt.get(id) as { has_full_data: number } | undefined;
    return row?.has_full_data === 1;
  }

  // Update shot rating
  updateRating(id: number, rating: ShotRating): void {
    const stmt = this.db.prepare('UPDATE shots SET rating = ? WHERE id = ?');
    stmt.run(rating, id);
  }

  // Get statistics
  getStats(): ShotStats {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM shots');
    const todayStmt = this.db.prepare('SELECT COUNT(*) as count FROM shots WHERE time >= ?');
    const weekStmt = this.db.prepare('SELECT COUNT(*) as count FROM shots WHERE time >= ?');
    const avgDurationStmt = this.db.prepare('SELECT AVG(duration) as avg FROM shots WHERE duration > 0');
    
    const profileStmt = this.db.prepare(`
      SELECT profile_name as name, COUNT(*) as count 
      FROM shots 
      GROUP BY profile_name 
      ORDER BY count DESC 
      LIMIT 10
    `);
    
    const ratingStmt = this.db.prepare(`
      SELECT 
        SUM(CASE WHEN rating = 'like' THEN 1 ELSE 0 END) as likes,
        SUM(CASE WHEN rating = 'dislike' THEN 1 ELSE 0 END) as dislikes,
        SUM(CASE WHEN rating IS NULL THEN 1 ELSE 0 END) as unrated
      FROM shots
    `);

    const total = (totalStmt.get() as { count: number }).count;
    const today = (todayStmt.get(todayStart.getTime()) as { count: number }).count;
    const week = (weekStmt.get(weekStart.getTime()) as { count: number }).count;
    const avgDuration = (avgDurationStmt.get() as { avg: number | null }).avg || 0;
    const profiles = profileStmt.all() as { name: string; count: number }[];
    const ratings = ratingStmt.get() as { likes: number; dislikes: number; unrated: number };

    return {
      totalShots: total,
      todayShots: today,
      weekShots: week,
      avgDuration,
      profileBreakdown: profiles,
      ratingBreakdown: ratings
    };
  }

  // Cleanup old shots beyond max limit
  cleanup(): void {
    const stmt = this.db.prepare(`
      DELETE FROM shots WHERE id NOT IN (
        SELECT id FROM shots ORDER BY time DESC LIMIT ?
      )
    `);
    const result = stmt.run(config.cache.maxShots);
    if (result.changes > 0) {
      console.log(`Cleaned up ${result.changes} old shots from cache`);
    }
  }

  // Store machine info
  setMachineInfo(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO machine_info (key, value, updated_at)
      VALUES (?, ?, strftime('%s', 'now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    stmt.run(key, value);
  }

  getMachineInfo(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM machine_info WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value || null;
  }

  private extractDuration(shot: HistoryListingEntry | HistoryEntry): number {
    if ('data' in shot && shot.data && shot.data.length > 0) {
      const lastPoint = shot.data[shot.data.length - 1];
      return lastPoint.time / 1000; // Convert ms to seconds
    }
    return 0;
  }

  private extractYield(shot: HistoryListingEntry | HistoryEntry): number {
    if ('data' in shot && shot.data && shot.data.length > 0) {
      const lastPoint = shot.data[shot.data.length - 1];
      return lastPoint.shot?.weight || 0;
    }
    return 0;
  }

  close(): void {
    this.db.close();
  }
}

// Singleton instance
export const cacheManager = new CacheManager();

import { Router, Request, Response } from 'express';
import { meticulousClient, DATA_SERIES } from '../meticulous-client';
import { cacheManager } from '../cache';
import { config } from '../config';
import { ShotRating } from '@meticulous-home/espresso-api';

const router = Router();

// Get available data series configuration
router.get('/data-series', (req: Request, res: Response) => {
  res.json(DATA_SERIES);
});

// Get current machine status
router.get('/status', (req: Request, res: Response) => {
  const state = meticulousClient.getState();
  res.json({
    connected: state.connected,
    brewing: state.brewing,
    status: state.status,
    temperatures: state.temperatures,
    actuators: state.actuators
  });
});

// Get current shot data (real-time during brewing)
router.get('/current-shot', (req: Request, res: Response) => {
  const state = meticulousClient.getState();
  res.json({
    brewing: state.brewing,
    data: meticulousClient.getCurrentShot(),
    profile: state.status?.loaded_profile || null,
    profileId: state.status?.id || null
  });
});

// Get device info
router.get('/device', async (req: Request, res: Response) => {
  const deviceInfo = await meticulousClient.getDeviceInfo();
  if (deviceInfo) {
    res.json(deviceInfo);
  } else {
    res.status(503).json({ error: 'Unable to connect to machine' });
  }
});

// Get shot history (paginated)
router.get('/history', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const refresh = req.query.refresh === 'true';

  // Optionally refresh from machine
  if (refresh) {
    try {
      const machineHistory = await meticulousClient.getHistoryListing();
      for (const shot of machineHistory) {
        cacheManager.upsertShotListing(shot);
      }
    } catch (err) {
      console.error('Failed to refresh history from machine:', err);
    }
  }

  const shots = cacheManager.getShots(limit, offset);
  res.json({
    shots,
    limit,
    offset,
    hasMore: shots.length === limit
  });
});

// Get single shot details
router.get('/history/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid shot ID' });
  }

  // Check cache first
  let shot = cacheManager.getShot(id);
  
  // If we don't have full data, fetch from machine
  if (!shot || !shot.hasFullData) {
    try {
      const fullShot = await meticulousClient.getHistoryEntry(id);
      if (fullShot) {
        cacheManager.upsertFullShot(fullShot);
        shot = cacheManager.getShot(id);
      }
    } catch (err) {
      console.error('Failed to fetch shot from machine:', err);
    }
  }

  if (shot) {
    // Parse the data JSON if present
    const response: any = { ...shot };
    if (shot.data) {
      try {
        response.data = JSON.parse(shot.data);
      } catch {
        response.data = null;
      }
    }
    res.json(response);
  } else {
    res.status(404).json({ error: 'Shot not found' });
  }
});

// Rate a shot
router.post('/history/:id/rate', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  const { rating } = req.body as { rating: ShotRating };

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid shot ID' });
  }

  if (rating !== 'like' && rating !== 'dislike' && rating !== null) {
    return res.status(400).json({ error: 'Invalid rating. Use "like", "dislike", or null' });
  }

  // Update on machine
  const success = await meticulousClient.rateShot(id, rating);
  
  // Update local cache regardless (optimistic update)
  cacheManager.updateRating(id, rating);

  res.json({ success, id, rating });
});

// Get last shot
router.get('/last-shot', async (req: Request, res: Response) => {
  const lastShot = await meticulousClient.getLastShot();
  if (lastShot) {
    cacheManager.upsertFullShot(lastShot);
    res.json(lastShot);
  } else {
    // Fall back to cache
    const shots = cacheManager.getShots(1, 0);
    if (shots.length > 0) {
      res.json(shots[0]);
    } else {
      res.status(404).json({ error: 'No shots found' });
    }
  }
});

// Get statistics
router.get('/stats', async (req: Request, res: Response) => {
  const refresh = req.query.refresh === 'true';

  if (refresh) {
    // Get fresh stats from machine
    const machineStats = await meticulousClient.getHistoryStats();
    if (machineStats) {
      cacheManager.setMachineInfo('machineStats', JSON.stringify(machineStats));
    }
  }

  // Get local stats
  const localStats = cacheManager.getStats();
  
  // Get cached machine stats
  const machineStatsJson = cacheManager.getMachineInfo('machineStats');
  const machineStats = machineStatsJson ? JSON.parse(machineStatsJson) : null;

  res.json({
    local: localStats,
    machine: machineStats
  });
});

// Get profiles
router.get('/profiles', async (req: Request, res: Response) => {
  const profiles = await meticulousClient.listProfiles();
  res.json(profiles);
});

// Get app configuration (for frontend)
router.get('/config', (req: Request, res: Response) => {
  res.json({
    display: config.display,
    realtime: {
      sampleRate: config.realtime.sampleRate,
      maxGraphPoints: config.realtime.maxGraphPoints
    }
  });
});

// Update configuration
router.post('/config', (req: Request, res: Response) => {
  // For now, just validate and echo back
  // In the future, this could persist to local.json
  const { machineHost, machinePort } = req.body;
  
  res.json({
    message: 'Configuration update not yet implemented',
    received: { machineHost, machinePort }
  });
});

export default router;

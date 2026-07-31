import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';

// Cache in memory for fast retrieval
let configCache: Record<string, any> = {};
let lastCacheUpdate = 0;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

const fetchConfigsByCategory = async (category: string) => {
  const settings = await prisma.setting.findMany({ where: { category } });
  const map: Record<string, any> = {};
  for (const s of settings) {
    try {
      map[s.key] = JSON.parse(s.value);
    } catch {
      map[s.key] = s.value;
    }
  }
  return map;
};

const refreshCache = async () => {
  const now = Date.now();
  if (now - lastCacheUpdate < CACHE_TTL && Object.keys(configCache).length > 0) {
    return;
  }
  
  const [app, flags, remote] = await Promise.all([
    fetchConfigsByCategory('app_config'),
    fetchConfigsByCategory('feature_flag'),
    fetchConfigsByCategory('remote_config')
  ]);
  
  configCache = { app, flags, remote };
  lastCacheUpdate = now;
};

// ─── Get App Config ───
export const getAppConfig = async (req: any, res: Response, next: NextFunction) => {
  try {
    await refreshCache();
    // Fallback defaults if DB is empty
    const defaultConfig = {
      appName: 'Go Experts',
      currentVersion: '1.0.0',
      minSupportedVersion: '1.0.0',
      supportEmail: 'support@goexperts.com',
      defaultLanguage: 'en',
      ...configCache.app
    };
    return res.json(successResponse('App Configuration', defaultConfig));
  } catch (error) { next(error); }
};

// ─── Get Feature Flags ───
export const getFeatureFlags = async (req: any, res: Response, next: NextFunction) => {
  try {
    await refreshCache();
    return res.json(successResponse('Feature Flags', configCache.flags));
  } catch (error) { next(error); }
};

// ─── Get Remote Config ───
export const getRemoteConfig = async (req: any, res: Response, next: NextFunction) => {
  try {
    await refreshCache();
    return res.json(successResponse('Remote Config', configCache.remote));
  } catch (error) { next(error); }
};

// ─── Get App Version Details ───
export const getVersion = async (req: any, res: Response, next: NextFunction) => {
  try {
    await refreshCache();
    const vInfo = {
      currentVersion: configCache.app?.currentVersion || '1.0.0',
      minVersion: configCache.app?.minSupportedVersion || '1.0.0',
      forceUpdate: configCache.app?.forceUpdate || false,
      releaseNotes: configCache.app?.releaseNotes || 'Bug fixes and performance improvements.',
      apkUrl: configCache.app?.apkUrl || '',
      ipaUrl: configCache.app?.ipaUrl || ''
    };
    return res.json(successResponse('Version Info', vInfo));
  } catch (error) { next(error); }
};

// ─── Get Maintenance Mode ───
export const getMaintenance = async (req: any, res: Response, next: NextFunction) => {
  try {
    await refreshCache();
    const maintenance = {
      enabled: configCache.app?.maintenanceMode || false,
      message: configCache.app?.maintenanceMessage || 'We are undergoing scheduled maintenance. Please check back later.',
      estimatedEndTime: configCache.app?.maintenanceEndTime || null
    };
    return res.json(successResponse('Maintenance Status', maintenance));
  } catch (error) { next(error); }
};

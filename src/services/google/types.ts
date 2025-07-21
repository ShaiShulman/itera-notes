/**
 * Types for Google APIs caching system
 */

export interface CacheOptions {
  diskPersistence?: boolean;
  backupInterval?: number; // Number of sets before backup to disk
  cacheDir?: string;
}

export interface CacheStats {
  keys: number;
  hits: number;
  misses: number;
  hitRate: number;
  setsCount: number;
}

export interface CacheEntry<T> {
  data: T;
  ttl: number;
  timestamp: number;
}
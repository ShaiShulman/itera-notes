/**
 * Server-side cache service for Google APIs using node-cache with disk persistence
 */

import NodeCache from "node-cache";
import fs from "fs";
import path from "path";

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  PLACES_SEARCH: 7 * 24 * 60 * 60, // 7 days
  PLACES_DETAILS: 14 * 24 * 60 * 60, // 14 days
  PLACES_PHOTOS: 30 * 24 * 60 * 60, // 30 days
  DIRECTIONS: 3 * 24 * 60 * 60, // 3 days
} as const;

interface CacheOptions {
  diskPersistence?: boolean;
  backupInterval?: number; // Number of sets before backup to disk
  cacheDir?: string;
}

/**
 * Generate cache key for places API calls
 */
export function generatePlacesKey(
  method: string,
  ...params: (string | number)[]
): string {
  const cleanParams = params
    .map((p) => String(p).toLowerCase().trim().replace(/\s+/g, "_"))
    .join("|");
  return `places:${method}:${cleanParams}`;
}

/**
 * Generate cache key for directions API calls
 */
export function generateDirectionsKey(
  places: Array<{ lat: number; lng: number; name?: string }>,
  mode: string = "driving"
): string {
  // Create a stable key based on coordinates (rounded to avoid precision issues)
  const coordKey = places
    .map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`)
    .join("|");
  return `directions:${mode}:${coordKey}`;
}

/**
 * Enhanced cache service with disk persistence
 */
export class GoogleAPICache {
  private cache: NodeCache;
  private diskPersistence: boolean;
  private backupInterval: number;
  private cacheDir: string;
  private setCount: number = 0;
  private cacheFilePath: string;

  constructor(options: CacheOptions = {}) {
    this.cache = new NodeCache({
      stdTTL: CACHE_TTL.PLACES_DETAILS, // Default TTL
      checkperiod: 600, // Check for expired keys every 10 minutes
      useClones: false, // Better performance for immutable data
    });

    this.diskPersistence = options.diskPersistence ?? true;
    this.backupInterval = options.backupInterval ?? 50; // Backup every 50 sets
    this.cacheDir = options.cacheDir ?? path.join(process.cwd(), ".cache");
    this.cacheFilePath = path.join(this.cacheDir, "google-api-cache.json");

    // Ensure cache directory exists
    if (this.diskPersistence) {
      this.ensureCacheDir();
      this.loadFromDisk();
    }

    // Graceful shutdown - save cache before exit
    process.on("SIGINT", () => this.saveToDisk());
    process.on("SIGTERM", () => this.saveToDisk());
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const cacheData = fs.readFileSync(this.cacheFilePath, "utf8");
        const parsedData = JSON.parse(cacheData);

        // Restore cache entries with TTL validation
        let restoredCount = 0;
        const now = Math.floor(Date.now() / 1000);

        for (const [key, entry] of Object.entries(parsedData)) {
          const cacheEntry = entry as {
            data: any;
            ttl: number;
            timestamp: number;
          };

          // Check if entry is still valid
          if (
            cacheEntry.ttl === 0 ||
            cacheEntry.timestamp + cacheEntry.ttl > now
          ) {
            const remainingTTL =
              cacheEntry.ttl === 0
                ? 0
                : cacheEntry.timestamp + cacheEntry.ttl - now;
            this.cache.set(
              key,
              cacheEntry.data,
              remainingTTL || (this.cache.options.stdTTL as number)
            );
            restoredCount++;
          }
        }

        console.log(
          `📦 GoogleAPICache: Restored ${restoredCount} cached entries from disk`
        );
      }
    } catch (error) {
      console.warn("📦 GoogleAPICache: Failed to load cache from disk:", error);
    }
  }

  private saveToDisk(): void {
    if (!this.diskPersistence) return;

    try {
      const keys = this.cache.keys();
      const cacheData: Record<string, any> = {};
      const now = Math.floor(Date.now() / 1000);

      for (const key of keys) {
        const data = this.cache.get(key);
        const ttl = this.cache.getTtl(key);

        if (data !== undefined) {
          cacheData[key] = {
            data,
            ttl: ttl ? Math.floor((ttl - Date.now()) / 1000) : 0, // Convert to seconds
            timestamp: now,
          };
        }
      }

      fs.writeFileSync(this.cacheFilePath, JSON.stringify(cacheData, null, 2));
      console.log(`💾 GoogleAPICache: Saved ${keys.length} entries to disk`);
    } catch (error) {
      console.warn("💾 GoogleAPICache: Failed to save cache to disk:", error);
    }
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  /**
   * Set value in cache with TTL
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    const success = this.cache.set(
      key,
      value,
      ttl ?? (this.cache.options.stdTTL as number)
    );

    if (success) {
      this.setCount++;

      // Periodic disk backup
      if (this.diskPersistence && this.setCount % this.backupInterval === 0) {
        this.saveToDisk();
      }
    }

    return success;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete a specific key
   */
  delete(key: string): number {
    return this.cache.del(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.flushAll();

    if (this.diskPersistence) {
      this.saveToDisk(); // Save empty cache to disk
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const stats = this.cache.getStats();
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: (stats.hits / (stats.hits + stats.misses)) * 100,
      setsCount: this.setCount,
    };
  }

  /**
   * Get all cache keys (for debugging)
   */
  getKeys(): string[] {
    return this.cache.keys();
  }

  /**
   * Manual save to disk
   */
  forceSave(): void {
    if (this.diskPersistence) {
      this.saveToDisk();
    }
  }

  /**
   * Cache wrapper for API calls
   */
  async withCache<T>(
    key: string,
    apiCall: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Call API and cache result
    const result = await apiCall();
    this.set(key, result, ttl);
    return result;
  }
}

// Create singleton instance
export const googleAPICache = new GoogleAPICache({
  diskPersistence: true,
  backupInterval: 25, // Save to disk every 25 cache sets
  cacheDir: path.join(process.cwd(), ".cache", "google-apis"),
});

// Export for convenience
export default googleAPICache;

/**
 * DataCache - Enhanced NodeCache for places and directions data
 * Optimized for smaller data entries (~4-25KB) with better indexing and management
 */

import NodeCache from "node-cache";
import * as fs from "fs";
import * as path from "path";

interface DataCacheEntry {
  data: any;
  ttl: number;
  timestamp: number;
  size: number;
  type: "places" | "directions";
  accessCount: number;
  lastAccess: number;
}

interface DataCacheOptions {
  diskPersistence?: boolean;
  backupInterval?: number;
  cacheDir?: string;
  maxMemorySize?: number; // Maximum memory usage in bytes
  enableAnalytics?: boolean;
  cleanupInterval?: number; // Cleanup interval in ms
}

interface DataCacheStats {
  keys: number;
  memorySize: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
  typeBreakdown: {
    places: number;
    directions: number;
  };
  setsCount: number;
}

export class DataCache {
  private cache: NodeCache;
  private diskPersistence: boolean;
  private backupInterval: number;
  private cacheDir: string;
  private cacheFilePath: string;
  private maxMemorySize: number;
  private enableAnalytics: boolean;
  private setCount: number = 0;
  private currentMemorySize: number = 0;
  private stats: DataCacheStats;
  private metadata: Map<string, Omit<DataCacheEntry, "data">>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: DataCacheOptions = {}) {
    this.cache = new NodeCache({
      stdTTL: 24 * 60 * 60, // 24 hours default
      checkperiod: 600, // Check for expired keys every 10 minutes
      useClones: false, // Better performance for immutable data
    });

    this.diskPersistence = options.diskPersistence ?? true;
    this.backupInterval = options.backupInterval ?? 50;
    this.maxMemorySize = options.maxMemorySize ?? 50 * 1024 * 1024; // 50MB default
    this.enableAnalytics = options.enableAnalytics ?? true;
    this.cacheDir =
      options.cacheDir ?? path.join(process.cwd(), ".cache", "data");
    this.cacheFilePath = path.join(this.cacheDir, "data-cache.json");

    this.metadata = new Map();
    this.stats = {
      keys: 0,
      memorySize: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
      hitRate: 0,
      typeBreakdown: { places: 0, directions: 0 },
      setsCount: 0,
    };

    if (this.diskPersistence) {
      this.ensureCacheDir();
      this.loadFromDisk();
    }

    // Setup periodic cleanup
    if (options.cleanupInterval) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup();
      }, options.cleanupInterval);
    }

    // Graceful shutdown
    process.on("SIGINT", () => this.shutdown());
    process.on("SIGTERM", () => this.shutdown());

    // Listen to cache events for analytics
    if (this.enableAnalytics) {
      this.cache.on("set", (key: string) => {
        this.updateMetadata(key, "set");
      });

      this.cache.on("expired", (key: string) => {
        this.updateMetadata(key, "expired");
      });

      this.cache.on("del", (key: string) => {
        this.updateMetadata(key, "del");
      });
    }
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private updateMetadata(
    key: string,
    operation: "set" | "expired" | "del"
  ): void {
    const metadata = this.metadata.get(key);
    const type = this.getKeyType(key);

    if (operation === "set") {
      if (metadata) {
        metadata.accessCount++;
        metadata.lastAccess = Date.now();
      }
      this.stats.typeBreakdown[type]++;
    } else if (operation === "expired" || operation === "del") {
      if (metadata) {
        this.currentMemorySize -= metadata.size;
        this.metadata.delete(key);
        this.stats.typeBreakdown[type] = Math.max(
          0,
          this.stats.typeBreakdown[type] - 1
        );
      }
    }

    this.updateStats();
  }

  private getKeyType(key: string): "places" | "directions" {
    return key.startsWith("directions:") ? "directions" : "places";
  }

  private calculateDataSize(data: any): number {
    return Buffer.byteLength(JSON.stringify(data), "utf8");
  }

  private updateStats(): void {
    const cacheStats = this.cache.getStats();
    this.stats.keys = cacheStats.keys;
    this.stats.hits = cacheStats.hits;
    this.stats.misses = cacheStats.misses;
    this.stats.hitRate =
      (cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100 || 0;
    this.stats.memorySize = this.currentMemorySize;
    this.stats.setsCount = this.setCount;
  }

  private evictLRU(): boolean {
    if (this.metadata.size === 0) return false;

    // Find least recently used entry
    let lruKey = "";
    let oldestAccess = Date.now();

    for (const [key, metadata] of Array.from(this.metadata)) {
      if (metadata.lastAccess < oldestAccess) {
        oldestAccess = metadata.lastAccess;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.del(lruKey);
      this.stats.evictions++;
      console.log(
        `🗃️ DataCache: Evicted LRU entry: ${lruKey.substring(0, 30)}...`
      );
      return true;
    }

    return false;
  }

  private enforceMemoryLimit(): void {
    while (
      this.currentMemorySize > this.maxMemorySize &&
      this.metadata.size > 0
    ) {
      if (!this.evictLRU()) break;
    }
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const cacheData = fs.readFileSync(this.cacheFilePath, "utf8");
        const parsedData = JSON.parse(cacheData);

        let restoredCount = 0;
        const now = Math.floor(Date.now() / 1000);

        for (const [key, entry] of Object.entries(parsedData)) {
          const cacheEntry = entry as DataCacheEntry;

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

            // Store metadata
            const { ...metadata } = cacheEntry;
            this.metadata.set(key, metadata);
            this.currentMemorySize += metadata.size;
            this.stats.typeBreakdown[metadata.type]++;

            restoredCount++;
          }
        }

        this.updateStats();
        console.log(
          `🗃️ DataCache: Restored ${restoredCount} data entries from disk`
        );
      }
    } catch (error) {
      console.warn("🗃️ DataCache: Failed to load cache from disk:", error);
    }
  }

  private saveToDisk(): void {
    if (!this.diskPersistence) return;

    try {
      const keys = this.cache.keys();
      const cacheData: Record<string, DataCacheEntry> = {};
      const now = Math.floor(Date.now() / 1000);

      for (const key of keys) {
        const data = this.cache.get(key);
        const ttl = this.cache.getTtl(key);
        const metadata = this.metadata.get(key);

        if (data !== undefined && metadata) {
          cacheData[key] = {
            data,
            ttl: ttl ? Math.floor((ttl - Date.now()) / 1000) : 0,
            timestamp: now,
            size: metadata.size,
            type: metadata.type,
            accessCount: metadata.accessCount,
            lastAccess: metadata.lastAccess,
          };
        }
      }

      fs.writeFileSync(this.cacheFilePath, JSON.stringify(cacheData, null, 2));
      console.log(`💾 DataCache: Saved ${keys.length} entries to disk`);
    } catch (error) {
      console.warn("💾 DataCache: Failed to save cache to disk:", error);
    }
  }

  get<T>(key: string): T | undefined {
    const data = this.cache.get<T>(key);

    if (data !== undefined) {
      // Update access tracking
      const metadata = this.metadata.get(key);
      if (metadata) {
        metadata.accessCount++;
        metadata.lastAccess = Date.now();
      }
    }

    this.updateStats();
    return data;
  }

  set<T>(key: string, value: T, ttl?: number): boolean {
    const dataSize = this.calculateDataSize(value);
    const type = this.getKeyType(key);

    // Check memory constraints
    const wouldExceedMemory =
      this.currentMemorySize + dataSize > this.maxMemorySize;

    if (wouldExceedMemory) {
      this.enforceMemoryLimit();
    }

    // Remove old entry if updating
    const existingMetadata = this.metadata.get(key);
    if (existingMetadata) {
      this.currentMemorySize -= existingMetadata.size;
    }

    const success = this.cache.set(
      key,
      value,
      ttl ?? (this.cache.options.stdTTL as number)
    );

    if (success) {
      // Store metadata
      const metadata = {
        ttl: ttl || 0,
        timestamp: Math.floor(Date.now() / 1000),
        size: dataSize,
        type,
        accessCount: 0,
        lastAccess: Date.now(),
      };

      this.metadata.set(key, metadata);
      this.currentMemorySize += dataSize;
      this.setCount++;

      // Periodic disk backup
      if (this.diskPersistence && this.setCount % this.backupInterval === 0) {
        this.saveToDisk();
      }

      this.updateStats();
    }

    return success;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  delete(key: string): number {
    const metadata = this.metadata.get(key);
    if (metadata) {
      this.currentMemorySize -= metadata.size;
      this.metadata.delete(key);
      this.stats.typeBreakdown[metadata.type] = Math.max(
        0,
        this.stats.typeBreakdown[metadata.type] - 1
      );
    }

    const result = this.cache.del(key);
    this.updateStats();
    return result;
  }

  clear(): void {
    this.cache.flushAll();
    this.metadata.clear();
    this.currentMemorySize = 0;
    this.stats.typeBreakdown = { places: 0, directions: 0 };

    if (this.diskPersistence) {
      this.saveToDisk();
    }

    this.updateStats();
    console.log("🗃️ DataCache: Cleared all entries");
  }

  getStats(): DataCacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  getKeys(): string[] {
    return this.cache.keys();
  }

  getKeysByType(type: "places" | "directions"): string[] {
    return this.cache.keys().filter((key) => this.getKeyType(key) === type);
  }

  forceSave(): void {
    if (this.diskPersistence) {
      this.saveToDisk();
    }
  }

  async cleanup(): Promise<{ removed: number; memoryFreed: number }> {
    let removed = 0;
    let memoryFreed = 0;
    const now = Math.floor(Date.now() / 1000);

    // Clean up expired metadata entries
    for (const [key, metadata] of Array.from(this.metadata)) {
      if (
        !this.cache.has(key) ||
        (metadata.ttl > 0 && metadata.timestamp + metadata.ttl <= now)
      ) {
        memoryFreed += metadata.size;
        this.metadata.delete(key);
        this.currentMemorySize -= metadata.size;
        this.stats.typeBreakdown[metadata.type] = Math.max(
          0,
          this.stats.typeBreakdown[metadata.type] - 1
        );
        removed++;
      }
    }

    if (removed > 0) {
      this.updateStats();
      console.log(
        `🗃️ DataCache: Cleaned up ${removed} expired entries (${Math.round(
          memoryFreed / 1024
        )}KB freed)`
      );
    }

    return { removed, memoryFreed };
  }

  private shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.saveToDisk();
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

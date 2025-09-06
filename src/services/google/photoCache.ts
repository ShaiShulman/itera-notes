/**
 * PhotoCache - File-based cache for large photo data
 * Optimized for storing ~74KB photo entries with efficient file system operations
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

interface PhotoCacheEntry {
  data: string;
  ttl: number;
  timestamp: number;
  size: number;
  accessCount: number;
  lastAccess: number;
}

interface PhotoCacheOptions {
  cacheDir?: string;
  maxSize?: number; // Maximum cache size in bytes
  maxFiles?: number; // Maximum number of files
  enableLRU?: boolean;
  compressionLevel?: number;
}

interface PhotoCacheStats {
  totalFiles: number;
  totalSize: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
}

export class PhotoCache {
  private cacheDir: string;
  private metadataFile: string;
  private metadata: Map<string, PhotoCacheEntry>;
  private maxSize: number;
  private maxFiles: number;
  private enableLRU: boolean;
  private stats: PhotoCacheStats;

  constructor(options: PhotoCacheOptions = {}) {
    this.cacheDir =
      options.cacheDir ?? path.join(process.cwd(), ".cache", "photos");
    this.metadataFile = path.join(this.cacheDir, "metadata.json");
    this.maxSize = options.maxSize ?? 500 * 1024 * 1024; // 500MB default
    this.maxFiles = options.maxFiles ?? 5000; // 5k files default
    this.enableLRU = options.enableLRU ?? true;
    this.metadata = new Map();
    this.stats = {
      totalFiles: 0,
      totalSize: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
      hitRate: 0,
    };

    this.ensureCacheDir();
    this.loadMetadata();

    // Graceful shutdown
    process.on("SIGINT", () => this.saveMetadata());
    process.on("SIGTERM", () => this.saveMetadata());
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    // Create hash-based subdirectories (0-f)
    for (let i = 0; i < 16; i++) {
      const subDir = path.join(this.cacheDir, i.toString(16));
      if (!fs.existsSync(subDir)) {
        fs.mkdirSync(subDir, { recursive: true });
      }
    }
  }

  private getFilePath(key: string): string {
    const hash = crypto.createHash("md5").update(key).digest("hex");
    const subDir = hash.charAt(0);
    return path.join(this.cacheDir, subDir, `${hash}.cache`);
  }

  private loadMetadata(): void {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const metadataJson = fs.readFileSync(this.metadataFile, "utf8");
        const metadataObj = JSON.parse(metadataJson);

        // Convert to Map and validate entries
        let validEntries = 0;
        const now = Math.floor(Date.now() / 1000);

        for (const [key, entry] of Object.entries(metadataObj)) {
          const cacheEntry = entry as PhotoCacheEntry;

          // Check if entry is still valid and file exists
          const isValid =
            (cacheEntry.ttl === 0 ||
              cacheEntry.timestamp + cacheEntry.ttl > now) &&
            fs.existsSync(this.getFilePath(key));

          if (isValid) {
            this.metadata.set(key, cacheEntry);
            this.stats.totalSize += cacheEntry.size;
            validEntries++;
          } else {
            // Clean up invalid file
            const filePath = this.getFilePath(key);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        }

        this.stats.totalFiles = validEntries;
        console.log(
          `📸 PhotoCache: Loaded ${validEntries} valid photo entries`
        );
      }
    } catch (error) {
      console.warn("📸 PhotoCache: Failed to load metadata:", error);
      this.metadata.clear();
    }
  }

  private saveMetadata(): void {
    try {
      const metadataObj = Object.fromEntries(this.metadata);
      fs.writeFileSync(this.metadataFile, JSON.stringify(metadataObj, null, 2));
    } catch (error) {
      console.warn("📸 PhotoCache: Failed to save metadata:", error);
    }
  }

  private evictLRU(): void {
    if (!this.enableLRU || this.metadata.size === 0) return;

    // Find least recently used entry
    let lruKey = "";
    let oldestAccess = Date.now();

    for (const [key, entry] of Array.from(this.metadata)) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.delete(lruKey);
      this.stats.evictions++;
      console.log(
        `📸 PhotoCache: Evicted LRU entry: ${lruKey.substring(0, 20)}...`
      );
    }
  }

  private enforceConstraints(): void {
    // Enforce size limit
    while (this.stats.totalSize > this.maxSize && this.metadata.size > 0) {
      this.evictLRU();
    }

    // Enforce file count limit
    while (this.stats.totalFiles > this.maxFiles && this.metadata.size > 0) {
      this.evictLRU();
    }
  }

  get<T = string>(key: string): T | undefined {
    const entry = this.metadata.get(key);
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    // Check TTL
    const now = Math.floor(Date.now() / 1000);
    if (entry.ttl > 0 && entry.timestamp + entry.ttl <= now) {
      this.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    try {
      const filePath = this.getFilePath(key);
      const data = fs.readFileSync(filePath, "utf8");

      // Update access tracking
      entry.accessCount++;
      entry.lastAccess = Date.now();
      this.metadata.set(key, entry);

      this.stats.hits++;
      this.updateHitRate();

      return data as T;
    } catch (error) {
      console.warn(`📸 PhotoCache: Failed to get ${key}:`, error);
      this.metadata.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }
  }

  set<T = string>(key: string, value: T, ttl: number = 0): boolean {
    try {
      const data = typeof value === "string" ? value : JSON.stringify(value);
      const filePath = this.getFilePath(key);
      const size = Buffer.byteLength(data, "utf8");

      // Check if we need to evict before adding
      const wouldExceedSize = this.stats.totalSize + size > this.maxSize;
      const wouldExceedCount = this.stats.totalFiles + 1 > this.maxFiles;

      if (wouldExceedSize || wouldExceedCount) {
        this.enforceConstraints();
      }

      // Remove old entry if updating
      const existingEntry = this.metadata.get(key);
      if (existingEntry) {
        this.stats.totalSize -= existingEntry.size;
        this.stats.totalFiles--;
      }

      // Write to file
      fs.writeFileSync(filePath, data, "utf8");

      // Update metadata
      const entry: PhotoCacheEntry = {
        data: "", // Don't store data in metadata
        ttl,
        timestamp: Math.floor(Date.now() / 1000),
        size,
        accessCount: 0,
        lastAccess: Date.now(),
      };

      this.metadata.set(key, entry);
      this.stats.totalSize += size;
      this.stats.totalFiles++;

      // Periodic metadata save (every 25 sets)
      if (this.stats.totalFiles % 25 === 0) {
        this.saveMetadata();
      }

      return true;
    } catch (error) {
      console.warn(`📸 PhotoCache: Failed to set ${key}:`, error);
      return false;
    }
  }

  has(key: string): boolean {
    const entry = this.metadata.get(key);
    if (!entry) return false;

    // Check TTL
    const now = Math.floor(Date.now() / 1000);
    if (entry.ttl > 0 && entry.timestamp + entry.ttl <= now) {
      this.delete(key);
      return false;
    }

    return fs.existsSync(this.getFilePath(key));
  }

  delete(key: string): boolean {
    const entry = this.metadata.get(key);
    if (!entry) return false;

    try {
      const filePath = this.getFilePath(key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      this.metadata.delete(key);
      this.stats.totalSize -= entry.size;
      this.stats.totalFiles--;

      return true;
    } catch (error) {
      console.warn(`📸 PhotoCache: Failed to delete ${key}:`, error);
      return false;
    }
  }

  clear(): void {
    try {
      // Delete all cache files
      for (const key of this.metadata.keys()) {
        const filePath = this.getFilePath(key);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      this.metadata.clear();
      this.stats.totalFiles = 0;
      this.stats.totalSize = 0;
      this.saveMetadata();

      console.log("📸 PhotoCache: Cleared all entries");
    } catch (error) {
      console.warn("📸 PhotoCache: Error during clear:", error);
    }
  }

  getStats(): PhotoCacheStats {
    return { ...this.stats };
  }

  getKeys(): string[] {
    return [...this.metadata.keys()];
  }

  forceSave(): void {
    this.saveMetadata();
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Cleanup expired entries and optimize storage
   */
  async cleanup(): Promise<{ removed: number; sizeFreed: number }> {
    let removed = 0;
    let sizeFreed = 0;
    const now = Math.floor(Date.now() / 1000);

    for (const [key, entry] of Array.from(this.metadata)) {
      // Check if expired
      if (entry.ttl > 0 && entry.timestamp + entry.ttl <= now) {
        sizeFreed += entry.size;
        this.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      this.saveMetadata();
      console.log(
        `📸 PhotoCache: Cleaned up ${removed} expired entries (${Math.round(
          sizeFreed / 1024
        )}KB freed)`
      );
    }

    return { removed, sizeFreed };
  }
}

/**
 * SegmentedCache - Orchestrator for PhotoCache and DataCache
 * Provides unified interface while routing to optimal cache based on data type
 */

import { PhotoCache } from "./photoCache";
import { DataCache } from "./dataCache";
import * as path from "path";

interface SegmentedCacheOptions {
  cacheDir?: string;
  photoCache?: {
    maxSize?: number;
    maxFiles?: number;
    enableLRU?: boolean;
  };
  dataCache?: {
    maxMemorySize?: number;
    backupInterval?: number;
    cleanupInterval?: number;
  };
  enableAnalytics?: boolean;
}

interface SegmentedCacheStats {
  photos: {
    totalFiles: number;
    totalSize: number;
    hits: number;
    misses: number;
    evictions: number;
    hitRate: number;
  };
  data: {
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
  };
  combined: {
    totalKeys: number;
    totalSize: number;
    totalHits: number;
    totalMisses: number;
    overallHitRate: number;
  };
}

export class SegmentedCache {
  private photoCache: PhotoCache;
  private dataCache: DataCache;
  private enableAnalytics: boolean;

  constructor(options: SegmentedCacheOptions = {}) {
    const baseDir = options.cacheDir ?? path.join(process.cwd(), ".cache", "google-apis");
    this.enableAnalytics = options.enableAnalytics ?? true;

    // Initialize PhotoCache for image data
    this.photoCache = new PhotoCache({
      cacheDir: path.join(baseDir, "photos"),
      maxSize: options.photoCache?.maxSize ?? 500 * 1024 * 1024, // 500MB
      maxFiles: options.photoCache?.maxFiles ?? 5000,
      enableLRU: options.photoCache?.enableLRU ?? true,
    });

    // Initialize DataCache for places and directions
    this.dataCache = new DataCache({
      cacheDir: path.join(baseDir, "data"),
      maxMemorySize: options.dataCache?.maxMemorySize ?? 50 * 1024 * 1024, // 50MB
      backupInterval: options.dataCache?.backupInterval ?? 25,
      cleanupInterval: options.dataCache?.cleanupInterval ?? 5 * 60 * 1000, // 5 minutes
      enableAnalytics: this.enableAnalytics,
      diskPersistence: true,
    });

    console.log("🔄 SegmentedCache: Initialized with photo and data cache segments");
  }

  /**
   * Determine which cache to use based on key pattern
   */
  private isPhotoKey(key: string): boolean {
    return key.includes("photos");
  }

  /**
   * Get value from appropriate cache segment
   */
  get<T>(key: string): T | undefined {
    if (this.isPhotoKey(key)) {
      return this.photoCache.get<T>(key);
    } else {
      return this.dataCache.get<T>(key);
    }
  }

  /**
   * Set value in appropriate cache segment
   */
  set<T>(key: string, value: T, ttl?: number): boolean {
    if (this.isPhotoKey(key)) {
      return this.photoCache.set(key, value, ttl || 90 * 24 * 60 * 60); // 90 days for photos
    } else {
      // Determine appropriate TTL for data based on key type
      let defaultTtl = 30 * 24 * 60 * 60; // 30 days for places details
      
      if (key.includes("search")) {
        defaultTtl = 14 * 24 * 60 * 60; // 14 days for search results
      } else if (key.startsWith("directions:")) {
        defaultTtl = 7 * 24 * 60 * 60; // 7 days for directions
      }

      return this.dataCache.set(key, value, ttl || defaultTtl);
    }
  }

  /**
   * Check if key exists in appropriate cache segment
   */
  has(key: string): boolean {
    if (this.isPhotoKey(key)) {
      return this.photoCache.has(key);
    } else {
      return this.dataCache.has(key);
    }
  }

  /**
   * Delete key from appropriate cache segment
   */
  delete(key: string): boolean | number {
    if (this.isPhotoKey(key)) {
      return this.photoCache.delete(key);
    } else {
      return this.dataCache.delete(key) > 0;
    }
  }

  /**
   * Clear all cache segments
   */
  clear(): void {
    this.photoCache.clear();
    this.dataCache.clear();
    console.log("🔄 SegmentedCache: Cleared all cache segments");
  }

  /**
   * Clear specific cache segment
   */
  clearSegment(segment: "photos" | "data"): void {
    if (segment === "photos") {
      this.photoCache.clear();
      console.log("🔄 SegmentedCache: Cleared photo segment");
    } else {
      this.dataCache.clear();
      console.log("🔄 SegmentedCache: Cleared data segment");
    }
  }

  /**
   * Get all cache keys from both segments
   */
  getKeys(): string[] {
    return [
      ...this.photoCache.getKeys(),
      ...this.dataCache.getKeys(),
    ];
  }

  /**
   * Get keys by segment
   */
  getKeysBySegment(segment: "photos" | "data"): string[] {
    if (segment === "photos") {
      return this.photoCache.getKeys();
    } else {
      return this.dataCache.getKeys();
    }
  }

  /**
   * Get keys by data type
   */
  getKeysByType(type: "photos" | "places" | "directions"): string[] {
    if (type === "photos") {
      return this.photoCache.getKeys();
    } else {
      return this.dataCache.getKeysByType(type);
    }
  }

  /**
   * Force save both cache segments to disk
   */
  forceSave(): void {
    this.photoCache.forceSave();
    this.dataCache.forceSave();
    console.log("💾 SegmentedCache: Forced save of all segments");
  }

  /**
   * Get comprehensive statistics from both cache segments
   */
  getStats(): SegmentedCacheStats {
    const photoStats = this.photoCache.getStats();
    const dataStats = this.dataCache.getStats();

    const combined = {
      totalKeys: photoStats.totalFiles + dataStats.keys,
      totalSize: photoStats.totalSize + dataStats.memorySize,
      totalHits: photoStats.hits + dataStats.hits,
      totalMisses: photoStats.misses + dataStats.misses,
      overallHitRate: 0,
    };

    const totalRequests = combined.totalHits + combined.totalMisses;
    combined.overallHitRate = totalRequests > 0 ? (combined.totalHits / totalRequests) * 100 : 0;

    return {
      photos: photoStats,
      data: dataStats,
      combined,
    };
  }

  /**
   * Cleanup expired entries in both cache segments
   */
  async cleanup(): Promise<{
    photos: { removed: number; sizeFreed: number };
    data: { removed: number; memoryFreed: number };
  }> {
    const [photosResult, dataResult] = await Promise.all([
      this.photoCache.cleanup(),
      this.dataCache.cleanup(),
    ]);

    console.log(`🧹 SegmentedCache: Cleanup complete - Photos: ${photosResult.removed} removed, Data: ${dataResult.removed} removed`);

    return {
      photos: photosResult,
      data: dataResult,
    };
  }

  /**
   * Cache wrapper for API calls - automatically routes to appropriate segment
   */
  async withCache<T>(
    key: string,
    apiCall: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Call API and cache result in appropriate segment
    const result = await apiCall();
    this.set(key, result, ttl);
    return result;
  }

  /**
   * Batch get operation for multiple keys
   */
  getBatch<T>(keys: string[]): Map<string, T> {
    const results = new Map<string, T>();
    
    for (const key of keys) {
      const value = this.get<T>(key);
      if (value !== undefined) {
        results.set(key, value);
      }
    }
    
    return results;
  }

  /**
   * Batch set operation for multiple key-value pairs
   */
  setBatch<T>(entries: Array<{ key: string; value: T; ttl?: number }>): number {
    let successCount = 0;
    
    for (const entry of entries) {
      if (this.set(entry.key, entry.value, entry.ttl)) {
        successCount++;
      }
    }
    
    return successCount;
  }

  /**
   * Get cache health information
   */
  getHealth(): {
    status: "healthy" | "warning" | "critical";
    issues: string[];
    recommendations: string[];
  } {
    const stats = this.getStats();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check photo cache health
    if (stats.photos.hitRate < 70) {
      issues.push(`Low photo cache hit rate: ${stats.photos.hitRate.toFixed(1)}%`);
      recommendations.push("Consider increasing photo cache size or adjusting TTL");
    }

    if (stats.photos.totalSize > 450 * 1024 * 1024) { // 90% of 500MB limit
      issues.push("Photo cache approaching size limit");
      recommendations.push("Consider running cleanup or increasing cache size");
    }

    // Check data cache health
    if (stats.data.hitRate < 80) {
      issues.push(`Low data cache hit rate: ${stats.data.hitRate.toFixed(1)}%`);
      recommendations.push("Consider increasing data cache memory or adjusting TTL");
    }

    if (stats.data.memorySize > 45 * 1024 * 1024) { // 90% of 50MB limit
      issues.push("Data cache approaching memory limit");
      recommendations.push("Consider running cleanup or increasing memory limit");
    }

    // Determine overall status
    let status: "healthy" | "warning" | "critical" = "healthy";
    if (issues.length > 0) {
      status = issues.length > 2 ? "critical" : "warning";
    }

    return { status, issues, recommendations };
  }

  /**
   * Get cache segment information
   */
  getSegmentInfo(): {
    photos: { enabled: boolean; keys: number; sizeGB: number };
    data: { enabled: boolean; keys: number; sizeMB: number };
  } {
    const stats = this.getStats();
    
    return {
      photos: {
        enabled: true,
        keys: stats.photos.totalFiles,
        sizeGB: Math.round((stats.photos.totalSize / (1024 * 1024 * 1024)) * 100) / 100,
      },
      data: {
        enabled: true,
        keys: stats.data.keys,
        sizeMB: Math.round((stats.data.memorySize / (1024 * 1024)) * 100) / 100,
      },
    };
  }
}
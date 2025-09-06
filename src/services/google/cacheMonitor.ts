/**
 * Cache monitoring and analytics for Google API cache system
 * 
 * Features:
 * - Real-time metrics collection (hits, misses, sizes, evictions)
 * - Automated alerts for performance/capacity issues  
 * - Performance reports with cost savings estimates
 * - Health scoring with optimization recommendations
 * - Export to JSON/CSV formats
 * 
 * Works with both SegmentedCache and DatabaseSegmentedCache implementations.
 */

import * as fs from "fs";
import * as path from "path";
import { SegmentedCache } from "./segmentedCache";
import { DatabaseSegmentedCache } from "./databaseSegmentedCache";
import { googleAPICache } from "./cache";

interface CacheMetrics {
  timestamp: number;
  photos: {
    totalFiles: number;
    totalSize: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
  };
  data: {
    keys: number;
    memorySize: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
    typeBreakdown: {
      places: number;
      directions: number;
    };
  };
  combined: {
    totalKeys: number;
    totalSize: number;
    overallHitRate: number;
  };
  system: {
    uptime: number;
    nodeMemoryUsage: NodeJS.MemoryUsage;
  };
}

interface PerformanceReport {
  period: string;
  startTime: number;
  endTime: number;
  metrics: {
    requestCount: number;
    cacheHitRate: number;
    averageResponseTime: number;
    apiCallsSaved: number;
    estimatedCostSavings: number;
  };
  topKeys: Array<{ key: string; accessCount: number; type: string }>;
  recommendations: string[];
}

interface CacheAlert {
  level: "info" | "warning" | "critical";
  type: "performance" | "capacity" | "error" | "health";
  message: string;
  timestamp: number;
  metrics?: any;
}

export class CacheMonitor {
  private cache: SegmentedCache | DatabaseSegmentedCache;
  private metricsHistory: CacheMetrics[] = [];
  private alerts: CacheAlert[] = [];
  private reportDir: string;
  private monitoringInterval?: NodeJS.Timeout;
  private alertThresholds: {
    lowHitRate: number;
    highMemoryUsage: number;
    highEvictionRate: number;
  };
  private startTime: number;

  constructor(
    cache: SegmentedCache | DatabaseSegmentedCache = googleAPICache,
    options: {
      reportDir?: string;
      monitoringInterval?: number;
      alertThresholds?: {
        lowHitRate?: number;
        highMemoryUsage?: number;
        highEvictionRate?: number;
      };
    } = {}
  ) {
    this.cache = cache;
    this.reportDir = options.reportDir ?? path.join(process.cwd(), ".cache", "reports");
    this.alertThresholds = {
      lowHitRate: options.alertThresholds?.lowHitRate ?? 70,
      highMemoryUsage: options.alertThresholds?.highMemoryUsage ?? 80, // 80% of limit
      highEvictionRate: options.alertThresholds?.highEvictionRate ?? 10, // 10 evictions per minute
    };
    this.startTime = Date.now();

    this.ensureReportDir();

    // Start monitoring if interval provided
    if (options.monitoringInterval) {
      this.startMonitoring(options.monitoringInterval);
    }
  }

  private ensureReportDir(): void {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  /**
   * Start continuous monitoring with specified interval
   */
  startMonitoring(intervalMs: number = 60000): void { // Default 1 minute
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.checkAlerts();
    }, intervalMs);

    console.log(`📊 Cache monitoring started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      console.log("📊 Cache monitoring stopped");
    }
  }

  /**
   * Collect current cache metrics
   */
  collectMetrics(): CacheMetrics {
    const stats = this.cache.getStats();
    const metrics: CacheMetrics = {
      timestamp: Date.now(),
      photos: stats.photos,
      data: stats.data,
      combined: stats.combined,
      system: {
        uptime: Date.now() - this.startTime,
        nodeMemoryUsage: process.memoryUsage(),
      },
    };

    // Store in history (keep last 1440 entries = 24 hours at 1-minute intervals)
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > 1440) {
      this.metricsHistory.shift();
    }

    return metrics;
  }

  /**
   * Check for alert conditions
   */
  private checkAlerts(): void {
    const currentMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    if (!currentMetrics) return;

    // Check hit rates
    if (currentMetrics.photos.hitRate < this.alertThresholds.lowHitRate) {
      this.addAlert({
        level: "warning",
        type: "performance",
        message: `Low photo cache hit rate: ${currentMetrics.photos.hitRate.toFixed(1)}%`,
        timestamp: Date.now(),
        metrics: { hitRate: currentMetrics.photos.hitRate },
      });
    }

    if (currentMetrics.data.hitRate < this.alertThresholds.lowHitRate) {
      this.addAlert({
        level: "warning",
        type: "performance",
        message: `Low data cache hit rate: ${currentMetrics.data.hitRate.toFixed(1)}%`,
        timestamp: Date.now(),
        metrics: { hitRate: currentMetrics.data.hitRate },
      });
    }

    // Check memory usage (photo cache size vs limit)
    const photoMemoryPercent = (currentMetrics.photos.totalSize / (500 * 1024 * 1024)) * 100;
    if (photoMemoryPercent > this.alertThresholds.highMemoryUsage) {
      this.addAlert({
        level: photoMemoryPercent > 95 ? "critical" : "warning",
        type: "capacity",
        message: `High photo cache usage: ${photoMemoryPercent.toFixed(1)}% of limit`,
        timestamp: Date.now(),
        metrics: { usagePercent: photoMemoryPercent },
      });
    }

    // Check data memory usage
    const dataMemoryPercent = (currentMetrics.data.memorySize / (50 * 1024 * 1024)) * 100;
    if (dataMemoryPercent > this.alertThresholds.highMemoryUsage) {
      this.addAlert({
        level: dataMemoryPercent > 95 ? "critical" : "warning",
        type: "capacity",
        message: `High data cache memory usage: ${dataMemoryPercent.toFixed(1)}% of limit`,
        timestamp: Date.now(),
        metrics: { usagePercent: dataMemoryPercent },
      });
    }

    // Check eviction rates (if we have previous metrics)
    if (this.metricsHistory.length > 1) {
      const previousMetrics = this.metricsHistory[this.metricsHistory.length - 2];
      const photoEvictionRate = currentMetrics.photos.evictions - previousMetrics.photos.evictions;
      const dataEvictionRate = currentMetrics.data.evictions - previousMetrics.data.evictions;

      if (photoEvictionRate > this.alertThresholds.highEvictionRate) {
        this.addAlert({
          level: "warning",
          type: "performance",
          message: `High photo eviction rate: ${photoEvictionRate} evictions/minute`,
          timestamp: Date.now(),
          metrics: { evictionRate: photoEvictionRate },
        });
      }

      if (dataEvictionRate > this.alertThresholds.highEvictionRate) {
        this.addAlert({
          level: "warning",
          type: "performance",
          message: `High data eviction rate: ${dataEvictionRate} evictions/minute`,
          timestamp: Date.now(),
          metrics: { evictionRate: dataEvictionRate },
        });
      }
    }
  }

  private addAlert(alert: CacheAlert): void {
    this.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    // Log critical alerts immediately
    if (alert.level === "critical") {
      console.error(`🚨 CRITICAL CACHE ALERT: ${alert.message}`);
    } else if (alert.level === "warning") {
      console.warn(`⚠️ CACHE WARNING: ${alert.message}`);
    }
  }

  /**
   * Generate performance report for a given time period
   */
  generateReport(
    periodHours: number = 24,
    options: { includeRecommendations?: boolean } = {}
  ): PerformanceReport {
    const { includeRecommendations = true } = options;
    const endTime = Date.now();
    const startTime = endTime - (periodHours * 60 * 60 * 1000);
    
    // Filter metrics for the period
    const periodMetrics = this.metricsHistory.filter(
      m => m.timestamp >= startTime && m.timestamp <= endTime
    );

    if (periodMetrics.length === 0) {
      throw new Error("No metrics available for the specified period");
    }

    // Calculate aggregated metrics
    const totalRequests = periodMetrics.reduce((sum, m) => 
      sum + m.photos.hits + m.photos.misses + m.data.hits + m.data.misses, 0
    );
    
    const totalHits = periodMetrics.reduce((sum, m) => 
      sum + m.photos.hits + m.data.hits, 0
    );
    
    const cacheHitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

    // Estimate API calls saved and cost savings
    const apiCallsSaved = totalHits;
    const estimatedCostSavings = this.calculateCostSavings(periodMetrics);

    const report: PerformanceReport = {
      period: `${periodHours} hours`,
      startTime,
      endTime,
      metrics: {
        requestCount: totalRequests,
        cacheHitRate,
        averageResponseTime: 0, // Would need to implement response time tracking
        apiCallsSaved,
        estimatedCostSavings,
      },
      topKeys: [], // Would need to implement key access tracking
      recommendations: includeRecommendations ? this.generateRecommendations(periodMetrics) : [],
    };

    return report;
  }

  private calculateCostSavings(metrics: CacheMetrics[]): number {
    // Rough estimates based on Google API pricing
    const photoCost = 0.007; // $0.007 per 1000 photo requests
    const placesCost = 0.032; // $0.032 per 1000 place requests
    const directionsCost = 0.005; // $0.005 per 1000 direction requests

    let totalSavings = 0;
    
    for (const metric of metrics) {
      totalSavings += (metric.photos.hits / 1000) * photoCost;
      totalSavings += (metric.data.hits / 1000) * (placesCost + directionsCost) / 2; // Average
    }

    return totalSavings;
  }

  private generateRecommendations(metrics: CacheMetrics[]): string[] {
    const recommendations: string[] = [];
    
    if (metrics.length === 0) return recommendations;
    
    const latestMetrics = metrics[metrics.length - 1];
    
    // Hit rate recommendations
    if (latestMetrics.photos.hitRate < 80) {
      recommendations.push("Consider increasing photo cache size or TTL to improve hit rate");
    }
    
    if (latestMetrics.data.hitRate < 85) {
      recommendations.push("Consider increasing data cache memory or TTL to improve hit rate");
    }

    // Capacity recommendations
    const photoUsage = (latestMetrics.photos.totalSize / (500 * 1024 * 1024)) * 100;
    if (photoUsage > 80) {
      recommendations.push("Photo cache approaching capacity - consider increasing size limit");
    }

    const dataUsage = (latestMetrics.data.memorySize / (50 * 1024 * 1024)) * 100;
    if (dataUsage > 80) {
      recommendations.push("Data cache approaching memory limit - consider increasing allocation");
    }

    // Eviction recommendations
    if (latestMetrics.photos.evictions > 100) {
      recommendations.push("High photo eviction count - consider increasing cache size or implementing better LRU");
    }

    if (latestMetrics.data.evictions > 50) {
      recommendations.push("High data eviction count - consider increasing memory allocation");
    }

    // Balance recommendations
    const photoToDataRatio = latestMetrics.photos.totalFiles / Math.max(1, latestMetrics.data.keys);
    if (photoToDataRatio > 10) {
      recommendations.push("Photo cache significantly larger than data cache - consider rebalancing resources");
    }

    return recommendations;
  }

  /**
   * Get recent alerts
   */
  getAlerts(level?: "info" | "warning" | "critical", limit: number = 20): CacheAlert[] {
    const filteredAlerts = level ? 
      this.alerts.filter(alert => alert.level === level) : 
      this.alerts;
    
    return filteredAlerts
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get current cache health status
   */
  getHealthStatus(): {
    status: "healthy" | "warning" | "critical";
    score: number;
    issues: string[];
    lastCheck: number;
  } {
    const health = this.cache.getHealth();
    const recentAlerts = this.getAlerts(undefined, 10);
    
    // Calculate health score based on multiple factors
    let score = 100;
    
    // Deduct points for alerts
    recentAlerts.forEach(alert => {
      if (alert.level === "critical") score -= 20;
      else if (alert.level === "warning") score -= 10;
      else score -= 2;
    });

    // Deduct points for poor performance
    const currentMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    if (currentMetrics) {
      if (currentMetrics.combined.overallHitRate < 70) score -= 15;
      if (currentMetrics.combined.overallHitRate < 50) score -= 25;
    }

    score = Math.max(0, score);

    let status: "healthy" | "warning" | "critical" = "healthy";
    if (score < 50) status = "critical";
    else if (score < 80) status = "warning";

    return {
      status,
      score,
      issues: health.issues,
      lastCheck: Date.now(),
    };
  }

  /**
   * Export metrics to file
   */
  async exportMetrics(
    filePath?: string,
    format: "json" | "csv" = "json"
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const defaultPath = path.join(
      this.reportDir,
      `cache-metrics-${timestamp}.${format}`
    );
    const exportPath = filePath ?? defaultPath;

    if (format === "json") {
      const exportData = {
        exportTime: Date.now(),
        metricsHistory: this.metricsHistory,
        alerts: this.alerts,
        summary: this.generateReport(),
      };
      
      fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    } else {
      // CSV format - simplified metrics
      const csvHeader = "timestamp,photo_hits,photo_misses,data_hits,data_misses,total_size,hit_rate\n";
      const csvData = this.metricsHistory.map(m => 
        `${m.timestamp},${m.photos.hits},${m.photos.misses},${m.data.hits},${m.data.misses},${m.combined.totalSize},${m.combined.overallHitRate}`
      ).join("\n");
      
      fs.writeFileSync(exportPath, csvHeader + csvData);
    }

    console.log(`📊 Metrics exported to: ${exportPath}`);
    return exportPath;
  }

  /**
   * Get current metrics summary
   */
  getCurrentSummary(): {
    uptime: string;
    totalKeys: number;
    totalSize: string;
    hitRate: number;
    memoryUsage: string;
    alertCount: number;
  } {
    const currentMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    if (!currentMetrics) {
      return {
        uptime: "0s",
        totalKeys: 0,
        totalSize: "0MB",
        hitRate: 0,
        memoryUsage: "0MB",
        alertCount: 0,
      };
    }

    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const uptimeStr = uptime < 60 ? `${uptime}s` : 
                     uptime < 3600 ? `${Math.floor(uptime / 60)}m` :
                     `${Math.floor(uptime / 3600)}h`;

    return {
      uptime: uptimeStr,
      totalKeys: currentMetrics.combined.totalKeys,
      totalSize: `${Math.round(currentMetrics.combined.totalSize / (1024 * 1024))}MB`,
      hitRate: Math.round(currentMetrics.combined.overallHitRate),
      memoryUsage: `${Math.round(currentMetrics.system.nodeMemoryUsage.heapUsed / (1024 * 1024))}MB`,
      alertCount: this.alerts.filter(a => a.timestamp > Date.now() - 24 * 60 * 60 * 1000).length,
    };
  }

  /**
   * Cleanup old reports and metrics
   */
  async cleanup(options: { keepDays?: number } = {}): Promise<void> {
    const { keepDays = 7 } = options;
    const cutoffTime = Date.now() - (keepDays * 24 * 60 * 60 * 1000);

    // Clean metrics history
    this.metricsHistory = this.metricsHistory.filter(m => m.timestamp > cutoffTime);
    
    // Clean alerts
    this.alerts = this.alerts.filter(a => a.timestamp > cutoffTime);

    // Clean report files
    try {
      const files = fs.readdirSync(this.reportDir);
      for (const file of files) {
        const filePath = path.join(this.reportDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
        }
      }
      
      console.log(`🧹 Cleaned up old reports and metrics (kept last ${keepDays} days)`);
    } catch (error) {
      console.warn("⚠️ Error cleaning up old reports:", error);
    }
  }

  /**
   * Destroy monitor and cleanup resources
   */
  destroy(): void {
    this.stopMonitoring();
    this.metricsHistory = [];
    this.alerts = [];
  }
}

// Create singleton monitor instance
export const cacheMonitor = new CacheMonitor(googleAPICache as DatabaseSegmentedCache, {
  monitoringInterval: 60000, // 1 minute
  alertThresholds: {
    lowHitRate: 70,
    highMemoryUsage: 85,
    highEvictionRate: 10,
  },
});

// Export convenience functions
export const getCacheHealth = () => cacheMonitor.getHealthStatus();
export const getCacheSummary = () => cacheMonitor.getCurrentSummary();
export const getCacheReport = (hours = 24) => cacheMonitor.generateReport(hours);
export const exportCacheMetrics = (path?: string, format: "json" | "csv" = "json") => 
  cacheMonitor.exportMetrics(path, format);
/**
 * Simple client-side image cache to avoid repeated requests
 */

interface CacheEntry {
  image: HTMLImageElement;
  timestamp: number;
}

class ImageCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxAge = 30 * 60 * 1000; // 30 minutes

  preload(url: string): Promise<HTMLImageElement> {
    // Check if image is already cached and still valid
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.maxAge) {
      return Promise.resolve(cached.image);
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Cache the loaded image
        this.cache.set(url, {
          image: img,
          timestamp: Date.now()
        });
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  get(url: string): HTMLImageElement | null {
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.maxAge) {
      return cached.image;
    }
    return null;
  }

  clear() {
    this.cache.clear();
  }

  // Clean up expired entries
  cleanup() {
    const now = Date.now();
    for (const [url, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.maxAge) {
        this.cache.delete(url);
      }
    }
  }
}

export const imageCache = new ImageCache();

// Clean up expired entries every 10 minutes
if (typeof window !== 'undefined') {
  setInterval(() => imageCache.cleanup(), 10 * 60 * 1000);
}
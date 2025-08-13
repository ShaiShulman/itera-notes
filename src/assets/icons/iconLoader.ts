// Icon loader utility for dynamically loading SVG content from files
export class IconLoader {
  private static cache: Map<string, string> = new Map();
  
  // Load SVG content from a file path
  static async loadIcon(iconPath: string): Promise<string> {
    // Check cache first
    if (this.cache.has(iconPath)) {
      return this.cache.get(iconPath)!;
    }
    
    try {
      const response = await fetch(iconPath);
      if (!response.ok) {
        throw new Error(`Failed to load icon: ${response.statusText}`);
      }
      
      const svgContent = await response.text();
      
      // Cache the content
      this.cache.set(iconPath, svgContent);
      
      return svgContent;
    } catch (error) {
      console.error('Error loading SVG icon:', error);
      // Return a fallback dot icon
      return '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4"/></svg>';
    }
  }
  
  // Preload commonly used icons
  static async preloadIcons() {
    const iconPaths = [
      '/icons/trash-bin.svg',
      '/icons/flag.svg', 
      '/icons/ban.svg',
      '/icons/lightbulb.svg'
    ];
    
    // Load all icons in parallel
    await Promise.all(
      iconPaths.map(path => this.loadIcon(path))
    );
  }
  
  // Clear the cache if needed
  static clearCache() {
    this.cache.clear();
  }
}

// Icon path constants
export const IconPaths = {
  TRASH_BIN: '/icons/trash-bin.svg',
  FLAG: '/icons/flag.svg',
  BAN: '/icons/ban.svg',
  LIGHTBULB: '/icons/lightbulb.svg'
} as const;
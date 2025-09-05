import { cleanString } from "@/utils/strings";

export interface PreviewLine {
  type: "title" | "day" | "place" | "paragraph" | "unknown";
  content: string;
  cleanedContent: string;
  metadata?: {
    dayNumber?: number;
    date?: string;
    placeName?: string;
    coordinates?: { lat: number; lng: number };
    region?: string;
  };
}

export class StreamingPreviewParser {
  private buffer: string = "";
  private lines: PreviewLine[] = [];
  private currentDay: number | null = null;

  /**
   * Add new streaming content to the parser
   */
  public addContent(chunk: string): PreviewLine[] {
    this.buffer += chunk;
    
    // Process complete lines
    const newLines: PreviewLine[] = [];
    const lines = this.buffer.split('\n');
    
    // Keep the last line in buffer if it's incomplete
    this.buffer = lines.pop() || '';
    
    // Process each complete line
    for (const line of lines) {
      if (line.trim()) {
        const previewLine = this.parseLine(line);
        this.lines.push(previewLine);
        newLines.push(previewLine);
      }
    }
    
    return newLines;
  }

  /**
   * Get all parsed lines so far
   */
  public getAllLines(): PreviewLine[] {
    return [...this.lines];
  }

  /**
   * Get the current buffer content (incomplete line)
   */
  public getCurrentBuffer(): string {
    return this.buffer;
  }

  /**
   * Finalize parsing - process any remaining buffer content
   */
  public finalize(): PreviewLine[] {
    const newLines: PreviewLine[] = [];
    
    if (this.buffer.trim()) {
      const previewLine = this.parseLine(this.buffer);
      this.lines.push(previewLine);
      newLines.push(previewLine);
      this.buffer = "";
    }
    
    return newLines;
  }

  /**
   * Parse a single line and determine its type
   */
  private parseLine(line: string): PreviewLine {
    const trimmedLine = line.trim();
    
    // Check for itinerary title
    if (trimmedLine.toUpperCase().includes("ITINERARY TITLE:")) {
      const content = trimmedLine.split(":")[1]?.trim() || trimmedLine;
      return {
        type: "title",
        content: trimmedLine,
        cleanedContent: cleanString(content) || content,
      };
    }
    
    // Check for day header: DAY X - Date - Title
    const dayMatch = trimmedLine.match(/^DAY\s+(\d+)\s*-\s*(.+)/i);
    if (dayMatch) {
      const dayNumber = parseInt(dayMatch[1]);
      const dayInfo = dayMatch[2];
      
      // Extract date and title
      const dateMatch = dayInfo.match(/(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? dateMatch[1] : undefined;
      
      const titleWithRegion = dayInfo
        .replace(/\d{4}-\d{2}-\d{2}/, "")
        .replace(/^\s*-\s*/, "")
        .trim();
      
      // Extract region from title
      const regionMatch = titleWithRegion.match(/\*\*([^*]+)\*\*/);
      const region = regionMatch ? regionMatch[1] : undefined;
      
      // Clean the title
      const cleanTitle = cleanString(titleWithRegion) || titleWithRegion;
      
      this.currentDay = dayNumber;
      
      return {
        type: "day",
        content: trimmedLine,
        cleanedContent: cleanTitle,
        metadata: {
          dayNumber,
          date,
          region,
        },
      };
    }
    
    // Check for place: **Place Name** (lat: XX.XXXXX, lng: XX.XXXXX)
    const placeMatch = trimmedLine.match(
      /\*\*(.+?)\*\*\s*\(lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+)\)/i
    );
    if (placeMatch) {
      const placeName = placeMatch[1].replace("**", "").trim();
      const lat = parseFloat(placeMatch[2]);
      const lng = parseFloat(placeMatch[3]);
      
      const cleanedName = cleanString(placeName) || placeName;
      
      return {
        type: "place",
        content: trimmedLine,
        cleanedContent: cleanedName,
        metadata: {
          placeName: cleanedName,
          coordinates: !isNaN(lat) && !isNaN(lng) ? { lat, lng } : undefined,
        },
      };
    }
    
    // Everything else is considered a paragraph
    const cleanedContent = cleanString(trimmedLine) || trimmedLine;
    
    return {
      type: "paragraph",
      content: trimmedLine,
      cleanedContent,
    };
  }

  /**
   * Reset the parser state
   */
  public reset(): void {
    this.buffer = "";
    this.lines = [];
    this.currentDay = null;
  }
}

/**
 * Utility function to process streaming content in real-time
 */
export function createStreamingParser(): StreamingPreviewParser {
  return new StreamingPreviewParser();
}
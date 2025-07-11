import fs from "fs";
import path from "path";

interface BaseApiLog {
  id: string;
  timestamp: Date;
  service: "openai" | "google-places" | "google-directions";
  status: "success" | "error";
  duration: number; // in milliseconds
  error?: string;
}

interface OpenAIApiLog extends BaseApiLog {
  service: "openai";
  model: string;
  prompt: string;
  response?: string;
  tokensUsed?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface GooglePlacesApiLog extends BaseApiLog {
  service: "google-places";
  query: string;
  placeId?: string;
  found: boolean;
}

interface GoogleDirectionsApiLog extends BaseApiLog {
  service: "google-directions";
  origin: string;
  destination: string;
  waypoints?: string[];
  mode: string;
  routeFound: boolean;
  totalDistance?: string;
  totalDuration?: string;
}

type ApiLog = OpenAIApiLog | GooglePlacesApiLog | GoogleDirectionsApiLog;

class ApiLogger {
  private logFilePath: string;

  constructor() {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create log file with current date
    const today = new Date().toISOString().split("T")[0];
    this.logFilePath = path.join(logsDir, `api-logs-${today}.txt`);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private writeToFile(logEntry: string): void {
    try {
      fs.appendFileSync(this.logFilePath, logEntry + "\n");
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  }

  private formatLogEntry(log: ApiLog): string {
    const timestamp = log.timestamp.toISOString();
    const status = log.status === "success" ? "SUCCESS" : "ERROR";
    const duration = `${log.duration}ms`;

    let details = "";
    switch (log.service) {
      case "openai":
        const openaiLog = log as OpenAIApiLog;
        details = `model=${openaiLog.model} prompt_chars=${
          openaiLog.prompt.length
        } response_chars=${openaiLog.response?.length || 0}`;
        if (openaiLog.tokensUsed) {
          details += ` tokens=${openaiLog.tokensUsed.totalTokens}(${openaiLog.tokensUsed.promptTokens}+${openaiLog.tokensUsed.completionTokens})`;
        }
        break;

      case "google-places":
        const placesLog = log as GooglePlacesApiLog;
        details = `query="${placesLog.query}" found=${placesLog.found}`;
        if (placesLog.placeId) {
          details += ` place_id=${placesLog.placeId}`;
        }
        break;

      case "google-directions":
        const directionsLog = log as GoogleDirectionsApiLog;
        details = `origin="${directionsLog.origin}" destination="${directionsLog.destination}" found=${directionsLog.routeFound}`;
        if (directionsLog.waypoints && directionsLog.waypoints.length > 0) {
          details += ` waypoints=${directionsLog.waypoints.length}`;
        }
        if (directionsLog.totalDistance) {
          details += ` distance=${directionsLog.totalDistance}`;
        }
        if (directionsLog.totalDuration) {
          details += ` duration=${directionsLog.totalDuration}`;
        }
        break;
    }

    let logLine = `[${timestamp}] ${log.service.toUpperCase()} ${status} ${duration} ${details}`;

    if (log.error) {
      logLine += ` ERROR: ${log.error}`;
    }

    return logLine;
  }

  logOpenAICall(params: {
    model: string;
    prompt: string;
    response?: string;
    tokensUsed?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    duration: number;
    status: "success" | "error";
    error?: string;
  }): void {
    const log: OpenAIApiLog = {
      id: this.generateId(),
      timestamp: new Date(),
      service: "openai",
      ...params,
    };

    const logEntry = this.formatLogEntry(log);
    this.writeToFile(logEntry);

    // Also log to console for development
    console.log(`📊 ${logEntry}`);
  }

  logGooglePlacesCall(params: {
    query: string;
    placeId?: string;
    found: boolean;
    duration: number;
    status: "success" | "error";
    error?: string;
  }): void {
    const log: GooglePlacesApiLog = {
      id: this.generateId(),
      timestamp: new Date(),
      service: "google-places",
      ...params,
    };

    const logEntry = this.formatLogEntry(log);
    this.writeToFile(logEntry);

    // Also log to console for development
    console.log(`📊 ${logEntry}`);
  }

  logGoogleDirectionsCall(params: {
    origin: string;
    destination: string;
    waypoints?: string[];
    mode: string;
    routeFound: boolean;
    totalDistance?: string;
    totalDuration?: string;
    duration: number;
    status: "success" | "error";
    error?: string;
  }): void {
    const log: GoogleDirectionsApiLog = {
      id: this.generateId(),
      timestamp: new Date(),
      service: "google-directions",
      ...params,
    };

    const logEntry = this.formatLogEntry(log);
    this.writeToFile(logEntry);

    // Also log to console for development
    console.log(`📊 ${logEntry}`);
  }
}

// Export singleton instance
export const apiLogger = new ApiLogger();

// Export types for external use
export type {
  ApiLog,
  OpenAIApiLog,
  GooglePlacesApiLog,
  GoogleDirectionsApiLog,
};

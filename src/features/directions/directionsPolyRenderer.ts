import { DirectionsData } from "../map/types";

interface PolylineRenderResult {
  polyline: google.maps.Polyline;
  dayIndex: number;
  color: string;
  pointCount: number;
}

/**
 * Renders directions as polylines on a Google Map
 * Extracts encoded polylines from directions data and draws them as native polylines
 */
export class DirectionsPolyRenderer {
  private map: google.maps.Map;
  private polylines: google.maps.Polyline[] = [];

  constructor(map: google.maps.Map) {
    this.map = map;
  }

  /**
   * Clear all existing polylines from the map
   */
  clearPolylines(): void {
    this.polylines.forEach((polyline) => {
      polyline.setMap(null);
    });
    this.polylines = [];
    console.log("🧹 DirectionsPolyRenderer: Cleared all polylines");
  }

  /**
   * Render directions data as polylines
   * @param directionsData Array of directions data for each day
   * @returns Array of rendered polyline results
   */
  renderDirections(directionsData: DirectionsData[]): PolylineRenderResult[] {
    console.log(
      `🎨 DirectionsPolyRenderer: Rendering ${directionsData.length} direction routes`
    );

    const results: PolylineRenderResult[] = [];

    directionsData.forEach((directionData) => {
      try {
        console.log(
          `🛣️ Processing directions for day ${directionData.dayIndex + 1}`,
          directionData.directionsResult
        );

        // Extract encoded polyline from the first route
        const routes = directionData.directionsResult.routes;
        if (!routes || routes.length === 0) {
          console.warn(
            `⚠️ No routes found for day ${directionData.dayIndex + 1}`
          );
          return;
        }

        const overviewPolyline = routes[0].overview_polyline;
        if (!overviewPolyline || !overviewPolyline.points) {
          console.warn(
            `⚠️ No polyline points found for day ${directionData.dayIndex + 1}`
          );
          return;
        }

        console.log(
          `🔧 Extracting polyline for Day ${directionData.dayIndex + 1}:`,
          overviewPolyline.points.substring(0, 50) + "..." // Log first 50 chars
        );

        // Decode the polyline using Google Maps geometry library
        const decodedPath = google.maps.geometry.encoding.decodePath(
          overviewPolyline.points
        );

        console.log(
          `🔧 Decoded ${decodedPath.length} polyline points for Day ${
            directionData.dayIndex + 1
          }`
        );

        // Create a polyline with the decoded path
        const polyline = new google.maps.Polyline({
          path: decodedPath,
          geodesic: true,
          strokeColor: directionData.color,
          strokeOpacity: 0.8,
          strokeWeight: 4,
        });

        // Add the polyline to the map
        polyline.setMap(this.map);

        // Store the polyline for cleanup
        this.polylines.push(polyline);

        const result: PolylineRenderResult = {
          polyline,
          dayIndex: directionData.dayIndex,
          color: directionData.color,
          pointCount: decodedPath.length,
        };

        results.push(result);

        console.log(
          `✅ Added polyline route for Day ${directionData.dayIndex + 1} (${
            directionData.color
          }) with ${decodedPath.length} points`
        );
      } catch (error) {
        console.error(
          `❌ Error creating polyline for Day ${directionData.dayIndex + 1}:`,
          error
        );
        console.error(
          "Error details:",
          error instanceof Error ? error.message : String(error)
        );
        console.error("Directions data:", directionData.directionsResult);
      }
    });

    console.log(
      `✅ DirectionsPolyRenderer: Successfully rendered ${results.length} polylines`
    );
    return results;
  }

  /**
   * Get all currently rendered polylines
   */
  getPolylines(): google.maps.Polyline[] {
    return [...this.polylines];
  }

  /**
   * Update the styling of all polylines
   */
  updatePolylineStyles(styles: {
    strokeWeight?: number;
    strokeOpacity?: number;
  }): void {
    this.polylines.forEach((polyline) => {
      if (styles.strokeWeight !== undefined) {
        polyline.setOptions({ strokeWeight: styles.strokeWeight });
      }
      if (styles.strokeOpacity !== undefined) {
        polyline.setOptions({ strokeOpacity: styles.strokeOpacity });
      }
    });
    console.log(
      `🎨 DirectionsPolyRenderer: Updated styles for ${this.polylines.length} polylines`
    );
  }
}

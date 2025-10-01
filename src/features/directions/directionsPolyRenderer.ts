import { DirectionsData } from "../map/types";
import { preprocessPolylineForRendering, detectVerticalArtifacts } from "./polylineUtils";

interface PolylineRenderResult {
  polyline: google.maps.Polyline;
  dayIndex: number;
  color: string;
  pointCount: number;
  isFallbackStraightLine?: boolean;
}

/**
 * Renders directions as polylines on a Google Map
 * Extracts encoded polylines from directions data and draws them as native polylines
 * Also handles fallback straight-line connections when no driving route is available
 */
export class DirectionsPolyRenderer {
  private map: google.maps.Map;
  private polylines: google.maps.Polyline[] = [];
  private polylinesByDay: Map<number, google.maps.Polyline[]> = new Map();
  private routesVisible: boolean = true;

  constructor(map: google.maps.Map) {
    this.map = map;
  }

  /**
   * Render multiple separate polylines for problematic transit segments
   * This is used as a fallback when concatenation would cause vertical artifacts
   */
  private renderMultipleTransitPolylines(
    segments: string[],
    directionData: DirectionsData,
    useGeodesic: boolean
  ): PolylineRenderResult[] {
    const results: PolylineRenderResult[] = [];

    segments.forEach((segment, index) => {
      if (!segment.trim()) return;

      try {
        const decodedPath = google.maps.geometry.encoding.decodePath(segment);

        if (decodedPath.length === 0) {
          console.warn(`⚠️ Empty decoded path for transit segment ${index + 1}`);
          return;
        }

        console.log(`🚌 Rendering separate transit segment ${index + 1}: ${decodedPath.length} points`);

        // Create polyline options with appropriate styling
        const polylineOptions: google.maps.PolylineOptions = {
          path: decodedPath,
          geodesic: useGeodesic,
          strokeColor: directionData.color,
          strokeOpacity: 0.8,
          strokeWeight: 4,
        };

        // Add slight styling variation for multiple segments (optional)
        if (segments.length > 1) {
          polylineOptions.strokeOpacity = 0.7; // Slightly more transparent
          polylineOptions.icons = [
            {
              icon: {
                path: "M 0,-1 0,1",
                strokeOpacity: 0.8,
                scale: 1,
              },
              offset: "0",
              repeat: "15px",
            },
          ];
        }

        const polyline = new google.maps.Polyline(polylineOptions);
        polyline.setMap(this.map);

        // Store the polyline for cleanup
        this.polylines.push(polyline);

        // Store polyline by day for day-specific styling
        const dayIndex = directionData.dayIndex;
        if (!this.polylinesByDay.has(dayIndex)) {
          this.polylinesByDay.set(dayIndex, []);
        }
        this.polylinesByDay.get(dayIndex)!.push(polyline);

        const result: PolylineRenderResult = {
          polyline,
          dayIndex: directionData.dayIndex,
          color: directionData.color,
          pointCount: decodedPath.length,
          isFallbackStraightLine: false,
        };

        results.push(result);

        console.log(
          `✅ Added transit segment ${index + 1}/${segments.length} for Day ${directionData.dayIndex + 1} (${
            directionData.color
          }) with ${decodedPath.length} points`
        );
      } catch (error) {
        console.error(
          `❌ Error creating polyline for transit segment ${index + 1}:`,
          error
        );
      }
    });

    console.log(
      `✅ Rendered ${results.length}/${segments.length} transit segments for Day ${directionData.dayIndex + 1}`
    );

    return results;
  }

  /**
   * Clear all existing polylines from the map
   */
  clearPolylines(): void {
    this.polylines.forEach((polyline) => {
      polyline.setMap(null);
    });
    this.polylines = [];
    this.polylinesByDay.clear();
    console.log("🧹 DirectionsPolyRenderer: Cleared all polylines");
  }

  /**
   * Parse coordinates from fallback straight-line response
   * @param polylinePoints String containing coordinates in format "lat1,lng1|lat2,lng2|..."
   * @returns Array of LatLng objects
   */
  private parseStraightLineCoordinates(
    polylinePoints: string
  ): google.maps.LatLng[] {
    try {
      const coordinates = polylinePoints.split("|").map((coord) => {
        const [lat, lng] = coord.split(",").map(Number);
        return new google.maps.LatLng(lat, lng);
      });
      console.log(`🔧 Parsed ${coordinates.length} straight-line coordinates`);
      return coordinates;
    } catch (error) {
      console.error("❌ Error parsing straight-line coordinates:", error);
      return [];
    }
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

        // Extract routes from the directions result
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

        let decodedPath: google.maps.LatLng[] = [];
        const isFallbackStraightLine =
          directionData.directionsResult.isFallbackStraightLine;

        if (isFallbackStraightLine) {
          console.log(
            `🔧 Using straight-line fallback for Day ${
              directionData.dayIndex + 1
            }`
          );

          // Parse coordinates from the special format for straight lines
          decodedPath = this.parseStraightLineCoordinates(
            overviewPolyline.points
          );

          if (decodedPath.length === 0) {
            console.warn(
              `⚠️ Could not parse straight-line coordinates for day ${
                directionData.dayIndex + 1
              }`
            );
            return;
          }
        } else {
          console.log(
            `🔧 Extracting encoded polyline for Day ${
              directionData.dayIndex + 1
            }:`,
            overviewPolyline.points.substring(0, 50) + "..." // Log first 50 chars
          );

          // Check if this is a combined transit polyline
          if ((overviewPolyline as any).isTransitCombined) {
            console.log(`🚌 Processing smart-concatenated transit polyline for Day ${directionData.dayIndex + 1}`);

            // Use smart preprocessing to handle the polyline
            const processed = preprocessPolylineForRendering(overviewPolyline.points);

            // Log any warnings from preprocessing
            if (processed.warnings.length > 0) {
              console.warn(`⚠️ Transit polyline preprocessing warnings:`, processed.warnings);
            }

            if (processed.renderAsMultiplePolylines) {
              console.log(`🔄 Rendering ${processed.segments.length} separate transit polylines`);

              // Render multiple polylines for problematic segments
              return this.renderMultipleTransitPolylines(
                processed.segments,
                directionData,
                processed.shouldUseGeodesic
              );
            } else {
              // Process as single concatenated polyline
              const segments = processed.segments[0].split('|').filter(s => s.length > 0);
              decodedPath = [];

              segments.forEach((segment, index) => {
                if (segment.trim()) {
                  try {
                    const segmentPath = google.maps.geometry.encoding.decodePath(segment);
                    decodedPath = decodedPath.concat(segmentPath);
                    console.log(`🚌 Decoded transit segment ${index + 1}: ${segmentPath.length} points`);
                  } catch (error) {
                    console.warn(`⚠️ Failed to decode transit segment ${index + 1}:`, error);
                  }
                }
              });

              console.log(`🚌 Total decoded transit points: ${decodedPath.length}`);

              // Check for artifacts in the final path
              if (decodedPath.length > 0) {
                const latLngPath = decodedPath.map(p => ({ lat: p.lat(), lng: p.lng() }));
                const artifactDetection = detectVerticalArtifacts(latLngPath);

                if (artifactDetection.hasVerticalArtifacts) {
                  console.warn(`⚠️ Vertical artifacts detected in transit polyline:`, artifactDetection.suggestedFixes);

                  if (artifactDetection.shouldFallback) {
                    console.log(`🔄 Falling back to multiple polyline rendering`);
                    return this.renderMultipleTransitPolylines(
                      processed.segments[0].split('|').filter(s => s.length > 0),
                      directionData,
                      true // Force geodesic for fallback
                    );
                  }
                }
              }

              // Note: geodesic setting will be handled later in the polyline options section
            }
          } else {
            // Decode the polyline using Google Maps geometry library (normal case)
            decodedPath = google.maps.geometry.encoding.decodePath(
              overviewPolyline.points
            );
          }
        }

        console.log(
          `🔧 ${isFallbackStraightLine ? "Created" : "Decoded"} ${
            decodedPath.length
          } polyline points for Day ${directionData.dayIndex + 1}`
        );

        // Determine geodesic setting - use smart recommendation for transit, original logic for others
        let useGeodesic = !isFallbackStraightLine; // Default logic

        // Override with smart recommendation for transit polylines
        if ((overviewPolyline as any).isTransitCombined && (overviewPolyline as any).recommendGeodesic) {
          useGeodesic = true;
          console.log(`🌍 Using geodesic rendering based on smart concatenation recommendation`);
        }

        // Create a polyline with the decoded/parsed path
        const polylineOptions: google.maps.PolylineOptions = {
          path: decodedPath,
          geodesic: useGeodesic,
          strokeColor: directionData.color,
          strokeOpacity: 0.8,
          strokeWeight: 4,
        };

        // Use dashed line for fallback straight-line routes
        if (isFallbackStraightLine) {
          polylineOptions.strokeOpacity = 0.6;
          polylineOptions.icons = [
            {
              icon: {
                path: "M 0,-1 0,1",
                strokeOpacity: 1,
                scale: 2,
              },
              offset: "0",
              repeat: "10px",
            },
          ];
        }

        const polyline = new google.maps.Polyline(polylineOptions);

        // Add the polyline to the map
        polyline.setMap(this.map);

        // Store the polyline for cleanup
        this.polylines.push(polyline);
        
        // Store polyline by day for day-specific styling
        const dayIndex = directionData.dayIndex;
        if (!this.polylinesByDay.has(dayIndex)) {
          this.polylinesByDay.set(dayIndex, []);
        }
        this.polylinesByDay.get(dayIndex)!.push(polyline);

        const result: PolylineRenderResult = {
          polyline,
          dayIndex: directionData.dayIndex,
          color: directionData.color,
          pointCount: decodedPath.length,
          isFallbackStraightLine,
        };

        results.push(result);

        console.log(
          `✅ Added ${
            isFallbackStraightLine ? "straight-line" : "route"
          } polyline for Day ${directionData.dayIndex + 1} (${
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

  /**
   * Update styling for a specific day only, with different styles for selected vs non-selected days
   */
  updateDaySpecificStyles(selectedDayIndex?: number): void {
    if (!this.routesVisible) {
      // If routes are hidden, only show selected day
      this.polylinesByDay.forEach((polylines, dayIndex) => {
        const shouldShow = selectedDayIndex !== undefined && dayIndex === selectedDayIndex;
        polylines.forEach((polyline) => {
          polyline.setVisible(shouldShow);
          if (shouldShow) {
            polyline.setOptions({ strokeWeight: 6, strokeOpacity: 0.9 });
          }
        });
      });
      console.log(`🎨 DirectionsPolyRenderer: Routes hidden, showing only selected day ${selectedDayIndex !== undefined ? selectedDayIndex + 1 : 'none'}`);
      return;
    }

    if (selectedDayIndex === undefined) {
      // Reset all lines to thin styling when no day is selected
      this.updatePolylineStyles({
        strokeWeight: 1,
        strokeOpacity: 0.4
      });
      console.log('🎨 DirectionsPolyRenderer: Reset all lines to thin styling');
      return;
    }

    // Style each day's polylines
    this.polylinesByDay.forEach((polylines, dayIndex) => {
      const isSelected = dayIndex === selectedDayIndex;
      const styles = isSelected
        ? { strokeWeight: 6, strokeOpacity: 0.9 } // Thick lines for selected day
        : { strokeWeight: 4, strokeOpacity: 0.4 }; // Thicker lines for other days

      polylines.forEach((polyline) => {
        polyline.setOptions(styles);
        polyline.setVisible(true); // Ensure visible when routes are shown
      });

      console.log(
        `🎨 DirectionsPolyRenderer: Updated day ${dayIndex + 1} (${isSelected ? 'SELECTED' : 'dimmed'}) - ${polylines.length} polylines`
      );
    });
  }

  /**
   * Toggle route visibility
   */
  setRoutesVisible(visible: boolean, selectedDayIndex?: number): void {
    this.routesVisible = visible;
    
    if (visible) {
      // Show all routes and apply current styling
      this.polylines.forEach((polyline) => {
        polyline.setVisible(true);
      });
      this.updateDaySpecificStyles(selectedDayIndex);
      console.log('🎨 DirectionsPolyRenderer: Routes shown');
    } else {
      // Hide all routes except selected day
      this.polylinesByDay.forEach((polylines, dayIndex) => {
        const shouldShow = selectedDayIndex !== undefined && dayIndex === selectedDayIndex;
        polylines.forEach((polyline) => {
          polyline.setVisible(shouldShow);
        });
      });
      console.log(`🎨 DirectionsPolyRenderer: Routes hidden, showing only selected day ${selectedDayIndex !== undefined ? selectedDayIndex + 1 : 'none'}`);
    }
  }

  /**
   * Get current route visibility state
   */
  getRoutesVisible(): boolean {
    return this.routesVisible;
  }
}

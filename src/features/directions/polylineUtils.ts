/**
 * Polyline validation and concatenation utilities for handling transit routes
 * and preventing vertical line artifacts, especially for antimeridian crossings
 */

export interface ConcatenationResult {
  success: boolean;
  processedPolyline: string;
  metadata: {
    hasAntimeridianCrossing: boolean;
    segmentCount: number;
    warnings: string[];
    recommendGeodesic: boolean;
    useFallbackRendering: boolean;
  };
}

export interface ProcessedPolyline {
  segments: string[];
  shouldUseGeodesic: boolean;
  warnings: string[];
  renderAsMultiplePolylines: boolean;
}

export interface ArtifactDetection {
  hasVerticalArtifacts: boolean;
  problematicSegments: number[];
  suggestedFixes: string[];
  shouldFallback: boolean;
}

export interface LatLngLike {
  lat: number;
  lng: number;
}

/**
 * Maximum allowed longitude difference between consecutive points
 * to avoid unwanted straight lines across the map
 */
const MAX_LONGITUDE_JUMP = 180;

/**
 * Threshold for detecting potential vertical artifacts
 */
const VERTICAL_ARTIFACT_THRESHOLD = 170; // degrees

/**
 * Validates a single polyline segment for coordinate sanity
 */
export function validateCoordinateSegment(segment: string): boolean {
  if (!segment || segment.trim().length === 0) {
    return false;
  }

  try {
    // Try to decode the segment to validate it's properly encoded
    if (typeof google !== 'undefined' && google.maps?.geometry?.encoding) {
      const decoded = google.maps.geometry.encoding.decodePath(segment);

      // Check if we got valid coordinates
      if (!decoded || decoded.length === 0) {
        return false;
      }

      // Validate coordinate ranges
      for (const point of decoded) {
        const lat = point.lat();
        const lng = point.lng();

        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          console.warn(`⚠️ Invalid coordinates detected: lat=${lat}, lng=${lng}`);
          return false;
        }
      }

      return true;
    } else {
      // If Google Maps is not available, do basic string validation
      return segment.length > 0 && !segment.includes('undefined') && !segment.includes('null');
    }
  } catch (error) {
    console.warn(`⚠️ Error validating polyline segment:`, error);
    return false;
  }
}

/**
 * Detects if a path crosses the antimeridian (±180° longitude)
 */
export function detectAntimeridianCrossing(points: LatLngLike[]): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const lng1 = points[i].lng;
    const lng2 = points[i + 1].lng;

    // Check for large longitude jumps that indicate antimeridian crossing
    const lngDiff = Math.abs(lng2 - lng1);

    if (lngDiff > MAX_LONGITUDE_JUMP) {
      console.log(`🌍 Antimeridian crossing detected: ${lng1}° → ${lng2}° (diff: ${lngDiff}°)`);
      return true;
    }
  }

  return false;
}

/**
 * Decodes a polyline segment safely and returns coordinate points
 */
function decodePolylineSegment(segment: string): LatLngLike[] {
  try {
    if (typeof google !== 'undefined' && google.maps?.geometry?.encoding) {
      const decoded = google.maps.geometry.encoding.decodePath(segment);
      return decoded.map(point => ({ lat: point.lat(), lng: point.lng() }));
    } else {
      console.warn('⚠️ Google Maps geometry library not available for polyline decoding');
      return [];
    }
  } catch (error) {
    console.warn(`⚠️ Error decoding polyline segment:`, error);
    return [];
  }
}

/**
 * Detects potential vertical artifacts in decoded path
 */
export function detectVerticalArtifacts(decodedPath: LatLngLike[]): ArtifactDetection {
  const problematicSegments: number[] = [];
  const suggestedFixes: string[] = [];
  let hasVerticalArtifacts = false;

  for (let i = 0; i < decodedPath.length - 1; i++) {
    const point1 = decodedPath[i];
    const point2 = decodedPath[i + 1];

    const lngDiff = Math.abs(point2.lng - point1.lng);
    const latDiff = Math.abs(point2.lat - point1.lat);

    // Detect potential vertical artifacts
    if (lngDiff > VERTICAL_ARTIFACT_THRESHOLD ||
        (lngDiff > 100 && latDiff > 100)) {
      hasVerticalArtifacts = true;
      problematicSegments.push(i);

      console.warn(`⚠️ Potential vertical artifact detected at segment ${i}: lng diff=${lngDiff}°, lat diff=${latDiff}°`);
    }
  }

  if (hasVerticalArtifacts) {
    suggestedFixes.push('Enable geodesic rendering');
    suggestedFixes.push('Split into multiple polylines');
    suggestedFixes.push('Preprocess coordinates for antimeridian handling');
  }

  return {
    hasVerticalArtifacts,
    problematicSegments,
    suggestedFixes,
    shouldFallback: problematicSegments.length > decodedPath.length * 0.3 // Fallback if >30% problematic
  };
}

/**
 * Analyzes segments for potential concatenation issues
 */
function analyzeSegmentCompatibility(segments: string[]): {
  canSafelyConcatenate: boolean;
  hasAntimeridianCrossing: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  let hasAntimeridianCrossing = false;
  let canSafelyConcatenate = true;

  // Decode all segments to analyze them
  const decodedSegments = segments.map((segment, index) => {
    const decoded = decodePolylineSegment(segment);
    if (decoded.length === 0) {
      warnings.push(`Segment ${index + 1} could not be decoded`);
      canSafelyConcatenate = false;
    }
    return decoded;
  });

  // Check for antimeridian crossings within segments
  for (let i = 0; i < decodedSegments.length; i++) {
    const segment = decodedSegments[i];
    if (segment.length > 0 && detectAntimeridianCrossing(segment)) {
      hasAntimeridianCrossing = true;
      warnings.push(`Segment ${i + 1} crosses the antimeridian`);
    }
  }

  // Check for large gaps between segments
  for (let i = 0; i < decodedSegments.length - 1; i++) {
    const currentSegment = decodedSegments[i];
    const nextSegment = decodedSegments[i + 1];

    if (currentSegment.length > 0 && nextSegment.length > 0) {
      const lastPoint = currentSegment[currentSegment.length - 1];
      const firstPoint = nextSegment[0];

      const lngDiff = Math.abs(firstPoint.lng - lastPoint.lng);

      if (lngDiff > MAX_LONGITUDE_JUMP) {
        hasAntimeridianCrossing = true;
        canSafelyConcatenate = false;
        warnings.push(`Large gap between segments ${i + 1} and ${i + 2}: ${lngDiff}° longitude difference`);
      }
    }
  }

  return {
    canSafelyConcatenate,
    hasAntimeridianCrossing,
    warnings
  };
}

/**
 * Smart concatenation of polyline segments with validation and artifact prevention
 */
export function smartConcatenatePolylines(segments: string[]): ConcatenationResult {
  console.log(`🔗 Starting smart concatenation of ${segments.length} polyline segments`);

  const warnings: string[] = [];

  // Filter out invalid segments
  const validSegments = segments.filter((segment, index) => {
    const isValid = validateCoordinateSegment(segment);
    if (!isValid) {
      warnings.push(`Segment ${index + 1} failed validation and was removed`);
    }
    return isValid;
  });

  if (validSegments.length === 0) {
    return {
      success: false,
      processedPolyline: '',
      metadata: {
        hasAntimeridianCrossing: false,
        segmentCount: 0,
        warnings: ['No valid segments to concatenate'],
        recommendGeodesic: false,
        useFallbackRendering: true
      }
    };
  }

  // Analyze compatibility
  const analysis = analyzeSegmentCompatibility(validSegments);
  warnings.push(...analysis.warnings);

  let processedPolyline: string;
  let useFallbackRendering = false;

  if (analysis.canSafelyConcatenate) {
    // Safe to concatenate normally
    processedPolyline = validSegments.join('|');
    console.log(`✅ Successfully concatenated ${validSegments.length} segments`);
  } else {
    // Use fallback: create separate polylines or simplified concatenation
    console.warn(`⚠️ Cannot safely concatenate segments, using fallback approach`);
    processedPolyline = validSegments.join('||'); // Double separator for fallback indication
    useFallbackRendering = true;
    warnings.push('Using fallback rendering due to concatenation issues');
  }

  return {
    success: validSegments.length > 0,
    processedPolyline,
    metadata: {
      hasAntimeridianCrossing: analysis.hasAntimeridianCrossing,
      segmentCount: validSegments.length,
      warnings,
      recommendGeodesic: analysis.hasAntimeridianCrossing || analysis.warnings.length > 0,
      useFallbackRendering
    }
  };
}

/**
 * Preprocesses polyline for rendering, handling special cases
 */
export function preprocessPolylineForRendering(polyline: string): ProcessedPolyline {
  console.log(`🔧 Preprocessing polyline for rendering`);

  const warnings: string[] = [];
  let shouldUseGeodesic = false;
  let renderAsMultiplePolylines = false;

  // Check if this is a fallback concatenation (double separator)
  if (polyline.includes('||')) {
    console.log(`🔄 Detected fallback concatenation, splitting into multiple polylines`);
    const segments = polyline.split('||').filter(s => s.length > 0);
    renderAsMultiplePolylines = true;
    shouldUseGeodesic = true;
    warnings.push('Rendering as multiple polylines due to concatenation issues');

    return {
      segments,
      shouldUseGeodesic,
      warnings,
      renderAsMultiplePolylines
    };
  }

  // Normal processing for single concatenated polyline
  const segments = polyline.split('|').filter(s => s.length > 0);

  // Analyze for artifacts and antimeridian crossings
  const allPoints: LatLngLike[] = [];

  for (const segment of segments) {
    const decoded = decodePolylineSegment(segment);
    allPoints.push(...decoded);
  }

  if (allPoints.length > 0) {
    const artifactDetection = detectVerticalArtifacts(allPoints);
    const hasAntimeridianCrossing = detectAntimeridianCrossing(allPoints);

    if (artifactDetection.hasVerticalArtifacts) {
      warnings.push('Vertical artifacts detected in polyline');
      warnings.push(...artifactDetection.suggestedFixes);

      if (artifactDetection.shouldFallback) {
        renderAsMultiplePolylines = true;
        warnings.push('Switching to multiple polyline rendering');
      }
    }

    if (hasAntimeridianCrossing || artifactDetection.hasVerticalArtifacts) {
      shouldUseGeodesic = true;
      warnings.push('Geodesic rendering recommended');
    }
  }

  return {
    segments: renderAsMultiplePolylines ? segments : [polyline],
    shouldUseGeodesic,
    warnings,
    renderAsMultiplePolylines
  };
}

/**
 * Utility function to normalize longitude values to [-180, 180] range
 */
export function normalizeLongitude(lng: number): number {
  while (lng > 180) lng -= 360;
  while (lng < -180) lng += 360;
  return lng;
}

/**
 * Calculate the shortest angular distance between two longitude values
 */
export function shortestLongitudinalDistance(lng1: number, lng2: number): number {
  const diff = Math.abs(lng2 - lng1);
  return Math.min(diff, 360 - diff);
}
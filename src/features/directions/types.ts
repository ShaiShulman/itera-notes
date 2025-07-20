export interface DrivingDirections {
  color: string; // Day color for markers and polylines
  directionsResult: {
    routes: Array<{
      overview_polyline: {
        points: string; // Encoded polyline string
      };
    }>;
    isFallbackStraightLine: boolean;
  } | null; // null if no directions calculated yet
}

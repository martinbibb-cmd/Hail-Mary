/**
 * Geolocation utility functions
 * Calculate distances between GPS coordinates
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
  altitude?: number;
}

/**
 * Calculate horizontal distance between two GPS points using Haversine formula
 * Returns distance in meters
 */
export function calculateHaversineDistance(
  point1: Coordinates,
  point2: Coordinates
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (point1.latitude * Math.PI) / 180;
  const φ2 = (point2.latitude * Math.PI) / 180;
  const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Calculate 3D distance between two GPS points (including altitude)
 * Returns distance in meters
 * Falls back to horizontal distance if altitude is missing
 */
export function calculate3DDistance(
  point1: Coordinates,
  point2: Coordinates
): number {
  const horizontalDistance = calculateHaversineDistance(point1, point2);

  // If both points have altitude, calculate 3D distance
  if (
    point1.altitude !== undefined &&
    point1.altitude !== null &&
    point2.altitude !== undefined &&
    point2.altitude !== null
  ) {
    const verticalDistance = Math.abs(point2.altitude - point1.altitude);
    return Math.sqrt(
      horizontalDistance * horizontalDistance + verticalDistance * verticalDistance
    );
  }

  return horizontalDistance;
}

/**
 * Format distance for display
 * Returns human-readable string (e.g., "12m" or "1.2km")
 */
export function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)}m`;
  }
  return `${(distanceMeters / 1000).toFixed(2)}km`;
}

// Primetek Global — Hyderabad office (demo coordinates)
export const OFFICE_LOCATION = {
  lat: 17.44569123225756,
  lng: 78.38649648531063,
  name: 'Primetek HQ, Hyderabad',
  radiusMeters: 500,
};

/**
 * Haversine formula — distance between two GPS coordinates in meters.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Check if coordinates are within the office radius.
 */
export function isWithinOffice(lat: number, lng: number): boolean {
  const distance = haversineDistance(lat, lng, OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
  return distance <= OFFICE_LOCATION.radiusMeters;
}

/**
 * Get current GPS position from browser.
 */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });
}



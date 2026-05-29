import { describe, it, expect } from 'vitest';
import { haversineDistance, isWithinOffice, OFFICE_LOCATION } from '@/lib/location';

describe('Location Geofencing — location.ts', () => {
  const officeLat = OFFICE_LOCATION.lat;
  const officeLng = OFFICE_LOCATION.lng;

  it('haversineDistance returns 0 for identical coordinates', () => {
    const dist = haversineDistance(officeLat, officeLng, officeLat, officeLng);
    expect(dist).toBe(0);
  });

  it('calculates distance accurately for ~100m shift', () => {
    // Shifting latitude by 0.0009 degrees is approximately 100 meters
    const testLat = officeLat + 0.0008;
    const dist = haversineDistance(officeLat, officeLng, testLat, officeLng);
    expect(dist).toBeGreaterThan(80);
    expect(dist).toBeLessThan(100);
  });

  it('calculates distance accurately for ~500m shift', () => {
    const testLat = officeLat + 0.0045;
    const dist = haversineDistance(officeLat, officeLng, testLat, officeLng);
    expect(dist).toBeGreaterThan(480);
    expect(dist).toBeLessThan(510);
  });

  it('isWithinOffice returns true for coordinates inside office radius', () => {
    // Coords slightly offset but well within 500m
    const testLat = officeLat + 0.002; 
    const dist = haversineDistance(officeLat, officeLng, testLat, officeLng);
    expect(dist).toBeLessThan(OFFICE_LOCATION.radiusMeters);
    expect(isWithinOffice(testLat, officeLng)).toBe(true);
  });

  it('isWithinOffice returns false for coordinates outside office radius', () => {
    // Coords offset by 600m
    const testLat = officeLat + 0.0055;
    const dist = haversineDistance(officeLat, officeLng, testLat, officeLng);
    expect(dist).toBeGreaterThan(OFFICE_LOCATION.radiusMeters);
    expect(isWithinOffice(testLat, officeLng)).toBe(false);
  });
});

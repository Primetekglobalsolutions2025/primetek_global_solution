import { describe, it, expect } from 'vitest';
import { getISTShiftDate, calculateDistance, formatDate, ATTENDANCE_STATUS } from '@/lib/utils';
import { isWithinOffice, OFFICE_LOCATION } from '@/lib/location';

describe('Utility Functions — utils.ts', () => {
  describe('getISTShiftDate() boundaries', () => {
    // 2026-05-29 UTC timestamps mapped to IST:
    // IST is UTC + 5:30
    
    it('11:59 AM IST (06:29 UTC) -> must return YESTERDAY (2026-05-28)', () => {
      const utcTime = Date.UTC(2026, 4, 29, 6, 29, 0); // May 29, 6:29 UTC
      expect(getISTShiftDate(new Date(utcTime))).toBe('2026-05-28');
    });

    it('12:00 PM IST (06:30 UTC) -> must return TODAY (2026-05-29)', () => {
      const utcTime = Date.UTC(2026, 4, 29, 6, 30, 0); // May 29, 6:30 UTC
      expect(getISTShiftDate(new Date(utcTime))).toBe('2026-05-29');
    });

    it('12:01 PM IST (06:31 UTC) -> must return TODAY (2026-05-29)', () => {
      const utcTime = Date.UTC(2026, 4, 29, 6, 31, 0); // May 29, 6:31 UTC
      expect(getISTShiftDate(new Date(utcTime))).toBe('2026-05-29');
    });

    it('6:30 PM IST (13:00 UTC) -> must return TODAY (2026-05-29)', () => {
      const utcTime = Date.UTC(2026, 4, 29, 13, 0, 0); // May 29, 13:00 UTC
      expect(getISTShiftDate(new Date(utcTime))).toBe('2026-05-29');
    });

    it('11:59 PM IST (18:29 UTC) -> must return TODAY (2026-05-29)', () => {
      const utcTime = Date.UTC(2026, 4, 29, 18, 29, 0); // May 29, 18:29 UTC
      expect(getISTShiftDate(new Date(utcTime))).toBe('2026-05-29');
    });

    it('12:00 AM IST (18:30 UTC) -> must return YESTERDAY (2026-05-28)', () => {
      const utcTime = Date.UTC(2026, 4, 28, 18, 30, 0); // May 28, 18:30 UTC -> May 29, 00:00 IST
      expect(getISTShiftDate(new Date(utcTime))).toBe('2026-05-28');
    });

    it('3:30 AM IST (22:00 UTC) -> must return YESTERDAY (2026-05-28)', () => {
      const utcTime = Date.UTC(2026, 4, 28, 22, 0, 0); // May 28, 22:00 UTC -> May 29, 3:30 AM IST
      expect(getISTShiftDate(new Date(utcTime))).toBe('2026-05-28');
    });

    it('5:29 AM IST (23:59 UTC) -> must return YESTERDAY (2026-05-28)', () => {
      const utcTime = Date.UTC(2026, 4, 28, 23, 59, 0); // May 28, 23:59 UTC -> May 29, 5:29 AM IST
      expect(getISTShiftDate(new Date(utcTime))).toBe('2026-05-28');
    });

    it('5:30 AM IST (00:00 UTC next day) -> must return YESTERDAY (2026-05-28)', () => {
      const utcTime = Date.UTC(2026, 4, 29, 0, 0, 0); // May 29, 00:00 UTC -> May 29, 5:30 AM IST (belongs to May 28 shift)
      expect(getISTShiftDate(new Date(utcTime))).toBe('2026-05-28');
    });

    it('5:31 AM IST (00:01 UTC next day) -> must return YESTERDAY (2026-05-28)', () => {
      const utcTime = Date.UTC(2026, 4, 29, 0, 1, 0); // May 29, 00:01 UTC -> May 29, 5:31 AM IST
      expect(getISTShiftDate(new Date(utcTime))).toBe('2026-05-28');
    });

    it('No input argument -> must return a valid YYYY-MM-DD string', () => {
      const dateStr = getISTShiftDate();
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('calculateDistance() and isWithinOffice()', () => {
    const officeLat = OFFICE_LOCATION.lat;
    const officeLng = OFFICE_LOCATION.lng;

    it('Distance to itself is 0', () => {
      expect(calculateDistance(officeLat, officeLng, officeLat, officeLng)).toBe(0);
    });

    it('Hyderabad office coords vs itself is within office geofence', () => {
      expect(isWithinOffice(officeLat, officeLng)).toBe(true);
    });

    it('Hyderabad office coords vs 100m away -> is within geofence', () => {
      // 0.0009 degrees latitude is roughly 100m
      const closeLat = officeLat + 0.0008;
      const distance = calculateDistance(officeLat, officeLng, closeLat, officeLng);
      expect(distance).toBeGreaterThan(80);
      expect(distance).toBeLessThan(100);
      expect(isWithinOffice(closeLat, officeLng)).toBe(true);
    });

    it('Hyderabad office coords vs 600m away -> is outside geofence', () => {
      // 0.0055 degrees latitude is roughly 600m
      const farLat = officeLat + 0.005;
      const distance = calculateDistance(officeLat, officeLng, farLat, officeLng);
      expect(distance).toBeGreaterThan(500);
      expect(distance).toBeLessThan(600);
      expect(isWithinOffice(farLat, officeLng)).toBe(false);
    });

    it('Hyderabad to Mumbai (approx 18.9750, 72.8258) is > 500,000m', () => {
      const distance = calculateDistance(officeLat, officeLng, 18.975, 72.8258);
      expect(distance).toBeGreaterThan(500000);
    });
  });

  describe('formatDate()', () => {
    it('returns formatted string for valid Date input', () => {
      const date = new Date(Date.UTC(2026, 4, 29));
      expect(formatDate(date)).toContain('2026');
    });

    it('returns formatted string for valid ISO string input', () => {
      expect(formatDate('2026-05-29T10:00:00Z')).toContain('2026');
    });
  });
});

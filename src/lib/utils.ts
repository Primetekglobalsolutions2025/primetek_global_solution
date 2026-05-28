import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

/**
 * Calculates distance between two coordinates in meters using Haversine formula
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Radius of Earth in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function formatDistance(meters: unknown): string {
  let val = 0;
  if (typeof meters === 'number') {
    val = meters;
  } else if (typeof meters === 'string') {
    val = parseFloat(meters.replace(/,/g, ''));
  }
  if (isNaN(val)) {
    val = 0;
  }

  if (val >= 1000) {
    const km = val / 1000;
    return `${km.toFixed(1)} km`;
  }
  return `${Math.round(val)}m`;
}

/**
 * Computes the IST shift date for a given timestamp.
 * IST is UTC + 5:30.
 * For the night shift (e.g. 6:30 PM to 3:30 AM IST), any time before noon IST
 * is counted as part of the previous day's shift.
 */
export function getISTShiftDate(now: Date = new Date()): string {
  const offset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + offset);
  const hours = istNow.getUTCHours(); // Hours in IST
  
  if (hours < 12) {
    // Before noon IST, belongs to yesterday
    const yesterday = new Date(istNow.getTime() - 24 * 60 * 60 * 1000);
    return yesterday.toISOString().split('T')[0];
  } else {
    // Noon or later IST, belongs to today
    return istNow.toISOString().split('T')[0];
  }
}

export const ATTENDANCE_STATUS = {
  WORKING: 'Working',
  IDLE: 'Idle',
  BREAK: 'Break',
  BREAK_AUTO: 'Break (Auto)',
  LOGGED_OUT: 'Logged Out',
  PENDING_WFH: 'Pending WFH',
  APPROVED_WFH: 'Approved WFH',
  REJECTED_WFH: 'Rejected WFH',
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  HALF_DAY: 'Half-day'
} as const;

export type AttendanceStatus = typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS];


/**
 * Utility for client-side and server-side device detection and heuristics.
 */

export interface DeviceInfo {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  deviceLabel: string;
}

export function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      deviceType: 'desktop',
      deviceLabel: 'Server Side'
    };
  }

  const ua = navigator.userAgent;
  const width = window.innerWidth;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';

  // Heuristics: Check for mobile/tablet in user agent first
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) {
    if (/iPad/i.test(ua) || (hasTouch && width >= 768 && width <= 1024)) {
      deviceType = 'tablet';
    } else {
      deviceType = 'mobile';
    }
  } else if (hasTouch && width < 1024) {
    deviceType = 'tablet';
  } else if (width < 768) {
    deviceType = 'mobile';
  }

  // Label detection: OS name
  let os = 'Unknown OS';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'MacBook';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // Label detection: Browser name
  let browser = 'Unknown Browser';
  if (/Chrome/i.test(ua) && !/Chromium|Edg|OPR/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/OPR|Opera/i.test(ua)) browser = 'Opera';

  const deviceLabel = `${os} ${browser}`;

  return {
    deviceType,
    deviceLabel
  };
}

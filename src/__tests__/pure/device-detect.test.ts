// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { getDeviceInfo } from '@/lib/security/device-detect';

describe('Device Detection — device-detect.ts', () => {
  const setUa = (userAgent: string) => {
    Object.defineProperty(global.navigator, 'userAgent', {
      value: userAgent,
      configurable: true,
    });
  };

  it('classifies iPhone user agent as mobile and correctly detects OS', () => {
    setUa('Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/605.1.15');
    const info = getDeviceInfo();
    expect(info.deviceType).toBe('mobile');
    expect(info.deviceLabel).toBe('iPhone Safari');
  });

  it('classifies iPad user agent as tablet and correctly detects OS', () => {
    setUa('Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/605.1.15');
    const info = getDeviceInfo();
    expect(info.deviceType).toBe('tablet');
    expect(info.deviceLabel).toBe('iPad Safari');
  });

  it('classifies Windows Chrome user agent as desktop', () => {
    setUa('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    const info = getDeviceInfo();
    expect(info.deviceType).toBe('desktop');
    expect(info.deviceLabel).toContain('Windows');
    expect(info.deviceLabel).toContain('Chrome');
  });

  it('classifies Android user agent as mobile', () => {
    setUa('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36');
    const info = getDeviceInfo();
    expect(info.deviceType).toBe('mobile');
    expect(info.deviceLabel).toContain('Android');
    expect(info.deviceLabel).toContain('Chrome');
  });

  it('classifies MacBook Safari user agent as desktop', () => {
    setUa('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15');
    const info = getDeviceInfo();
    expect(info.deviceType).toBe('desktop');
    expect(info.deviceLabel).toContain('MacBook');
    expect(info.deviceLabel).toContain('Safari');
  });
});

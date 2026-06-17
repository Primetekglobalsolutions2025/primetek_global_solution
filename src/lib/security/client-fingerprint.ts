/**
 * Client-side Device Fingerprinting Utility
 * 
 * Generates a persistent fingerprint that helps identify unique browser/device configurations.
 * Stores a random seed in localStorage to maintain persistence across sessions,
 * combined with hardware/browser details.
 * 
 * SECURITY NOTE (AUDIT M-7):
 * Storing device fingerprint values in localStorage without encryption or server-side signatures
 * makes them susceptible to XSS attacks and manual token cloning/extraction. An attacker who gains
 * JS execution could steal the fingerprint value to bypass device trust restrictions or spoof session transfers.
 * To mitigate this in highly secure environments, consider signing the fingerprint using a server-managed
 * cryptographic key, storing it in HttpOnly cookies, or verifying it alongside client-attestation APIs.
 */

export function getOrCreateFingerprint(): string {
  if (typeof window === 'undefined') return '';
  
  try {
    // 1. Try to load from localStorage first
    const fp = localStorage.getItem('pm_device_fp');
    if (fp) {
      return fp;
    }
    
    // 2. Generate a hardware/browser entropy fingerprint
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let canvasHash = '';
    if (ctx) {
      canvas.width = 200;
      canvas.height = 50;
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('PrimetekGlobalSolution', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('PrimetekGlobalSolution', 4, 17);
      
      const dataUrl = canvas.toDataURL();
      let hash = 0;
      for (let i = 0; i < dataUrl.length; i++) {
        hash = (hash << 5) - hash + dataUrl.charCodeAt(i);
        hash |= 0;
      }
      canvasHash = Math.abs(hash).toString(16);
    }
    
    const parts = [
      navigator.userAgent,
      navigator.language,
      screen.colorDepth,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 'unknown',
      canvasHash
    ];
    
    const str = parts.join('||');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    
    // Combine standard hardware entropy with a random suffix for guaranteed collision avoidance
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const derivedFp = `fp-${Math.abs(hash).toString(16)}-${randomSuffix}`;
    
    localStorage.setItem('pm_device_fp', derivedFp);
    return derivedFp;
  } catch {
    const backupFp = `fp-fallback-${Math.random().toString(36).substring(2, 15)}`;
    try {
      localStorage.setItem('pm_device_fp', backupFp);
    } catch {}
    return backupFp;
  }
}

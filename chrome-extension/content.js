/**
 * Primetek Presence System - Telemetry Content Script
 * 
 * Safe, debounced, binary activity tracker.
 * Only tracks THAT interactions occurred, never WHAT was typed or viewed.
 */

let lastReportTime = 0;

function reportTelemetry() {
  const now = Date.now();
  // Throttle messages to background service worker to max 1 per second
  if (now - lastReportTime > 1000) {
    lastReportTime = now;
    try {
      chrome.runtime.sendMessage({ 
        action: 'ACTIVITY_DETECTED', 
        timestamp: now 
      });
    } catch (err) {
      // Safe catch: context might be invalidated when extension reloads
    }
  }
}

// Register listeners with passive: true for scroll/mouse to prevent performance impacts
window.addEventListener('mousemove', reportTelemetry, { passive: true });
window.addEventListener('keydown', reportTelemetry, { passive: true });
window.addEventListener('click', reportTelemetry, { passive: true });
window.addEventListener('scroll', reportTelemetry, { passive: true });

// Listen to visibility changes (e.g. user minimizing browser or switching tab)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    reportTelemetry();
  }
});

/**
 * Primetek Presence System - Telemetry Content Script
 * 
 * Safe, debounced activity tracker with aggregated telemetry counts.
 * Only tracks THAT interactions occurred and their counts, never WHAT was typed or viewed.
 */

// Inject active attribute to notify PWA that the extension is active
document.documentElement.setAttribute('data-primetek-extension-active', 'true');

let lastReportTime = 0;
let clicks = 0;
let keypresses = 0;
let pointerMoves = 0;

function reportTelemetry() {
  const now = Date.now();
  // Throttle messages to background service worker to max 1 per second
  if (now - lastReportTime > 1000) {
    lastReportTime = now;
    try {
      chrome.runtime.sendMessage({ 
        action: 'ACTIVITY_DETECTED', 
        timestamp: now,
        clicks,
        keypresses,
        pointerMoves
      });
      // Reset counters after successfully queueing transmission
      clicks = 0;
      keypresses = 0;
      pointerMoves = 0;
    } catch {
      // Safe catch: context might be invalidated when extension reloads
    }
  }
}

// Register listeners with passive: true for scroll/mouse to prevent performance impacts
window.addEventListener('mousemove', () => {
  pointerMoves++;
}, { passive: true });

window.addEventListener('keydown', () => {
  keypresses++;
}, { passive: true });

window.addEventListener('click', () => {
  clicks++;
}, { passive: true });

window.addEventListener('scroll', () => {
  pointerMoves++; // Scroll activity counts as movement/activity
}, { passive: true });

// Listen to visibility changes (e.g. user minimizing browser or switching tab)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    reportTelemetry();
  }
});

// Periodically flush telemetry every 1 second if there is any active interaction
setInterval(() => {
  if (clicks > 0 || keypresses > 0 || pointerMoves > 0) {
    reportTelemetry();
  }
}, 1000);

// React instantly to clock-in/out state changes from the portal tabs
try {
  const bc = new BroadcastChannel('attendance_tabs');
  bc.onmessage = (e) => {
    if (e && e.data && e.data.type === 'STATE_REFRESH') {
      try {
        chrome.runtime.sendMessage({ action: 'START_TRACKING' });
      } catch {
        // Safe catch for context invalidation
      }
    }
  };
} catch (e) {
  console.warn('Failed to bind to PWA BroadcastChannel:', e);
}


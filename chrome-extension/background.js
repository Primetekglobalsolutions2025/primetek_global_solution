async function getBackendUrl() {
  const data = await chrome.storage.local.get(['backendUrl']);
  return data.backendUrl || 'https://www.primetekglobalsolutions.com';
}

let sequenceNumber = 1;
let currentSessionId = null;
let trackingActive = false;
let statusMessage = 'Initializing...';

// Check state on startup
chrome.runtime.onStartup.addListener(() => {
  initializeTracking();
});

// Check state on installation
chrome.runtime.onInstalled.addListener(() => {
  initializeTracking();
});

// Listen to runtime messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'START_TRACKING') {
    initializeTracking();
    sendResponse({ success: true });
  } else if (request.action === 'STOP_TRACKING') {
    stopTracking();
    sendResponse({ success: true });
  } else if (request.action === 'GET_STATUS') {
    sendResponse({
      trackingActive,
      status: trackingActive ? 'Active' : 'Offline',
      message: statusMessage
    });
  }
  return true;
});

// Listen to alarms for period heartbeats and session retry checks
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'extension-heartbeat') {
    sendHeartbeat();
  } else if (alarm.name === 'session-check' || alarm.name === 'retry-session') {
    initializeTracking();
  }
});

// Trigger a check when user visits the portal tabs to immediately react to web actions
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      const url = new URL(tab.url);
      const isPrimetekHost = url.hostname === 'localhost' || 
                             url.hostname.includes('primetek') || 
                             url.hostname.includes('vercel.app');
      if (isPrimetekHost && !trackingActive) {
        initializeTracking();
      }
    } catch (e) {}
  }
});

async function initializeTracking() {
  const data = await chrome.storage.local.get(['token']);
  if (!data.token) {
    stopTracking('Logged out');
    return;
  }

  statusMessage = 'Connecting to session...';
  
  try {
    const backendUrl = await getBackendUrl();
    const response = await fetch(`${backendUrl}/api/extension/session`, {
      headers: {
        'Authorization': `Bearer ${data.token}`
      }
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      stopTracking('Authentication failed');
      return;
    }

    if (!result.sessionActive) {
      stopTracking('Waiting for Clock-In (PWA)');
      // Periodically check every 3 minutes if employee clocks in via PWA
      chrome.alarms.create('session-check', {
        periodInMinutes: 3
      });
      return;
    }

    currentSessionId = result.sessionId;
    trackingActive = true;
    statusMessage = 'Active / Syncing heartbeats';

    // Clear waiting/retry alarms
    chrome.alarms.clear('session-check');
    chrome.alarms.clear('retry-session');

    // Set up alarm to trigger heartbeat every 90 seconds (1.5 minutes)
    chrome.alarms.create('extension-heartbeat', {
      periodInMinutes: 1.5
    });

    // Send initial heartbeat immediately
    sendHeartbeat();
  } catch (err) {
    console.error('Session connection failed:', err);
    statusMessage = 'Offline / Connection lost';
    trackingActive = false;
    // Retry in 1 minute
    chrome.alarms.create('retry-session', { delayInMinutes: 1 });
  }
}

function stopTracking(message = 'Disconnected') {
  trackingActive = false;
  currentSessionId = null;
  statusMessage = message;
  chrome.alarms.clearAll();
}

async function sendHeartbeat() {
  if (!trackingActive || !currentSessionId) return;

  const data = await chrome.storage.local.get(['token']);
  if (!data.token) {
    stopTracking('Logged out');
    return;
  }

  // Determine user idle state natively (within 120 seconds threshold)
  chrome.idle.queryState(120, async (idleState) => {
    const activeWindow = (idleState === 'active');

    try {
      const backendUrl = await getBackendUrl();
      const response = await fetch(`${backendUrl}/api/extension/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.token}`
        },
        body: JSON.stringify({
          sessionId: currentSessionId,
          sequenceNumber: sequenceNumber++,
          activeWindow: activeWindow,
          clicks: 0,
          keypresses: 0,
          pointerMoves: 0
        })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        // If session was closed on server side (e.g. clocked out)
        if (response.status === 400 || response.status === 404) {
          stopTracking('Session ended / Clocked out');
          // Schedule session checks to see when they clock in next
          chrome.alarms.create('session-check', {
            periodInMinutes: 3
          });
        }
      }
    } catch (err) {
      console.error('Heartbeat ping failed:', err);
      // We don't stop tracking on single heartbeat failure, just log it.
    }
  });
}

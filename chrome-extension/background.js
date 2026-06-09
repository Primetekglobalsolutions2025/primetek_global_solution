async function getBackendUrl() {
  const data = await chrome.storage.local.get(['backendUrl']);
  return data.backendUrl || 'https://www.primetekglobalsolutions.com';
}

let sequenceNumber = 1;
let currentSessionId = null;
let trackingActive = false;
let statusMessage = 'Initializing...';
let lastActivity = Date.now();
let onBreak = false;

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
    const status = trackingActive 
      ? (onBreak ? 'break' : (Date.now() - lastActivity > 5 * 60 * 1000 ? 'idle' : 'working')) 
      : 'offline';
    sendResponse({
      trackingActive,
      status,
      lastActivity,
      onBreak,
      message: statusMessage
    });
  } else if (request.action === 'TOGGLE_BREAK') {
    onBreak = !onBreak;
    // Send presence heartbeat immediately to sync status
    sendHeartbeat();
    sendResponse({ success: true, onBreak });
  } else if (request.action === 'ACTIVITY_DETECTED') {
    lastActivity = request.timestamp || Date.now();
    sendResponse({ success: true });
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
  let stored = await chrome.storage.local.get(['token']);
  const backendUrl = await getBackendUrl();

  // Try to sync state from cookies if token is missing
  if (!stored.token) {
    try {
      const cookie = await chrome.cookies.get({ url: backendUrl, name: 'employee-auth-token' });
      if (cookie && cookie.value) {
        const token = cookie.value;
        const response = await fetch(`${backendUrl}/api/auth/me?role=employee`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const result = await response.json();
          if (result.user && (result.user.role === 'employee' || result.user.role === 'hr')) {
            const employee = {
              id: result.user.id,
              name: result.user.name,
              email: result.user.email,
              role: result.user.role
            };
            await chrome.storage.local.set({ token, employee });
            stored = { token };
          }
        }
      }
    } catch (e) {
      console.warn('Background cookie auth sync failed:', e);
    }
  }

  if (!stored.token) {
    stopTracking('Logged out');
    return;
  }

  // Active tracking is enabled as long as we are logged into the extension
  trackingActive = true;
  statusMessage = 'Active / Syncing heartbeats';

  // Create the heartbeat alarm (runs every 90 seconds)
  chrome.alarms.create('extension-heartbeat', {
    periodInMinutes: 1.5
  });

  // Query PWA session to check if clocked in (required for attendance heartbeats)
  try {
    const response = await fetch(`${backendUrl}/api/extension/session`, {
      headers: {
        'Authorization': `Bearer ${stored.token}`
      }
    });

    const result = await response.json();
    if (response.ok && result.success && result.sessionActive) {
      currentSessionId = result.sessionId;
      statusMessage = 'Active / Syncing heartbeats';
      chrome.alarms.clear('session-check');
      chrome.alarms.clear('retry-session');
    } else {
      currentSessionId = null;
      statusMessage = 'Waiting for Clock-In (PWA)';
      // Periodically check every 3 minutes if employee clocks in via PWA
      chrome.alarms.create('session-check', {
        periodInMinutes: 3
      });
    }
  } catch (err) {
    console.error('Session connection failed:', err);
    currentSessionId = null;
    statusMessage = 'Offline / Connection lost';
    // Retry in 1 minute
    chrome.alarms.create('retry-session', { delayInMinutes: 1 });
  }

  // Send initial heartbeat immediately to register presence
  sendHeartbeat();
}

function stopTracking(message = 'Disconnected') {
  trackingActive = false;
  currentSessionId = null;
  onBreak = false;
  statusMessage = message;
  chrome.alarms.clearAll();
}

async function sendHeartbeat() {
  if (!trackingActive) return;

  const data = await chrome.storage.local.get(['token', 'employee']);
  if (!data.token || !data.employee || !data.employee.id) {
    stopTracking('Logged out');
    return;
  }

  const backendUrl = await getBackendUrl();
  const employeeId = data.employee.id;

  // Determine user idle state natively (within 120 seconds threshold)
  chrome.idle.queryState(120, async (idleState) => {
    const activeWindow = (idleState === 'active');

    // 1. Dispatch Attendance Heartbeat (if sessionId exists)
    if (currentSessionId) {
      try {
        await fetch(`${backendUrl}/api/extension/heartbeat`, {
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
        }).then(async (response) => {
          if (!response.ok) {
            if (response.status === 400 || response.status === 404) {
              stopTracking('Session ended / Clocked out');
              chrome.alarms.create('session-check', {
                periodInMinutes: 3
              });
            }
          }
        });
      } catch (err) {
        console.error('Attendance heartbeat ping failed:', err);
      }
    }

    // 2. Dispatch Real-Time Presence Heartbeat
    let presenceStatus = 'working';
    if (onBreak) {
      presenceStatus = 'break';
    } else {
      const isIdleByTime = (Date.now() - lastActivity > 5 * 60 * 1000);
      const isIdleByChrome = (idleState !== 'active');
      if (isIdleByTime || isIdleByChrome) {
        presenceStatus = 'idle';
      }
    }

    try {
      await fetch(`${backendUrl}/api/presence/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.token}`
        },
        body: JSON.stringify({
          employeeId: employeeId,
          status: presenceStatus,
          lastActivity: lastActivity
        })
      });
    } catch (err) {
      console.error('Presence heartbeat ping failed:', err);
    }
  });
}

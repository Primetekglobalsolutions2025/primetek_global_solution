// public/workers/idle-worker.js

let ports = [];
let lastActivity = Date.now();
const idleThreshold = 300000;      // 5 minutes of inactivity -> Idle (matches Supabase sweep_active_sessions_telemetry)
const autoBreakThreshold = 420000; // 7 minutes of inactivity -> Break (Auto) (matches Supabase sweep_active_sessions_telemetry)
let state = 'Working';             // Working, Idle, Break (Auto)

self.onconnect = function (e) {
  const port = e.ports[0];
  ports.push(port);
  
  port.onmessage = function (event) {
    const data = event.data;
    
    switch (data.type) {
      case 'ACTIVITY':
        // If we are currently Idle or on Break (Auto), automatically resume back to Working
        if (state === 'Idle' || state === 'Break (Auto)') {
          updateState('Working');
        }
        lastActivity = Date.now();
        broadcast({ type: 'STATE_CHANGED', state: 'Working', lastActivity });
        break;
        
      case 'SET_STATE':
        updateState(data.state);
        break;
        
      case 'PING':
        port.postMessage({ type: 'PONG', state, lastActivity });
        break;
    }
  };

  // Sync initial state to newly opened tab
  port.postMessage({ type: 'STATE_CHANGED', state, lastActivity });
};

function updateState(newState) {
  state = newState;
  broadcast({ type: 'STATE_CHANGED', state, lastActivity });
}

function broadcast(msg) {
  // Filter out disconnected or inactive ports
  ports = ports.filter(port => {
    try {
      port.postMessage(msg);
      return true;
    } catch {
      return false; 
    }
  });
}

// Tick interval to check inactivity triggers (every 1 second)
setInterval(() => {
  const now = Date.now();
  const timeSinceActivity = now - lastActivity;
  
  if (state === 'Working' && timeSinceActivity >= idleThreshold && timeSinceActivity < autoBreakThreshold) {
    state = 'Idle';
    broadcast({ type: 'STATE_CHANGED', state: 'Idle', lastActivity });
  } else if ((state === 'Working' || state === 'Idle') && timeSinceActivity >= autoBreakThreshold) {
    state = 'Break (Auto)';
    broadcast({ type: 'TRIGGER_AUTO_BREAK', lastActivity });
  }
}, 1000);

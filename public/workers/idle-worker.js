// public/workers/idle-worker.js

let ports = [];
let lastActivity = Date.now();
let idleThreshold = 300000; // 5 minutes standard
let warningThreshold = 60000; // 60 seconds warning countdown
let state = 'ACTIVE'; // ACTIVE, WARNING, ON_BREAK

self.onconnect = function (e) {
  const port = e.ports[0];
  ports.push(port);
  
  port.onmessage = function (event) {
    const data = event.data;
    
    switch (data.type) {
      case 'ACTIVITY':
        // If we are currently warning or idle, resume back to active
        if (state === 'WARNING' || state === 'ON_BREAK') {
          updateState('ACTIVE');
        }
        lastActivity = Date.now();
        broadcast({ type: 'STATE_CHANGED', state: 'ACTIVE', lastActivity });
        break;
        
      case 'CONFIG':
        if (data.idleThreshold !== undefined) {
          idleThreshold = data.idleThreshold;
        }
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
    } catch (err) {
      return false; 
    }
  });
}

// Tick interval to check inactivity triggers (every 1 second)
setInterval(() => {
  const now = Date.now();
  const timeSinceActivity = now - lastActivity;
  
  if (state === 'ACTIVE' && timeSinceActivity >= idleThreshold) {
    state = 'WARNING';
    broadcast({ type: 'STATE_CHANGED', state: 'WARNING', lastActivity });
  } else if (state === 'WARNING' && timeSinceActivity >= (idleThreshold + warningThreshold)) {
    state = 'ON_BREAK';
    broadcast({ type: 'TRIGGER_AUTO_BREAK', lastActivity });
  }
}, 1000);

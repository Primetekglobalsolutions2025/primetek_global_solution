let BACKEND_URL = 'https://www.primetekglobalsolutions.com';

async function resolveBackendUrl() {
  const stored = await chrome.storage.local.get(['backendUrl']);
  if (stored.backendUrl) {
    BACKEND_URL = stored.backendUrl;
  }

  // Check the active tab to see if it belongs to Primetek (localhost or vercel)
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const url = new URL(tab.url);
      const isPrimetekHost = url.hostname === 'localhost' || 
                             url.hostname.includes('primetek') || 
                             url.hostname.includes('vercel.app');
      
      if (isPrimetekHost) {
        BACKEND_URL = url.origin;
        await chrome.storage.local.set({ backendUrl: BACKEND_URL });
      }
    }
  } catch (e) {
    console.warn('Failed to auto-detect backend URL:', e);
  }
  return BACKEND_URL;
}

document.addEventListener('DOMContentLoaded', async () => {
  await resolveBackendUrl();

  const loginScreen = document.getElementById('login-screen');
  const statusScreen = document.getElementById('status-screen');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const serverUrlInput = document.getElementById('server-url');
  const errorBox = document.getElementById('error-box');
  const errorBoxText = errorBox.querySelector('span');
  const empNameSpan = document.getElementById('emp-name');
  const connHostSpan = document.getElementById('conn-host');
  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');

  // Pre-fill backend URL input and display host
  serverUrlInput.value = BACKEND_URL;
  connHostSpan.textContent = BACKEND_URL.replace('http://', '').replace('https://', '');

  // 1. Initial State Check
  const data = await chrome.storage.local.get(['token', 'employee']);
  if (data.token && data.employee) {
    showStatusScreen(data.employee);
  } else {
    showLoginScreen();
  }

  // 2. Handle Login Click
  loginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const serverUrl = serverUrlInput.value.trim().replace(/\/$/, '');

    if (!email || !password || !serverUrl) {
      showError('Please fill in all fields.');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in…';
    hideError();

    // Update backend URL dynamically from input
    BACKEND_URL = serverUrl;
    await chrome.storage.local.set({ backendUrl: BACKEND_URL });
    connHostSpan.textContent = BACKEND_URL.replace('http://', '').replace('https://', '');

    try {
      const response = await fetch(`${BACKEND_URL}/api/extension/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        showError(result.error || 'Login failed.');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Log In';
        return;
      }

      // Store credentials locally
      await chrome.storage.local.set({
        token: result.token,
        employee: result.employee
      });

      // Notify background script to start heartbeat loop
      chrome.runtime.sendMessage({ action: 'START_TRACKING' });

      showStatusScreen(result.employee);
    } catch (err) {
      showError('Cannot connect to server.');
      loginBtn.disabled = false;
      loginBtn.textContent = 'Log In';
    }
  });

  // 3. Handle Logout Click
  logoutBtn.addEventListener('click', async () => {
    await chrome.storage.local.clear();
    // Notify background script to stop heartbeat loop
    chrome.runtime.sendMessage({ action: 'STOP_TRACKING' });
    showLoginScreen();
  });

  // --- JOB EXTRACTOR LOGIC ---
  const jobRoleSelect = document.getElementById('job-role');
  const clientNameSelect = document.getElementById('client-name');
  const jobUrlInput = document.getElementById('job-url');
  const exportBtn = document.getElementById('export-sheet-btn');
  const exportStatus = document.getElementById('export-status');
  const exportStatusText = exportStatus.querySelector('span');

  if (exportBtn) {
    exportBtn.textContent = 'Save Application';
  }

  // Automatically parse job info from active tab
  async function runJobExtractor() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) return;

      jobUrlInput.value = tab.url;
    } catch (e) {
      console.warn('Failed to parse page telemetry details:', e);
    }
  }

  // Fetch assigned clients from Next.js server
  async function fetchAssignedClients() {
    try {
      const localData = await chrome.storage.local.get(['token']);
      if (!localData.token) return;

      const response = await fetch(`${BACKEND_URL}/api/extension/clients`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localData.token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch clients');

      const result = await response.json();
      if (result.success && result.clients) {
        populateClientsDropdown(result.clients);
      }
    } catch (err) {
      console.error('Failed to load assigned clients:', err);
    }
  }

  function populateClientsDropdown(clients) {
    if (!clientNameSelect) return;

    // Reset dropdown
    clientNameSelect.innerHTML = '<option value="General">General / Direct</option>';

    clients.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.client_name;
      opt.textContent = c.client_name;
      opt.setAttribute('data-role', c.client_role || '');
      clientNameSelect.appendChild(opt);
    });
  }

  // Auto-fill Job Role when Client selection changes
  if (clientNameSelect) {
    clientNameSelect.addEventListener('change', () => {
      const selectedOpt = clientNameSelect.options[clientNameSelect.selectedIndex];
      const targetRole = selectedOpt.getAttribute('data-role');
      if (targetRole && jobRoleSelect) {
        let found = false;
        for (let i = 0; i < jobRoleSelect.options.length; i++) {
          if (jobRoleSelect.options[i].value.toLowerCase() === targetRole.toLowerCase()) {
            jobRoleSelect.selectedIndex = i;
            found = true;
            break;
          }
        }
        if (!found) {
          jobRoleSelect.value = 'Other';
        }
      }
    });
  }

  exportBtn.addEventListener('click', async () => {
    const jobRole = jobRoleSelect.value.trim();
    const clientName = clientNameSelect.value.trim();
    const applicationUrl = jobUrlInput.value.trim();

    if (!jobRole || !clientName || !applicationUrl) {
      showExportStatus('Please fill in Job Role, Client, and URL.', 'error');
      return;
    }

    exportBtn.disabled = true;
    exportBtn.textContent = 'Saving…';
    hideExportStatus();

    const localData = await chrome.storage.local.get(['token']);
    if (!localData.token) {
      showExportStatus('Unauthorized: Please log in again.', 'error');
      exportBtn.disabled = false;
      exportBtn.textContent = 'Save Application';
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/extension/save-job`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localData.token}`
        },
        body: JSON.stringify({
          jobRole,
          clientName,
          applicationUrl
        })
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok && result.success) {
        showExportStatus('Successfully saved to spreadsheet database!', 'success');
        setTimeout(() => {
          hideExportStatus();
        }, 4000);
      } else {
        showExportStatus(result.error || 'Failed to save application.', 'error');
      }
    } catch (err) {
      console.error('Save job error:', err);
      showExportStatus('Connection error: cannot reach backend portal.', 'error');
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = 'Save Application';
    }
  });

  function showExportStatus(msg, type) {
    exportStatusText.textContent = msg;
    exportStatus.className = `status-msg-box ${type}`;
    exportStatus.classList.remove('hidden');
  }

  function hideExportStatus() {
    exportStatus.classList.add('hidden');
  }

  // Helper Functions
  function showLoginScreen() {
    loginScreen.classList.remove('hidden');
    statusScreen.classList.add('hidden');
    loginBtn.disabled = false;
    loginBtn.textContent = 'Log In';
    emailInput.value = '';
    passwordInput.value = '';
  }

  function showStatusScreen(employee) {
    loginScreen.classList.add('hidden');
    statusScreen.classList.remove('hidden');
    empNameSpan.textContent = employee.name;
    
    // Check status from background tracking
    chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (response) => {
      if (response && response.trackingActive) {
        setWorkingStatus(response.status || 'Active');
      } else {
        setInactiveStatus(response?.message || 'Idle / Not Working');
      }
    });

    // Run active job details scraper
    runJobExtractor();
    
    // Fetch employee's assigned clients
    fetchAssignedClients();
  }

  function setWorkingStatus(text) {
    statusBadge.className = 'status-badge status-active';
    statusText.textContent = text;
  }

  function setInactiveStatus(text) {
    statusBadge.className = 'status-badge status-inactive';
    statusText.textContent = text;
  }

  function showError(msg) {
    if (errorBoxText) {
      errorBoxText.textContent = msg;
    } else {
      errorBox.textContent = msg;
    }
    errorBox.classList.remove('hidden');
  }

  function hideError() {
    errorBox.classList.add('hidden');
  }
});

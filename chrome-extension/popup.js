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
  const jobTitleInput = document.getElementById('job-title');
  const clientNameInput = document.getElementById('client-name');
  const jobUrlInput = document.getElementById('job-url');
  const jobTypeInput = document.getElementById('job-type');
  const webhookInput = document.getElementById('sheet-webhook');
  const exportBtn = document.getElementById('export-sheet-btn');
  const exportStatus = document.getElementById('export-status');
  const exportStatusText = exportStatus.querySelector('span');

  // Load saved webhook URL
  chrome.storage.local.get(['sheetWebhookUrl'], (res) => {
    if (res.sheetWebhookUrl) {
      webhookInput.value = res.sheetWebhookUrl;
    }
  });

  // Automatically parse job info from active tab
  async function runJobExtractor() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) return;

      jobUrlInput.value = tab.url;

      // Auto-detect application platform Type
      let autoType = 'Other';
      if (tab.url.includes('linkedin.com')) {
        autoType = 'LinkedIn';
      } else if (tab.url.includes('upwork.com')) {
        autoType = 'Upwork';
      } else if (tab.url.includes('indeed.com')) {
        autoType = 'Indeed';
      }
      jobTypeInput.value = autoType;

      // Clean tab title for fallback job title
      let fallbackTitle = tab.title || '';
      fallbackTitle = fallbackTitle.replace(/ \| Upwork$/i, '')
                                   .replace(/ \| LinkedIn$/i, '')
                                   .replace(/ - Indeed\.com$/i, '')
                                   .replace(/ \- Indeed$/i, '')
                                   .trim();
      jobTitleInput.value = fallbackTitle;
      clientNameInput.value = ''; // Reset company name

      // Execute script on tab to scrape precise details
      if (tab.url.startsWith('http://') || tab.url.startsWith('https://')) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            let extractedTitle = '';
            let extractedCompany = '';
            const pageUrl = window.location.href;

            if (pageUrl.includes('linkedin.com')) {
              const tEl = document.querySelector('.job-details-jobs-unified-top-card__job-title') || 
                          document.querySelector('.jobs-unified-top-card__job-title') || 
                          document.querySelector('h1');
              if (tEl) extractedTitle = tEl.innerText.trim();

              const cEl = document.querySelector('.job-details-jobs-unified-top-card__company-name') ||
                          document.querySelector('.jobs-unified-top-card__company-name') ||
                          document.querySelector('.jobs-unified-top-card__company-name a');
              if (cEl) extractedCompany = cEl.innerText.trim();
            } 
            else if (pageUrl.includes('upwork.com')) {
              const tEl = document.querySelector('.job-title') || 
                          document.querySelector('h1') || 
                          document.querySelector('h2');
              if (tEl) extractedTitle = tEl.innerText.trim();

              const cEl = document.querySelector('[data-qa="client-feedback"] .client-name') ||
                          document.querySelector('.client-name') ||
                          document.querySelector('[data-qa="client-country"]') ||
                          document.querySelector('[data-qa="about-client"] strong');
              if (cEl) extractedCompany = cEl.innerText.trim();
            } 
            else if (pageUrl.includes('indeed.com')) {
              const tEl = document.querySelector('h1') || 
                          document.querySelector('.jobsearch-JobInfoHeader-title');
              if (tEl) extractedTitle = tEl.innerText.trim();

              const cEl = document.querySelector('div[data-company-name="true"]') || 
                          document.querySelector('.jobsearch-CompanyInfoContainer') ||
                          document.querySelector('.jobsearch-InlineCompanyRating a');
              if (cEl) extractedCompany = cEl.innerText.trim();
            }

            return { extractedTitle, extractedCompany };
          }
        }, (results) => {
          if (results && results[0] && results[0].result) {
            const { extractedTitle, extractedCompany } = results[0].result;
            if (extractedTitle) jobTitleInput.value = extractedTitle;
            if (extractedCompany) clientNameInput.value = extractedCompany;
          }
        });
      }
    } catch (e) {
      console.warn('Failed to parse page telemetry details:', e);
    }
  }

  exportBtn.addEventListener('click', async () => {
    const jobTitle = jobTitleInput.value.trim();
    const clientName = clientNameInput.value.trim();
    const applicationUrl = jobUrlInput.value.trim();
    const jobType = jobTypeInput.value.trim();
    const webhookUrl = webhookInput.value.trim();

    if (!jobTitle || !applicationUrl || !webhookUrl || !jobType) {
      showExportStatus('Please fill in Job Title, URL, Type, and Web App URL.', 'error');
      return;
    }

    // Save the webhook URL to local storage
    await chrome.storage.local.set({ sheetWebhookUrl: webhookUrl });

    exportBtn.disabled = true;
    exportBtn.textContent = 'Saving…';
    hideExportStatus();

    // Get logged-in employee name
    const localData = await chrome.storage.local.get(['employee']);
    const employeeName = localData.employee ? localData.employee.name : 'Unknown Employee';

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({
          employeeName,
          jobTitle,
          clientName,
          applicationUrl,
          jobType
        })
      });

      const text = await response.text();
      let result = { success: true };
      try {
        result = JSON.parse(text);
      } catch (e) {}

      if (response.ok && (result.success !== false)) {
        showExportStatus('Successfully saved to Google Sheet!', 'success');
        setTimeout(() => {
          hideExportStatus();
        }, 4000);
      } else {
        showExportStatus(result.error || 'Failed to save to sheet.', 'error');
      }
    } catch (err) {
      console.error('Export fetch error:', err);
      // Fallback for CORS redirect blocks
      showExportStatus('Saved! Please verify in your Google Sheet.', 'success');
      setTimeout(() => {
        hideExportStatus();
      }, 5000);
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = 'Save to Google Sheet';
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

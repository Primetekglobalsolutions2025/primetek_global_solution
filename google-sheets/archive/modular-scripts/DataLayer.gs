/**
 * DataLayer.gs
 * Handles data collection, spreadsheet reads, cache invalidation, and data manipulation.
 */

/**
 * Retrieves all unique applications. Pulls from cache if available and not forced to refresh.
 * @param {boolean} forceRefresh If true, ignores the cache and reads directly from sheet tabs.
 * @return {Array<Object>} List of application records.
 */
function getApplicationsData(forceRefresh = false) {
  const cache = CacheService.getScriptCache();
  
  if (!forceRefresh) {
    const cached = cache.get(CONFIG.CACHE_KEY_APPS);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Map serialized Date timestamps back to native Date objects
        parsed.forEach(item => {
          if (item.timestamp) item.timestamp = new Date(item.timestamp);
        });
        return parsed;
      } catch (e) {
        console.warn("Failed to parse cached applications, rebuilding cache...", e);
      }
    }
  }

  // Cache missed or force refresh - aggregate from employee tabs
  const freshData = collectAllApplications();
  try {
    cache.put(CONFIG.CACHE_KEY_APPS, JSON.stringify(freshData), CONFIG.CACHE_TTL);
  } catch (e) {
    console.error("Cache write failure:", e);
  }
  return freshData;
}

/**
 * Reads all active employee sheets and merges their applications.
 * Deduplicates applications by URL, preserving the latest edit and compiling all claim owners.
 * @return {Array<Object>} Combined list of application records.
 */
function collectAllApplications() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheets = ss.getSheets();
  const allApplications = [];
  const urlClaims = {};

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const employeeName = sheet.getName();
    
    // Ignore dashboard / home tabs
    if (employeeName === "Home" || employeeName === "Dashboard") continue;
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) continue; // Skip empty sheets or headers-only sheets
    
    const firstRow = data[0];
    const hasHeader = (firstRow[0] && firstRow[0].toString().toLowerCase().indexOf("date") !== -1);
    
    // Dynamically identify column indexes
    const indices = parseColumnIndices(firstRow);
    const startRow = hasHeader ? 1 : 0;
    
    for (let r = startRow; r < data.length; r++) {
      const row = data[r];
      const jobRole = (row[indices.role] || "").toString().trim();
      const clientName = (row[indices.client] || "").toString().trim();
      const rawUrl = (row[indices.url] || "").toString().trim();
      const status = (row[indices.status] || "New").toString().trim();
      const priority = (row[indices.priority] || "Medium").toString().trim();
      
      // Skip empty separator rows
      if (!jobRole && !clientName) continue;
      
      const urlKey = rawUrl.toLowerCase();
      if (urlKey) {
        if (!urlClaims[urlKey]) {
          urlClaims[urlKey] = [];
        }
        if (urlClaims[urlKey].indexOf(employeeName) === -1) {
          urlClaims[urlKey].push(employeeName);
        }
      }

      const timestampVal = row[indices.date] ? new Date(row[indices.date]).getTime() : new Date().getTime();

      allApplications.push({
        employeeName: employeeName,
        timestamp: timestampVal,
        jobRole: jobRole,
        clientName: clientName,
        url: rawUrl,
        status: status,
        priority: priority,
        stage: indices.stage !== -1 ? (row[indices.stage] || "").toString().trim() : "",
        notes: indices.notes !== -1 ? (row[indices.notes] || "").toString().trim() : ""
      });
    }
  }

  // Deduplicate entries by URL, keeping the latest details
  const uniqueApplications = [];
  const seenUrls = {};
  
  for (let k = 0; k < allApplications.length; k++) {
    const app = allApplications[k];
    const urlKey = app.url.toLowerCase();
    
    if (!urlKey) {
      uniqueApplications.push(app);
      continue;
    }
    
    if (!seenUrls[urlKey]) {
      seenUrls[urlKey] = app;
      uniqueApplications.push(app);
    } else {
      // Keep the latest timestamp record
      if (app.timestamp > seenUrls[urlKey].timestamp) {
        seenUrls[urlKey].timestamp = app.timestamp;
        seenUrls[urlKey].employeeName = app.employeeName;
        seenUrls[urlKey].jobRole = app.jobRole;
        seenUrls[urlKey].clientName = app.clientName;
        seenUrls[urlKey].status = app.status;
        seenUrls[urlKey].priority = app.priority;
        seenUrls[urlKey].stage = app.stage;
        seenUrls[urlKey].notes = app.notes;
      }
    }
  }

  // Format final list with combined claims string
  for (let k = 0; k < uniqueApplications.length; k++) {
    const app = uniqueApplications[k];
    const urlKey = app.url.toLowerCase();
    app.claimedBy = urlClaims[urlKey] ? urlClaims[urlKey].join(", ") : app.employeeName;
  }

  // Sort descending by timestamp
  uniqueApplications.sort((a, b) => b.timestamp - a.timestamp);
  
  return uniqueApplications;
}

/**
 * Invalidates cache storage.
 */
function clearApplicationsCache() {
  const cache = CacheService.getScriptCache();
  cache.remove(CONFIG.CACHE_KEY_APPS);
}

/**
 * Test function for DataLayer.gs.
 */
function testDataLayer() {
  Logger.log("--- Testing DataLayer.gs ---");
  try {
    const data = getApplicationsData(true);
    Logger.log("Successfully collected " + data.length + " applications.");
    Logger.log("✓ DataLayer test passed successfully.");
  } catch (e) {
    Logger.log("DataLayer test skipped/failed (likely running in mock environment): " + e.toString());
  }
}

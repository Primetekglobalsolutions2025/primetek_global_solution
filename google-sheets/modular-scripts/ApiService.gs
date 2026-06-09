/**
 * ApiService.gs
 * Manages GET/POST web server endpoints, REST actions, and JSON outputs.
 */

/**
 * Handles incoming GET requests.
 * @param {Object} e HTTP request parameters.
 * @return {TextOutput} JSON response payload.
 */
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    return handleGetRequest(params);
  } catch (err) {
    console.error("Error in ApiService.doGet:", err);
    return sendJsonResponse({ error: err.toString() }, false);
  }
}

/**
 * Handles incoming POST requests.
 * @param {Object} e HTTP request payload.
 * @return {TextOutput} JSON response payload.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return sendJsonResponse({ error: "Missing POST payload body contents." }, false);
    }
    
    const payload = JSON.parse(e.postData.contents);
    return handlePostRequest(payload);
  } catch (err) {
    console.error("Error in ApiService.doPost:", err);
    return sendJsonResponse({ error: err.toString() }, false);
  }
}

/**
 * Retrieves applications data and filters by user if requested.
 * @param {Object} params Request parameters.
 * @return {TextOutput} JSON results.
 */
function handleGetRequest(params) {
  const forceRefresh = params.refresh === "true";
  const data = getApplicationsData(forceRefresh);
  
  let resultData = data;
  
  // Optional client-side filter via query param (?employee=John)
  if (params.employee) {
    const empName = params.employee.trim();
    resultData = data.filter(app => 
      app.claimedBy && app.claimedBy.includes(empName)
    );
  }

  return sendJsonResponse({ applications: resultData }, true);
}

/**
 * Adds a new application into the spreadsheet.
 * @param {Object} payload POST body parameters.
 * @return {TextOutput} JSON results.
 */
function handlePostRequest(payload) {
  // 1. Validate payload contents
  const validationError = validateApplication(payload);
  if (validationError) {
    return sendJsonResponse({ error: validationError }, false);
  }

  // 2. Identify target sheet name
  let employeeName = (payload.employeeName || "General").trim();
  employeeName = sanitizeEmployeeName(employeeName);
  
  if (employeeName === "Home" || employeeName === "Dashboard") {
    employeeName = "General";
  }

  // 3. Open Spreadsheet and find/insert sheet tab
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(employeeName);
  
  if (!sheet) {
    sheet = ss.insertSheet(employeeName);
    // Append standard headers matching Employee_Cols config
    sheet.appendRow([
      "Date/Month", 
      "Job Role", 
      "Client Name", 
      "Application URL", 
      "Status", 
      "Priority", 
      "Stage", 
      "Follow-up Date", 
      "Notes"
    ]);
  }
  
  // 4. Append row values
  const dateVal = payload.date ? new Date(payload.date) : new Date();
  const status = payload.status || "New";
  const priority = payload.priority || "Medium";
  const stage = payload.stage || "";
  const notes = payload.notes || "";
  const followUpDate = payload.followUpDate ? new Date(payload.followUpDate) : "";

  sheet.appendRow([
    dateVal,
    (payload.jobRole || "").toString().trim(),
    (payload.clientName || "").toString().trim(),
    (payload.applicationUrl || "").toString().trim(),
    status,
    priority,
    stage,
    followUpDate,
    notes
  ]);

  // Apply visual theme formatting to employee tab
  formatSheetTheme(sheet);
  
  // 5. Invalidate the Cache and refresh Home tab grid
  clearApplicationsCache();
  refreshHomeTab(ss);
  
  return sendJsonResponse({ message: "Application successfully added!" }, true);
}

/**
 * Standardizes HTTP JSON output formats.
 * @param {Object} data Output payload.
 * @param {boolean} success True if operation succeeded.
 * @return {TextOutput} TextOutput JSON.
 */
function sendJsonResponse(data, success = true) {
  const response = {
    success: success,
    timestamp: new Date().getTime(),
    data: data
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test function for ApiService.gs.
 */
function testApiService() {
  Logger.log("--- Testing ApiService.gs ---");
  const response = sendJsonResponse({ test: "data" }, true);
  assert(response.getMimeType() === ContentService.MimeType.JSON, "Mimetype mismatch");
  Logger.log("✓ ApiService test passed successfully.");
}

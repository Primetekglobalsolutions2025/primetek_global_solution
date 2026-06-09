/**
 * ApiService.gs
 * Exposes REST Web API endpoints for external integrations.
 */

/**
 * Handles Web App GET requests.
 * @param {Object} e Request parameters.
 * @return {TextOutput} JSON response output.
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
 * Handles Web App POST requests.
 * @param {Object} e Payload details.
 * @return {TextOutput} JSON response output.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return sendJsonResponse({ error: "Missing payload POST contents." }, false);
    }
    const payload = JSON.parse(e.postData.contents);
    return handlePostRequest(payload);
  } catch (err) {
    console.error("Error in ApiService.doPost:", err);
    return sendJsonResponse({ error: err.toString() }, false);
  }
}

/**
 * Pulls application records and filters by user query.
 * @param {Object} params URL search parameters.
 * @return {TextOutput} JSON data.
 */
function handleGetRequest(params) {
  const forceRefresh = params.refresh === "true";
  const data = getApplicationsData(forceRefresh);
  let resultData = data;
  
  // Custom filter check (?employee=John)
  if (params.employee) {
    const empName = params.employee.trim();
    resultData = data.filter(app => 
      app.claimedBy && app.claimedBy.includes(empName)
    );
  }
  return sendJsonResponse({ applications: resultData }, true);
}

/**
 * Inserts new records after validating payloads.
 * @param {Object} payload POST variables payload.
 * @return {TextOutput} JSON response message.
 */
function handlePostRequest(payload) {
  // 1. Validate inputs
  const validationError = ValidationService.validateApplication(payload);
  if (validationError) {
    return sendJsonResponse({ error: validationError }, false);
  }

  // 2. Aggregate consolidated list for duplicate checks
  const existingApps = getApplicationsData(false);
  const duplicateMsg = ValidationService.detectDuplicates(existingApps, payload);
  if (duplicateMsg) {
    return sendJsonResponse({ error: duplicateMsg }, false);
  }

  // 3. Resolve target employee name
  let employeeName = (payload.employeeName || "General").trim();
  employeeName = ValidationService.sanitizeEmployeeName(employeeName);
  
  if (employeeName === "Home" || employeeName === "Dashboard") {
    employeeName = "General";
  }

  // 4. Append row to sheet using Repository layer
  ApplicationRepository.save(employeeName, payload);
  
  // 5. Invalidate script cache and update Home tab grid
  AppCacheService.clear();
  
  const ss = getActiveSpreadsheet();
  refreshHomeTab(ss);
  
  return sendJsonResponse({ message: "Job Application successfully created!" }, true);
}

/**
 * Standardizes API responses.
 * @param {Object} data Output payload.
 * @param {boolean} success True if successful.
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
 * Test Api endpoints.
 */
function testApiService() {
  Logger.log("Api service check completed.");
}

/**
 * ValidationService.gs
 * Provides robust validation logic for inputs, URLs, emails, and sheet names.
 */

/**
 * Validates full application data payload.
 * @param {Object} data Input parameters payload.
 * @return {string|null} Error message if invalid, or null if valid.
 */
function validateApplication(data) {
  if (!data) return "Payload payload is empty or invalid.";
  
  if (!data.jobRole || sanitizeInput(data.jobRole) === "") {
    return "Missing or empty required field: jobRole";
  }
  
  if (!data.clientName || sanitizeInput(data.clientName) === "") {
    return "Missing or empty required field: clientName";
  }
  
  if (!data.applicationUrl || sanitizeInput(data.applicationUrl) === "") {
    return "Missing or empty required field: applicationUrl";
  }
  
  if (!validateUrl(data.applicationUrl)) {
    return "Invalid applicationUrl format: URL must begin with http:// or https://";
  }

  return null;
}

/**
 * Validates website URLs.
 * @param {string} url The URL.
 * @return {boolean} Valid or not.
 */
function validateUrl(url) {
  if (!url) return false;
  const cleanUrl = url.trim().toLowerCase();
  return cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://");
}

/**
 * Validates email addresses.
 * @param {string} email Email string.
 * @return {boolean} Valid or not.
 */
function validateEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Checks if a string is a valid sheet/employee name.
 * @param {string} name Employee tab name.
 * @return {boolean} Valid or not.
 */
function validateEmployee(name) {
  if (!name) return false;
  const cleanName = sanitizeEmployeeName(name);
  if (cleanName === "" || cleanName === "Home" || cleanName === "Dashboard") {
    return false;
  }
  return true;
}

/**
 * Sanitizes strings for use as Google Sheet tab names (replaces invalid chars).
 * @param {string} name Employee name.
 * @return {string} Sanitized name.
 */
function sanitizeEmployeeName(name) {
  if (!name) return "General";
  return name.toString().trim()
    .replace(/[\\\/\?\*\:\[\]]/g, '') // Remove chars disallowed by Sheets
    .substring(0, 31); // Sheets max tab length is 31 chars
}

/**
 * Test function for ValidationService.gs.
 */
function testValidationService() {
  Logger.log("--- Testing ValidationService.gs ---");
  
  // Test validateUrl
  assert(validateUrl("https://example.com"), "HTTPS URL failed validation");
  assert(!validateUrl("example.com"), "Missing protocol URL passed validation");
  
  // Test validateEmail
  assert(validateEmail("user@domain.com"), "Standard email failed validation");
  assert(!validateEmail("userdomain.com"), "Missing symbol email passed validation");
  
  // Test sanitizeEmployeeName
  assert(sanitizeEmployeeName("John / Doe") === "John  Doe", "Tab name sanitization failed");
  
  Logger.log("✓ ValidationService test passed successfully.");
}

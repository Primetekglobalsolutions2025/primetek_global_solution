/**
 * Utils.gs
 * Reusable utility functions for parsing, formatting, sanitization, and identification.
 */

/**
 * Dynamically determines columns indices based on the headers row.
 * @param {Array<string>} headerRow Array of header strings.
 * @return {Object} Dictionary of keys mapping to index values.
 */
function parseColumnIndices(headerRow) {
  if (!headerRow || headerRow.length === 0) {
    return { date: 0, role: 1, client: 2, url: 3, status: 4, priority: 5 };
  }
  
  const headers = headerRow.map(h => h.toString().toLowerCase().trim());
  
  return {
    date: headers.findIndex(h => h.includes("date") || h.includes("month")),
    role: headers.findIndex(h => h.includes("role") || h.includes("job")),
    client: headers.findIndex(h => h.includes("client") || h.includes("company")),
    url: headers.findIndex(h => h.includes("url") || h.includes("link")),
    status: headers.findIndex(h => h.includes("status")),
    priority: headers.findIndex(h => h.includes("priority")),
    stage: headers.findIndex(h => h.includes("stage")),
    followUp: headers.findIndex(h => h.includes("follow")),
    notes: headers.includes("notes") ? headers.indexOf("notes") : -1
  };
}

/**
 * Sanitizes input text to prevent basic injections and format anomalies.
 * @param {string} text Raw text input.
 * @return {string} Sanitized clean text.
 */
function sanitizeInput(text) {
  if (text === null || text === undefined) return "";
  return text.toString().trim()
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/[\n\r]+/g, ' '); // Strip carriage returns
}

/**
 * Formats a Date object as a standardized string.
 * @param {Date|number|string} date Date object or timestamp.
 * @return {string} Standardized date string (YYYY-MM-DD).
 */
function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

/**
 * Generates a unique secure UUID.
 * @return {string} Unique UUID string.
 */
function generateId() {
  return Utilities.getUuid();
}

/**
 * Validates whether the provided text matches standard URL formats.
 * @param {string} url Input string.
 * @return {boolean} True if URL is valid format.
 */
function isValidUrl(url) {
  if (!url) return false;
  const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
  return urlPattern.test(url);
}

/**
 * Filters array to return unique elements.
 * @param {Array} array Inputs.
 * @return {Array} Deduplicated items.
 */
function arrayUnique(array) {
  if (!array || !Array.isArray(array)) return [];
  return array.filter((value, index, self) => self.indexOf(value) === index);
}

/**
 * Helper to check a condition and log test outcomes.
 * @param {boolean} condition The test condition.
 * @param {string} msg Test case description.
 */
function assert(condition, msg) {
  if (!condition) {
    throw new Error("Assert Failed: " + msg);
  }
}

/**
 * Test function for Utils.gs.
 */
function testUtils() {
  Logger.log("--- Testing Utils.gs ---");
  
  // Test sanitizeInput
  assert(sanitizeInput("<b>Test</b>\nLine") === "Test Line", "Sanitization failed");
  
  // Test generateId
  const uuid = generateId();
  assert(uuid && uuid.length > 20, "UUID generation failed");
  
  // Test isValidUrl
  assert(isValidUrl("https://google.com"), "Valid URL failed check");
  assert(!isValidUrl("not-a-url"), "Invalid URL passed check");
  
  // Test arrayUnique
  const unique = arrayUnique([1, 2, 2, 3, 1]);
  assert(unique.length === 3, "Array unique failed check");
  
  Logger.log("✓ Utils test passed successfully.");
}

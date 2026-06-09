/**
 * Utils.gs
 * Reusable utility helpers and string/data format parsers.
 */

/**
 * Maps employee header row keys to index values.
 * @param {Array<string>} headerRow Headers array.
 * @return {Object} Index map.
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
    notes: headers.includes("notes") ? headers.indexOf("notes") : -1,
    interviewDate: headers.findIndex(h => h.includes("interview") && h.includes("date")),
    salaryRange: headers.findIndex(h => h.includes("salary")),
    recruiterName: headers.findIndex(h => h.includes("recruiter") && h.includes("name")),
    recruiterEmail: headers.findIndex(h => h.includes("recruiter") && h.includes("email")),
    location: headers.findIndex(h => h.includes("location")),
    source: headers.findIndex(h => h.includes("source")),
    lastUpdated: headers.findIndex(h => h.includes("last") && h.includes("update"))
  };
}

/**
 * Strips HTML tags and trims strings.
 * @param {string} text Input text.
 * @return {string} Sanitized text.
 */
function sanitizeInput(text) {
  if (text === null || text === undefined) return "";
  return text.toString().trim()
    .replace(/<[^>]*>/g, '') // Strip tags
    .replace(/[\n\r]+/g, ' '); // Strip carriage returns
}

/**
 * Helper to serialize Date formats.
 * @param {Date|number} date Date.
 * @return {string} ISO Date.
 */
function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

/**
 * UUID generator.
 * @return {string} UUID.
 */
function generateId() {
  return Utilities.getUuid();
}

/**
 * Validates URLs.
 * @param {string} url The URL.
 * @return {boolean} Valid or not.
 */
function isValidUrl(url) {
  if (!url) return false;
  return CONFIG.REGEX.URL.test(url);
}

/**
 * Filters list to return unique values.
 * @param {Array} array Inputs.
 * @return {Array} Matches.
 */
function arrayUnique(array) {
  if (!array || !Array.isArray(array)) return [];
  return array.filter((value, index, self) => self.indexOf(value) === index);
}

/**
 * Returns the active container spreadsheet or falls back to the hardcoded config ID.
 * @return {Spreadsheet} The Spreadsheet object.
 */
function getActiveSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {
    console.warn("SpreadsheetApp.getActiveSpreadsheet() returned null or failed:", e);
  }
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}


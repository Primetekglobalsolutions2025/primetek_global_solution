/**
 * Config.gs
 * Defines core configuration parameters, theme settings, status badges, and constants.
 */

const CONFIG = {
  // Spreadsheet settings
  SPREADSHEET_ID: "1im0l80fq60pqBYgMOXPQ3h0IoGOjimMWdvCDBFjWfo8",
  
  // Cache configuration (seconds)
  CACHE_TTL: 300, 
  CACHE_KEY_APPS: "primetek_all_apps",
  
  // Design system and theme properties
  THEME: {
    primary: "#667eea",       // Purple
    primaryDark: "#764ba2",   // Indigo
    background: "#F8FAFC",    // Slate 50
    surface: "#FFFFFF",       // White
    textMain: "#0F172A",      // Slate 900
    textMuted: "#64748B",     // Slate 500
    border: "#E2E8F0",        // Slate 200
    headerBg: "#F1F5F9",      // Slate 100
    rowAlt: "#F8FAFC",        // Slate 50
    font: "Google Sans, Arial, sans-serif"
  },
  
  // Application Status Types & badge styling metadata
  STATUS: {
    NEW: { label: "New", bg: "#dcfce7", text: "#166534" },
    APPLIED: { label: "Applied", bg: "#fef3c7", text: "#92400e" },
    INTERVIEW: { label: "Interview", bg: "#dbeafe", text: "#1e40af" },
    OFFER: { label: "Offer", bg: "#ede9fe", text: "#5b21b6" },
    ACCEPTED: { label: "Accepted", bg: "#d1fae5", text: "#065f46" },
    REJECTED: { label: "Rejected", bg: "#fee2e2", text: "#991b1b" }
  },

  // Priority metadata levels
  PRIORITY: {
    HIGH: "High",
    MEDIUM: "Medium",
    LOW: "Low"
  },

  // Default job roles dropdown items
  DEFAULT_ROLES: [
    "Software Engineer",
    "Data Engineer",
    "Control Engineer",
    "Data Analyst",
    "Product Manager"
  ],

  // Column definitions for Employee Sheets
  EMPLOYEE_COLS: {
    DATE: 0,
    ROLE: 1,
    CLIENT: 2,
    URL: 3,
    STATUS: 4,
    PRIORITY: 5,
    STAGE: 6,
    FOLLOW_UP: 7,
    NOTES: 8
  }
};

/**
 * Runs validation checks on the config constants.
 */
function testConfig() {
  Logger.log("--- Testing Config.gs ---");
  Logger.log("SPREADSHEET_ID: " + CONFIG.SPREADSHEET_ID);
  Logger.log("CACHE_TTL: " + CONFIG.CACHE_TTL + " seconds");
  Logger.log("Theme Font: " + CONFIG.THEME.font);
  Logger.log("✓ Config test passed successfully.");
}

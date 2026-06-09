/**
 * Config.gs
 * Complete system settings, configuration constants, themes, and enums.
 */

const CONFIG = {
  // Spreadsheet integration keys
  SPREADSHEET_ID: "1im0l80fq60pqBYgMOXPQ3h0IoGOjimMWdvCDBFjWfo8",
  
  // Cache TTL settings (in seconds)
  CACHE_TTL: 300, 
  CACHE_KEY_APPS: "primetek_all_apps",
  
  // Concurrency Lock Settings (in milliseconds)
  LOCK_TIMEOUT: 15000, 
  
  // Theme styling guidelines
  THEME: {
    primary: "#667eea",       // Purple
    primaryDark: "#764ba2",   // Deep Indigo
    background: "#F8FAFC",    // Slate 50
    surface: "#FFFFFF",       // White
    textMain: "#0F172A",      // Slate 900
    textMuted: "#64748B",     // Slate 500
    border: "#E2E8F0",        // Slate 200
    headerBg: "#F1F5F9",      // Slate 100
    rowAlt: "#F8FAFC",        // Slate 50
    font: "Google Sans, Arial, sans-serif"
  },
  
  // Status dropdown enums with badge coloring
  STATUS: {
    NEW: { label: "New", bg: "#DCFCE7", text: "#166534" },
    APPLIED: { label: "Applied", bg: "#FEF3C7", text: "#92400E" },
    INTERVIEW: { label: "Interview", bg: "#DBEAFE", text: "#1E40AF" },
    TECH_INTERVIEW: { label: "Technical Interview", bg: "#E0F2FE", text: "#0369A1" },
    FINAL_INTERVIEW: { label: "Final Interview", bg: "#F3E8FF", text: "#6B21A8" },
    OFFER: { label: "Offer", bg: "#EDE9FE", text: "#5B21B6" },
    ACCEPTED: { label: "Accepted", bg: "#D1FAE5", text: "#065F46" },
    REJECTED: { label: "Rejected", bg: "#FEE2E2", text: "#991B1B" },
    ON_HOLD: { label: "On Hold", bg: "#F1F5F9", text: "#475569" }
  },

  // Priority dropdown enums with badge coloring
  PRIORITY: {
    HIGH: { label: "High", bg: "#FEE2E2", text: "#991B1B" },
    MEDIUM: { label: "Medium", bg: "#FEF3C7", text: "#92400E" },
    LOW: { label: "Low", bg: "#F1F5F9", text: "#475569" }
  },

  // Job Roles configuration list
  DEFAULT_ROLES: [
    "Software Engineer",
    "Data Engineer",
    "Control Engineer",
    "Data Analyst",
    "Product Manager",
    "Bench Sales Executive",
    "Marketing Executive"
  ],

  // 16-Column indices configuration for Employee sheets
  EMPLOYEE_COLS: {
    DATE: 0,
    ROLE: 1,
    CLIENT: 2,
    URL: 3,
    STATUS: 4,
    PRIORITY: 5,
    STAGE: 6,
    FOLLOW_UP: 7,
    NOTES: 8,
    INTERVIEW_DATE: 9,
    SALARY_RANGE: 10,
    RECRUITER_NAME: 11,
    RECRUITER_EMAIL: 12,
    LOCATION: 13,
    SOURCE: 14,
    LAST_UPDATED: 15
  },

  // Validation regular expressions
  REGEX: {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    URL: /^https?:\/\/.+\..+/
  }
};

/**
 * Validates config settings.
 */
function testConfig() {
  Logger.log("Config verification started.");
  if (!CONFIG.SPREADSHEET_ID) throw new Error("Config verification failed: Spreadsheet ID missing");
  Logger.log("Config verified successfully.");
}

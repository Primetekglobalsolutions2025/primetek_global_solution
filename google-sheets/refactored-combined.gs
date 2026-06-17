// ==========================================
// 1. CONFIGURATION (Config.gs)
// ==========================================
const CONFIG = {
  // Spreadsheet settings
  SPREADSHEET_ID: "1im0l80fq60pqBYgMOXPQ3h0IoGOjimMWdvCDBFjWfo8",

  // Cache TTL settings (seconds)
  CACHE_TTL: 300,
  CACHE_KEY_APPS: "primetek_all_apps",

  // Concurrency Lock Settings (milliseconds)
  LOCK_TIMEOUT: 15000,

  // Design system theme settings
  THEME: {
    primary: "#667eea", // Purple
    primaryDark: "#764ba2", // Indigo
    background: "#F8FAFC", // Slate 50
    surface: "#FFFFFF", // White
    textMain: "#0F172A", // Slate 900
    textMuted: "#64748B", // Slate 500
    border: "#E2E8F0", // Slate 200
    headerBg: "#F1F5F9", // Slate 100
    rowAlt: "#F8FAFC", // Slate 50
    font: "Google Sans, Arial, sans-serif",
  },

  // Status dropdown values with badge colors
  STATUS: {
    NEW: { label: "New", bg: "#DCFCE7", text: "#166534" },
    APPLIED: { label: "Applied", bg: "#FEF3C7", text: "#92400E" },
    INTERVIEW: { label: "Interview", bg: "#DBEAFE", text: "#1E40AF" },
    TECH_INTERVIEW: {
      label: "Technical Interview",
      bg: "#E0F2FE",
      text: "#0369A1",
    },
    FINAL_INTERVIEW: {
      label: "Final Interview",
      bg: "#F3E8FF",
      text: "#6B21A8",
    },
    OFFER: { label: "Offer", bg: "#EDE9FE", text: "#5B21B6" },
    ACCEPTED: { label: "Accepted", bg: "#D1FAE5", text: "#065F46" },
    REJECTED: { label: "Rejected", bg: "#FEE2E2", text: "#991B1B" },
    ON_HOLD: { label: "On Hold", bg: "#F1F5F9", text: "#475569" },
  },

  // Priority values with badge colors
  PRIORITY: {
    HIGH: { label: "High", bg: "#FEE2E2", text: "#991B1B" },
    MEDIUM: { label: "Medium", bg: "#FEF3C7", text: "#92400E" },
    LOW: { label: "Low", bg: "#F1F5F9", text: "#475569" },
  },

  // Default dropdown roles
  DEFAULT_ROLES: [
    "Software Engineer",
    "Data Engineer",
    "Control Engineer",
    "Data Analyst",
    "Product Manager",
    "Bench Sales Executive",
    "Marketing Executive",
  ],

  // 16 Columns structure definition
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
    LAST_UPDATED: 15,
  },

  // Validation regex checks
  REGEX: {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    URL: /^https?:\/\/.+\..+/,
  },
};

// ==========================================
// 2. ENTRY POINTS & TRIGGERS (Menu.gs)
// ==========================================

function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("⚡ Primetek Panel")
      .addItem("🔄 Rebuild Cache & Refresh", "forceRebuildCache")
      .addItem("🎨 Format All Sheets Theme", "runInitialSetupAndFormatting")
      .addSeparator()
      .addItem("🧹 Reset Filters", "clearDashboardFilters")
      .addItem("⚙️ Reset Entire Dashboard", "resetDashboard")
      .addToUi();
  } catch (e) {
    console.warn("UI menu setup bypassed (likely web application context):", e);
  }
}

function clearDashboardFilters() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const home = ss.getSheetByName("Home");
  if (!home) return;
  home.getRange("B6").setValue("");
  home.getRange("D6").setValue("All Roles");
  home.getRange("F6").setValue("All Employees");
  home.getRange("H6").setValue("All Time");
  refreshHomeTab(ss);
  ss.toast("Filters successfully cleared!", "Reset Done");
}

function resetDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const home = ss.getSheetByName("Home");
  if (home) {
    ss.deleteSheet(home);
  }
  runInitialSetupAndFormatting();
  ss.toast("Dashboard layout rebuilt successfully!", "Reset Done");
}

// ==========================================
// 3. EVENT LISTENER HANDLERS (Main)
// ==========================================

function onEdit(e) {
  if (!e) return;
  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== "Home") return;

  const row = range.getRow();
  const col = range.getColumn();
  const value = e.value;
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (row === 6 && (col === 2 || col === 4 || col === 6 || col === 8)) {
    refreshHomeTab(ss);
    return;
  }

  // Claim action dropdown (Col 9 / Column I)
  if (row >= 9 && col === 9 && value && value !== "Claim Job ➕") {
    try {
      const jobRowData = sheet.getRange(row, 1, 1, 9).getValues()[0];
      const jobRole = jobRowData[3]; // Col D
      const clientName = jobRowData[4]; // Col E
      const applyUrl = jobRowData[5]; // Col F
      const claimEmployee = value.trim();

      const success = ClaimJobService.claim(
        claimEmployee,
        jobRole,
        clientName,
        applyUrl,
      );
      if (!success) {
        range.setValue("Claim Job ➕");
      }
    } catch (err) {
      range.setValue("Claim Job ➕");
      ss.toast("❌ Error: " + err.toString(), "Error");
    }
  }
}

function refreshHomeTab(ss) {
  let home = ss.getSheetByName("Home");
  if (!home) {
    home = ss.insertSheet("Home", 0);
  }
  const employees = EmployeeRepository.getAllNames();
  const uniqueApplications = getApplicationsData(false);

  // Extract unique roles from applications to dynamically populate the filter dropdown
  const rolesList = [].concat(CONFIG.DEFAULT_ROLES);
  uniqueApplications.forEach(app => {
    if (app.jobRole && app.jobRole.trim() !== "") {
      const sanitized = app.jobRole.trim();
      if (rolesList.findIndex(r => r.toLowerCase() === sanitized.toLowerCase()) === -1) {
        rolesList.push(sanitized);
      }
    }
  });
  rolesList.sort();
  const finalRoles = ["All Roles"].concat(rolesList);

  DashboardService.setupLayout(home, employees, finalRoles);

  const filters = {
    search: (home.getRange("B6").getValue() || "").toString(),
    role: (home.getRange("D6").getValue() || "All Roles").toString(),
    employee: (home.getRange("F6").getValue() || "All Employees").toString(),
    dateRange: (home.getRange("H6").getValue() || "All Time").toString(),
  };

  const lastRow = home.getLastRow();
  if (lastRow >= 9) {
    home
      .getRange(9, 1, lastRow - 8, 9)
      .clearDataValidations()
      .clearContent()
      .clearFormat()
      .setBackground(null);
  }

  const filteredApps = FilterService.applyFilters(uniqueApplications, filters);
  DashboardService.renderTable(home, filteredApps, employees);
}

function runInitialSetupAndFormatting() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const name = sheets[i].getName();
    if (name !== "Home" && name !== "Dashboard") {
      EmployeeService.formatSheet(sheets[i]);
    }
  }
  refreshHomeTab(ss);
}

// ==========================================
// 4. UTILITY HELPERS (Utils.gs)
// ==========================================

function parseColumnIndices(headerRow) {
  if (!headerRow || headerRow.length === 0) {
    return { date: 0, role: 1, client: 2, url: 3, status: 4, priority: 5 };
  }
  const headers = headerRow.map((h) => h.toString().toLowerCase().trim());
  return {
    date: headers.findIndex((h) => h.includes("date") || h.includes("month")),
    role: headers.findIndex((h) => h.includes("role") || h.includes("job")),
    client: headers.findIndex(
      (h) => h.includes("client") || h.includes("company"),
    ),
    url: headers.findIndex((h) => h.includes("url") || h.includes("link")),
    status: headers.findIndex((h) => h.includes("status")),
    priority: headers.findIndex((h) => h.includes("priority")),
    stage: headers.findIndex((h) => h.includes("stage")),
    followUp: headers.findIndex((h) => h.includes("follow")),
    notes: headers.includes("notes") ? headers.indexOf("notes") : -1,
    interviewDate: headers.findIndex(
      (h) => h.includes("interview") && h.includes("date"),
    ),
    salaryRange: headers.findIndex((h) => h.includes("salary")),
    recruiterName: headers.findIndex(
      (h) => h.includes("recruiter") && h.includes("name"),
    ),
    recruiterEmail: headers.findIndex(
      (h) => h.includes("recruiter") && h.includes("email"),
    ),
    location: headers.findIndex((h) => h.includes("location")),
    source: headers.findIndex((h) => h.includes("source")),
    lastUpdated: headers.findIndex(
      (h) => h.includes("last") && h.includes("update"),
    ),
  };
}

function sanitizeInput(text) {
  if (text === null || text === undefined) return "";
  return text
    .toString()
    .trim()
    .replace(/<[^>]*>/g, "")
    .replace(/[\n\r]+/g, " ");
}

function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function generateId() {
  return Utilities.getUuid();
}

function isValidUrl(url) {
  if (!url) return false;
  return CONFIG.REGEX.URL.test(url);
}

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


// ==========================================
// 5. CACHE ENGINE (CacheService.gs)
// ==========================================

const AppCacheService = {
  get(key) {
    try {
      const cache = CacheService.getScriptCache();
      const value = cache.get(key);
      if (value) {
        const parsed = JSON.parse(value);
        parsed.forEach((item) => {
          if (item.timestamp) item.timestamp = new Date(item.timestamp);
        });
        return parsed;
      }
    } catch (e) {
      console.warn("Cache read failure", e);
    }
    return null;
  },
  put(key, value, ttl) {
    try {
      const cache = CacheService.getScriptCache();
      cache.put(key, JSON.stringify(value), ttl);
    } catch (e) {
      console.error("Cache save failure", e);
    }
  },
  clear() {
    try {
      const cache = CacheService.getScriptCache();
      cache.remove(CONFIG.CACHE_KEY_APPS);
    } catch (e) {
      console.error("Cache clear failure", e);
    }
  },
};

function getApplicationsData(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = AppCacheService.get(CONFIG.CACHE_KEY_APPS);
    if (cached) return cached;
  }
  const freshData = ApplicationRepository.getAll();
  AppCacheService.put(CONFIG.CACHE_KEY_APPS, freshData, CONFIG.CACHE_TTL);
  return freshData;
}

function forceRebuildCache() {
  AppCacheService.clear();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  getApplicationsData(true);
  refreshHomeTab(ss);
}

// ==========================================
// 6. REPOSITORY LAYER (Repository.gs)
// ==========================================

const EmployeeRepository = {
  getAllNames() {
    const ss = getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const employees = ["Select Employee"];
    for (let i = 0; i < sheets.length; i++) {
      const name = sheets[i].getName();
      if (name !== "Home" && name !== "Dashboard") employees.push(name);
    }
    return employees;
  },
};

const ApplicationRepository = {
  getAll() {
    const ss = getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const allApplications = [];
    const urlClaims = {};

    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      const employeeName = sheet.getName();
      if (employeeName === "Home" || employeeName === "Dashboard") continue;

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) continue;

      const firstRow = data[0];
      const indices = parseColumnIndices(firstRow);

      for (let r = 1; r < data.length; r++) {
        const row = data[r];
        const jobRole = (row[indices.role] || "").toString().trim();
        const clientName = (row[indices.client] || "").toString().trim();
        const rawUrl = (row[indices.url] || "").toString().trim();
        const status = (row[indices.status] || "New").toString().trim();
        const priority = (row[indices.priority] || "Medium").toString().trim();

        if (!jobRole && !clientName) continue;

        const urlKey = rawUrl.toLowerCase();
        if (urlKey) {
          if (!urlClaims[urlKey]) urlClaims[urlKey] = [];
          if (urlClaims[urlKey].indexOf(employeeName) === -1)
            urlClaims[urlKey].push(employeeName);
        }

        const timestampVal = row[indices.date]
          ? new Date(row[indices.date]).getTime()
          : new Date().getTime();

        allApplications.push({
          employeeName: employeeName,
          timestamp: timestampVal,
          jobRole: jobRole,
          clientName: clientName,
          url: rawUrl,
          status: status,
          priority: priority,
          stage:
            indices.stage !== -1
              ? (row[indices.stage] || "").toString().trim()
              : "",
          notes:
            indices.notes !== -1
              ? (row[indices.notes] || "").toString().trim()
              : "",
          interviewDate:
            indices.interviewDate !== -1 && row[indices.interviewDate]
              ? new Date(row[indices.interviewDate]).getTime()
              : "",
          salaryRange:
            indices.salaryRange !== -1
              ? (row[indices.salaryRange] || "").toString().trim()
              : "",
          recruiterName:
            indices.recruiterName !== -1
              ? (row[indices.recruiterName] || "").toString().trim()
              : "",
          recruiterEmail:
            indices.recruiterEmail !== -1
              ? (row[indices.recruiterEmail] || "").toString().trim()
              : "",
          location:
            indices.location !== -1
              ? (row[indices.location] || "").toString().trim()
              : "",
          source:
            indices.source !== -1
              ? (row[indices.source] || "").toString().trim()
              : "",
        });
      }
    }

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
        if (app.timestamp > seenUrls[urlKey].timestamp) {
          seenUrls[urlKey].timestamp = app.timestamp;
          seenUrls[urlKey].employeeName = app.employeeName;
          seenUrls[urlKey].jobRole = app.jobRole;
          seenUrls[urlKey].clientName = app.clientName;
          seenUrls[urlKey].status = app.status;
          seenUrls[urlKey].priority = app.priority;
          seenUrls[urlKey].stage = app.stage;
          seenUrls[urlKey].notes = app.notes;
          seenUrls[urlKey].interviewDate = app.interviewDate;
          seenUrls[urlKey].salaryRange = app.salaryRange;
          seenUrls[urlKey].recruiterName = app.recruiterName;
          seenUrls[urlKey].recruiterEmail = app.recruiterEmail;
          seenUrls[urlKey].location = app.location;
          seenUrls[urlKey].source = app.source;
        }
      }
    }

    for (let k = 0; k < uniqueApplications.length; k++) {
      const app = uniqueApplications[k];
      const urlKey = app.url.toLowerCase();
      app.claimedBy = urlClaims[urlKey]
        ? urlClaims[urlKey].join(", ")
        : app.employeeName;
    }

    uniqueApplications.sort((a, b) => b.timestamp - a.timestamp);
    return uniqueApplications;
  },

  save(employeeName, record) {
    const ss = getActiveSpreadsheet();
    let sheet = ss.getSheetByName(employeeName);
    if (!sheet) {
      sheet = EmployeeService.createSheet(employeeName);
    }
    const dateVal = record.date ? new Date(record.date) : new Date();
    const status = record.status || CONFIG.STATUS.NEW.label;
    const priority = record.priority || CONFIG.PRIORITY.MEDIUM.label;

    sheet.appendRow([
      dateVal,
      (record.jobRole || "").toString().trim(),
      (record.clientName || "").toString().trim(),
      (record.applicationUrl || "").toString().trim(),
      status,
      priority,
      record.stage || "",
      record.followUpDate ? new Date(record.followUpDate) : "",
      record.notes || "",
      record.interviewDate ? new Date(record.interviewDate) : "",
      record.salaryRange || "",
      record.recruiterName || "",
      record.recruiterEmail || "",
      record.location || "",
      record.source || "",
      new Date().toISOString(),
    ]);
    EmployeeService.formatSheet(sheet);
  },
};

// ==========================================
// 7. INPUT VALIDATIONS (ValidationService.gs)
// ==========================================

const ValidationService = {
  validateApplication(data) {
    if (!data) return "Payload payload is empty or invalid.";
    if (!data.jobRole || sanitizeInput(data.jobRole) === "")
      return "Missing required field: jobRole";
    if (!data.clientName || sanitizeInput(data.clientName) === "")
      return "Missing required field: clientName";
    if (!data.applicationUrl || sanitizeInput(data.applicationUrl) === "")
      return "Missing required field: applicationUrl";
    if (!this.validateUrl(data.applicationUrl)) return "Invalid URL format.";
    if (data.recruiterEmail && sanitizeInput(data.recruiterEmail) !== "") {
      if (!this.validateEmail(data.recruiterEmail))
        return "Invalid Recruiter Email format.";
    }
    return null;
  },
  validateUrl(url) {
    if (!url) return false;
    const cleanUrl = url.trim().toLowerCase();
    return cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://");
  },
  validateEmail(email) {
    if (!email) return false;
    return CONFIG.REGEX.EMAIL.test(email.trim());
  },
  validateEmployee(name) {
    if (!name) return false;
    const cleanName = this.sanitizeEmployeeName(name);
    if (cleanName === "" || cleanName === "Home" || cleanName === "Dashboard")
      return false;
    return true;
  },
  sanitizeEmployeeName(name) {
    if (!name) return "General";
    return name
      .toString()
      .trim()
      .replace(/[\\\/\?\*\:\[\]]/g, "")
      .substring(0, 31);
  },
  detectDuplicates(existingApps, newApp) {
    if (!existingApps || existingApps.length === 0) return null;
    const newUrl = (newApp.applicationUrl || "").toLowerCase().trim();
    const newRole = (newApp.jobRole || "").toLowerCase().trim();
    const newClient = (newApp.clientName || "").toLowerCase().trim();

    for (let i = 0; i < existingApps.length; i++) {
      const app = existingApps[i];
      if (newUrl && app.url && app.url.toLowerCase().trim() === newUrl) {
        return `Job URL is already claimed by: ${app.claimedBy}`;
      }
      if (
        app.jobRole &&
        app.clientName &&
        app.jobRole.toLowerCase().trim() === newRole &&
        app.clientName.toLowerCase().trim() === newClient
      ) {
        return `Similar Job (same Role + Client) is already logged by: ${app.claimedBy}`;
      }
    }
    return null;
  },
};

// ==========================================
// 8. FILTER SERVICES (FilterService.gs)
// ==========================================

const FilterService = {
  applyFilters(applications, filters) {
    if (!applications || applications.length === 0) return [];
    if (!filters) return applications;

    let filtered = applications;

    if (filters.search && filters.search.trim() !== "") {
      filtered = this.filterBySearch(filtered, filters.search);
    }
    if (filters.role && filters.role !== "All Roles") {
      filtered = filtered.filter(
        (app) =>
          app.jobRole &&
          app.jobRole.toLowerCase().includes(filters.role.toLowerCase()),
      );
    }
    if (filters.employee && filters.employee !== "All Employees") {
      filtered = filtered.filter(
        (app) => app.claimedBy && app.claimedBy.includes(filters.employee),
      );
    }
    if (filters.dateRange && filters.dateRange !== "All Time") {
      filtered = this.filterByDateRange(filtered, filters.dateRange);
    }
    return filtered;
  },
  filterBySearch(apps, searchTerm) {
    const query = searchTerm.toLowerCase().trim();
    return apps.filter((app) => {
      const roleMatch =
        app.jobRole && app.jobRole.toLowerCase().includes(query);
      const clientMatch =
        app.clientName && app.clientName.toLowerCase().includes(query);
      const ownerMatch =
        app.claimedBy && app.claimedBy.toLowerCase().includes(query);
      const notesMatch = app.notes && app.notes.toLowerCase().includes(query);
      const statusMatch =
        app.status && app.status.toLowerCase().includes(query);
      return (
        roleMatch || clientMatch || ownerMatch || notesMatch || statusMatch
      );
    });
  },
  filterByDateRange(apps, range) {
    const now = new Date();
    return apps.filter((app) => {
      if (!app.timestamp) return false;
      const appDate = new Date(app.timestamp);
      const diffTime = Math.abs(now.getTime() - appDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (range === "Today") {
        return appDate.toDateString() === now.toDateString();
      } else if (range === "Past 7 Days") {
        return diffDays <= 7;
      } else if (range === "Past 30 Days") {
        return diffDays <= 30;
      }
      return true;
    });
  },
};

// ==========================================
// 9. ANALYTICS METRICS (AnalyticsService.gs)
// ==========================================

const AnalyticsService = {
  calculateKPIs(applications) {
    if (!applications)
      return {
        totalLeads: 0,
        activeClients: 0,
        uniqueRoles: 0,
        addedToday: 0,
        applied: 0,
        interview: 0,
        offer: 0,
        acceptanceRate: 0,
      };
    const now = new Date();
    const todayStr = now.toDateString();
    const clients = {};
    const roles = {};
    let addedToday = 0;
    let applied = 0;
    let interview = 0;
    let offer = 0;
    let accepted = 0;

    applications.forEach((app) => {
      if (app.clientName) clients[app.clientName.toLowerCase()] = true;
      if (app.jobRole) roles[app.jobRole.toLowerCase()] = true;

      const status = (app.status || "").toLowerCase().trim();
      if (status === "applied") applied++;
      else if (status.includes("interview")) interview++;
      else if (status === "offer") offer++;
      else if (status === "accepted") accepted++;

      if (app.timestamp) {
        const appDate = new Date(app.timestamp);
        if (appDate.toDateString() === todayStr) addedToday++;
      }
    });

    const totalCount = applications.length;
    const acceptanceRateVal = totalCount > 0 ? accepted / totalCount : 0;

    return {
      totalLeads: totalCount,
      activeClients: Object.keys(clients).length,
      uniqueRoles: Object.keys(roles).length,
      addedToday: addedToday,
      applied: applied,
      interview: interview,
      offer: offer,
      acceptanceRate: acceptanceRateVal,
    };
  },
};

// ==========================================
// 10. THEME & BADGE STYLING (ThemeService.gs)
// ==========================================

const ThemeService = {
  applyStatusBadge(cell, status) {
    if (!cell || !status) return;
    const normalized = status.toUpperCase().replace(/\s+/g, "_");
    const badge = CONFIG.STATUS[normalized] || CONFIG.STATUS.NEW;
    cell
      .setBackground(badge.bg)
      .setFontColor(badge.text)
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
  },
  applyPriorityBadge(cell, priority) {
    if (!cell || !priority) return;
    const normalized = priority.toUpperCase();
    const badge = CONFIG.PRIORITY[normalized] || CONFIG.PRIORITY.MEDIUM;
    cell
      .setBackground(badge.bg)
      .setFontColor(badge.text)
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
  },
};

// ==========================================
// 11. EMPLOYEE SHET CONFIGURATION (EmployeeService.gs)
// ==========================================

const EmployeeService = {
  createSheet(employeeName) {
    const ss = getActiveSpreadsheet();
    let sheet = ss.getSheetByName(employeeName);
    if (!sheet) {
      sheet = ss.insertSheet(employeeName);
    }
    const headers = [
      [
        "Date/Month",
        "Job Role",
        "Client Name",
        "Application URL",
        "Status",
        "Priority",
        "Stage",
        "Follow-up Date",
        "Notes",
        "Interview Date",
        "Salary Range",
        "Recruiter Name",
        "Recruiter Email",
        "Location",
        "Source",
        "Last Updated",
      ],
    ];
    sheet.getRange(1, 1, 1, 16).setValues(headers);
    this.formatSheet(sheet);
    return sheet;
  },
  formatSheet(sheet) {
    if (!sheet) return;
    sheet.setHiddenGridlines(false);
    const lastRow = sheet.getLastRow();
    const lastColumn = Math.max(16, sheet.getLastColumn());

    const headerRange = sheet.getRange(1, 1, 1, lastColumn);
    headerRange
      .setBackground(CONFIG.THEME.primaryDark)
      .setFontColor(CONFIG.THEME.surface)
      .setFontWeight("bold")
      .setFontFamily(CONFIG.THEME.font)
      .setFontSize(10)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    sheet.setRowHeight(1, 36);

    if (lastRow > 1) {
      const dataRange = sheet.getRange(2, 1, lastRow - 1, lastColumn);
      dataRange
        .setFontFamily(CONFIG.THEME.font)
        .setFontSize(10)
        .setVerticalAlignment("middle")
        .setFontColor(CONFIG.THEME.textMain);

      for (let r = 2; r <= lastRow; r++) {
        sheet.setRowHeight(r, 28);
        const rowRange = sheet.getRange(r, 1, 1, lastColumn);
        rowRange.setBackground(
          r % 2 === 0 ? CONFIG.THEME.rowAlt : CONFIG.THEME.surface,
        );

        const statusCell = sheet.getRange(r, CONFIG.EMPLOYEE_COLS.STATUS + 1);
        const statusVal = statusCell.getValue();
        if (statusVal) ThemeService.applyStatusBadge(statusCell, statusVal);

        const priorityCell = sheet.getRange(
          r,
          CONFIG.EMPLOYEE_COLS.PRIORITY + 1,
        );
        const priorityVal = priorityCell.getValue();
        if (priorityVal)
          ThemeService.applyPriorityBadge(priorityCell, priorityVal);
      }

      sheet
        .getRange(2, CONFIG.EMPLOYEE_COLS.DATE + 1, lastRow - 1, 1)
        .setNumberFormat("dd-mmm")
        .setHorizontalAlignment("center");
      sheet
        .getRange(2, CONFIG.EMPLOYEE_COLS.FOLLOW_UP + 1, lastRow - 1, 1)
        .setNumberFormat("dd-mmm")
        .setHorizontalAlignment("center");
      sheet
        .getRange(2, CONFIG.EMPLOYEE_COLS.INTERVIEW_DATE + 1, lastRow - 1, 1)
        .setNumberFormat("dd-mmm")
        .setHorizontalAlignment("center");

      const urlIdx = CONFIG.EMPLOYEE_COLS.URL + 1;
      sheet
        .getRange(2, urlIdx, lastRow - 1, 1)
        .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
        .setFontColor(CONFIG.THEME.primary);
    }

    const ruleRangeEnd = Math.max(500, lastRow + 100);
    const statusValues = Object.keys(CONFIG.STATUS).map(
      (k) => CONFIG.STATUS[k].label,
    );
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(statusValues, false)
      .build();
    sheet
      .getRange(2, CONFIG.EMPLOYEE_COLS.STATUS + 1, ruleRangeEnd, 1)
      .setDataValidation(statusRule);

    const priorityValues = Object.keys(CONFIG.PRIORITY).map(
      (k) => CONFIG.PRIORITY[k].label,
    );
    const priorityRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(priorityValues, false)
      .build();
    sheet
      .getRange(2, CONFIG.EMPLOYEE_COLS.PRIORITY + 1, ruleRangeEnd, 1)
      .setDataValidation(priorityRule);

    sheet.setColumnWidth(1, 100); // Date
    sheet.setColumnWidth(2, 180); // Role
    sheet.setColumnWidth(3, 180); // Client
    sheet.setColumnWidth(4, 250); // URL
    sheet.setColumnWidth(5, 120); // Status
    sheet.setColumnWidth(6, 100); // Priority
    sheet.setColumnWidth(7, 120); // Stage
    sheet.setColumnWidth(8, 110); // Follow-up Date
    sheet.setColumnWidth(9, 200); // Notes
    sheet.setColumnWidth(10, 110); // Interview Date
    sheet.setColumnWidth(11, 120); // Salary Range
    sheet.setColumnWidth(12, 150); // Recruiter Name
    sheet.setColumnWidth(13, 180); // Recruiter Email
    sheet.setColumnWidth(14, 120); // Location
    sheet.setColumnWidth(15, 120); // Source
    sheet.setColumnWidth(16, 150); // Last Updated
  },
};

// ==========================================
// 12. DASHBOARD VIEW DESIGN (DashboardService.gs)
// ==========================================

const DashboardService = {
  setupLayout(home, employees, dynamicRoles) {
    if (!home) return;
    home.setHiddenGridlines(true);

    home.setColumnWidth(1, 50); // S.No
    home.setColumnWidth(2, 100); // Status badge
    home.setColumnWidth(3, 120); // Date
    home.setColumnWidth(4, 180); // Role
    home.setColumnWidth(5, 180); // Client
    home.setColumnWidth(6, 200); // URL
    home.setColumnWidth(7, 100); // Apply Action
    home.setColumnWidth(8, 150); // Owner
    home.setColumnWidth(9, 150); // Claim Dropdown

    home
      .getRange("A1:I2")
      .merge()
      .setValue("⚡ PRIMETEK JOB TRACKER PANEL")
      .setBackground(CONFIG.THEME.primaryDark)
      .setFontColor(CONFIG.THEME.surface)
      .setFontWeight("bold")
      .setFontFamily(CONFIG.THEME.font)
      .setFontSize(16)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");

    this.setupKPICards(home);
    this.setupFilters(home, employees, dynamicRoles);
  },
  setupKPICards(sheet) {
    const labels = [
      ["A4", "📊 Total Jobs"],
      ["B4", "🏢 Active Clients"],
      ["C4", "💼 Unique Roles"],
      ["D4", "📅 Added Today"],
      ["E4", "🟡 Applied"],
      ["F4", "🔵 Interview"],
      ["G4", "🟣 Offer"],
      ["H4", "✅ Acceptance Rate"],
    ];
    labels.forEach(([cell, text]) => {
      sheet
        .getRange(cell)
        .setValue(text)
        .setBackground(CONFIG.THEME.headerBg)
        .setFontColor(CONFIG.THEME.textMuted)
        .setFontSize(8)
        .setFontFamily(CONFIG.THEME.font)
        .setHorizontalAlignment("center")
        .setVerticalAlignment("middle");
    });

    const kpiVal = (cell, formula, color) => {
      sheet
        .getRange(cell)
        .setFormula(formula)
        .setFontSize(14)
        .setFontWeight("bold")
        .setFontFamily(CONFIG.THEME.font)
        .setHorizontalAlignment("center")
        .setVerticalAlignment("middle")
        .setFontColor(color)
        .setBackground(CONFIG.THEME.surface);
    };

    kpiVal("A5", "=IF(COUNTA(E9:E)=0, 0, COUNTA(E9:E))", CONFIG.THEME.primary);
    kpiVal("B5", "=IF(COUNTA(E9:E)=0, 0, COUNTUNIQUE(E9:E))", "#065F46");
    kpiVal(
      "C5",
      "=IF(COUNTA(D9:D)=0, 0, COUNTUNIQUE(D9:D))",
      CONFIG.THEME.textMain,
    );
    kpiVal(
      "D5",
      '=IF(COUNTA(C9:C)=0, 0, COUNTIF(C9:C, TEXT(TODAY(),"dd-mmm")))',
      "#B45309",
    );
    kpiVal("E5", '=IF(COUNTA(B9:B)=0, 0, COUNTIF(B9:B, "Applied"))', "#92400E");
    kpiVal(
      "F5",
      '=IF(COUNTA(B9:B)=0, 0, COUNTIF(B9:B, "Interview"))',
      "#1E40AF",
    );
    kpiVal("G5", '=IF(COUNTA(B9:B)=0, 0, COUNTIF(B9:B, "Offer"))', "#5B21B6");
    kpiVal(
      "H5",
      '=IF(A5=0, "0.0%", TEXT(COUNTIF(B9:B, "Accepted")/A5, "0.0%"))',
      "#047857",
    );
    sheet.getRange("H5").setNumberFormat("0.0%");
  },
  setupFilters(sheet, employees, dynamicRoles) {
    const filterLabelStyle = (range, label) => {
      range
        .setValue(label)
        .setFontFamily(CONFIG.THEME.font)
        .setFontSize(8)
        .setFontColor(CONFIG.THEME.textMuted)
        .setFontWeight("bold")
        .setHorizontalAlignment("right")
        .setVerticalAlignment("middle");
    };

    filterLabelStyle(sheet.getRange("A6"), "🔍 Search:");
    filterLabelStyle(sheet.getRange("C6"), "💼 Role:");
    filterLabelStyle(sheet.getRange("E6"), "👤 Submitter:");
    filterLabelStyle(sheet.getRange("G6"), "📅 Date:");

    const inputStyle = (range) => {
      range
        .setBackground(CONFIG.THEME.surface)
        .setFontColor(CONFIG.THEME.textMain)
        .setFontFamily(CONFIG.THEME.font)
        .setFontSize(9)
        .setBorder(
          true,
          true,
          true,
          true,
          false,
          false,
          CONFIG.THEME.border,
          SpreadsheetApp.BorderStyle.SOLID,
        );
    };

    inputStyle(sheet.getRange("B6"));
    if (sheet.getRange("B6").getValue() === "")
      sheet.getRange("B6").setValue("");

    const roleCell = sheet.getRange("D6");
    inputStyle(roleCell);
    const roles = dynamicRoles || ["All Roles"].concat(CONFIG.DEFAULT_ROLES);
    roleCell.setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(roles, false)
        .build(),
    );
    if (!roleCell.getValue()) roleCell.setValue("All Roles");

    const submitterCell = sheet.getRange("F6");
    inputStyle(submitterCell);
    const submitterList = ["All Employees"].concat(employees.slice(1));
    submitterCell.setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(submitterList, false)
        .build(),
    );
    if (!submitterCell.getValue()) submitterCell.setValue("All Employees");

    const dateCell = sheet.getRange("H6");
    inputStyle(dateCell);
    const dates = ["All Time", "Today", "Past 7 Days", "Past 30 Days"];
    dateCell.setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(dates, false)
        .build(),
    );
    if (!dateCell.getValue()) dateCell.setValue("All Time");

    sheet.setRowHeight(6, 36);

    const headers = [
      [
        "S.No",
        "Status",
        "Date/Month",
        "Job Role",
        "Client Name",
        "Application URL",
        "Action",
        "Claimed By",
        "Claim Job",
      ],
    ];
    sheet
      .getRange("A8:I8")
      .setValues(headers)
      .setBackground(CONFIG.THEME.headerBg)
      .setFontColor(CONFIG.THEME.textMuted)
      .setFontWeight("bold")
      .setFontSize(9)
      .setFontFamily(CONFIG.THEME.font)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    sheet.setRowHeight(8, 32);
  },
  renderTable(sheet, applications, employees) {
    if (!applications || applications.length === 0) return;
    const cellData = [];
    for (let j = 0; j < applications.length; j++) {
      const item = applications[j];
      cellData.push([
        j + 1,
        item.status || "New",
        item.timestamp ? new Date(item.timestamp) : "",
        item.jobRole,
        item.clientName,
        item.url,
        "=HYPERLINK(F" + (9 + j) + ', "Apply 🔗")',
        item.claimedBy,
        "Claim Job ➕",
      ]);
    }

    const outputRange = sheet.getRange(9, 1, applications.length, 9);
    outputRange
      .setValues(cellData)
      .setFontFamily(CONFIG.THEME.font)
      .setFontSize(10)
      .setVerticalAlignment("middle")
      .setHorizontalAlignment("center")
      .setFontColor(CONFIG.THEME.textMain);

    sheet.getRange(9, 3, applications.length, 1).setNumberFormat("dd-mmm");

    const claimDropdownList = ["Claim Job ➕"].concat(employees.slice(1));
    const empRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(claimDropdownList, false)
      .build();

    for (let r = 0; r < applications.length; r++) {
      const currentRowNum = 9 + r;
      sheet.setRowHeight(currentRowNum, 32);
      const rowRange = sheet.getRange(currentRowNum, 1, 1, 9);
      rowRange.setBackground(
        currentRowNum % 2 === 0 ? CONFIG.THEME.rowAlt : CONFIG.THEME.surface,
      );

      const statusCell = sheet.getRange(currentRowNum, 2);
      ThemeService.applyStatusBadge(statusCell, statusCell.getValue());

      sheet
        .getRange(currentRowNum, 4)
        .setFontWeight("bold")
        .setHorizontalAlignment("left");
      sheet
        .getRange(currentRowNum, 5)
        .setFontColor(CONFIG.THEME.textMuted)
        .setHorizontalAlignment("left");
      sheet
        .getRange(currentRowNum, 6)
        .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
        .setFontColor(CONFIG.THEME.primary);
      sheet
        .getRange(currentRowNum, 7)
        .setFontWeight("bold")
        .setFontColor(CONFIG.THEME.primary);
      sheet
        .getRange(currentRowNum, 8)
        .setBackground("#ECFDF5")
        .setFontColor("#047857")
        .setFontWeight("bold");
      sheet
        .getRange(currentRowNum, 9)
        .setDataValidation(empRule)
        .setBackground(CONFIG.THEME.surface)
        .setFontWeight("bold");
    }

    sheet.setFrozenRows(8);
    if (sheet.getFilter()) {
      sheet.getFilter().remove();
    }
    sheet.getRange(8, 1, applications.length + 1, 9).createFilter();
  },
};

// ==========================================
// 13. CLAM MANAGER & LOCKS (ClaimJobService.gs)
// ==========================================

const ClaimJobService = {
  claim(employeeName, jobRole, clientName, url) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(CONFIG.LOCK_TIMEOUT);
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let targetSheet = ss.getSheetByName(employeeName);
      if (!targetSheet) {
        targetSheet = EmployeeService.createSheet(employeeName);
      }

      const lastRow = targetSheet.getLastRow();
      let alreadyClaimed = false;
      if (lastRow > 1) {
        const urlIdx = CONFIG.EMPLOYEE_COLS.URL + 1;
        const existingUrls = targetSheet
          .getRange(2, urlIdx, lastRow - 1, 1)
          .getValues();
        for (let i = 0; i < existingUrls.length; i++) {
          if (
            existingUrls[i][0] &&
            existingUrls[i][0].toString().toLowerCase().trim() ===
              url.toLowerCase().trim()
          ) {
            alreadyClaimed = true;
            break;
          }
        }
      }
      if (alreadyClaimed) {
        ss.toast(
          `⚠️ This job URL is already logged in ${employeeName}'s tab!`,
          "Claim Error",
        );
        return false;
      }

      const timestamp = new Date();
      const emptyCells = Array(9).fill("");
      targetSheet.appendRow([
        timestamp,
        jobRole,
        clientName,
        url,
        CONFIG.STATUS.NEW.label,
        CONFIG.PRIORITY.MEDIUM.label,
        ...emptyCells,
        timestamp.toISOString(),
      ]);
      EmployeeService.formatSheet(targetSheet);

      AppCacheService.clear();
      refreshHomeTab(ss);
      ss.toast(`🎉 Job claimed by ${employeeName}!`, "Success");
      return true;
    } catch (e) {
      console.error("Lock error in claim:", e);
      SpreadsheetApp.getActiveSpreadsheet().toast(
        "❌ Server Busy. Please try again.",
        "Error",
      );
      return false;
    } finally {
      lock.releaseLock();
    }
  },
};

// ==========================================
// 14. REST WEB ENDPOINTS (ApiService.gs)
// ==========================================

function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    return handleGetRequest(params);
  } catch (err) {
    console.error("Error in ApiService.doGet:", err);
    return sendJsonResponse({ error: err.toString() }, false);
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT);
    if (!e || !e.postData || !e.postData.contents) {
      return sendJsonResponse(
        { error: "Missing payload POST contents." },
        false,
      );
    }
    const payload = JSON.parse(e.postData.contents);
    return handlePostRequest(payload);
  } catch (err) {
    console.error("Error in ApiService.doPost:", err);
    return sendJsonResponse({ error: err.toString() }, false);
  } finally {
    lock.releaseLock();
  }
}

function handleGetRequest(params) {
  const forceRefresh = params.refresh === "true";
  const data = getApplicationsData(forceRefresh);
  let resultData = data;
  if (params.employee) {
    const empName = params.employee.trim();
    resultData = data.filter(
      (app) => app.claimedBy && app.claimedBy.includes(empName),
    );
  }
  return sendJsonResponse({ applications: resultData }, true);
}

function handlePostRequest(payload) {
  const validationError = ValidationService.validateApplication(payload);
  if (validationError)
    return sendJsonResponse({ error: validationError }, false);

  const existingApps = getApplicationsData(false);
  const duplicateMsg = ValidationService.detectDuplicates(
    existingApps,
    payload,
  );
  if (duplicateMsg) return sendJsonResponse({ error: duplicateMsg }, false);

  let employeeName = (payload.employeeName || "General").trim();
  employeeName = ValidationService.sanitizeEmployeeName(employeeName);
  if (employeeName === "Home" || employeeName === "Dashboard")
    employeeName = "General";

  ApplicationRepository.save(employeeName, payload);
  AppCacheService.clear();

  const ss = getActiveSpreadsheet();
  refreshHomeTab(ss);
  return sendJsonResponse(
    { message: "Job Application successfully created!" },
    true,
  );
}

function sendJsonResponse(data, success = true) {
  const response = {
    success: success,
    timestamp: new Date().getTime(),
    data: data,
  };
  return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

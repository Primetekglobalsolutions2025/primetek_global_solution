// --- CONFIGURATION ---
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

// --- ENTRY POINTS & TRIGGER HANDLERS (Main) ---

/**
 * Triggered automatically when the spreadsheet workbook is opened.
 * Adds custom menu controls.
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("⚡ Primetek Panel")
      .addItem("🔄 Rebuild Cache & Refresh", "forceRebuildCache")
      .addItem("🎨 Format All Sheets Theme", "runInitialSetupAndFormatting")
      .addToUi();
  } catch (e) {
    console.warn("Failed to create menu UI (likely running in Web App execution context):", e);
  }
}

/**
 * Realtime edit event listener to capture filter modifications and claim checkbox actions.
 * @param {Object} e Trigger event details.
 */
function onEdit(e) {
  if (!e) return;
  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== "Home") return;
  
  const row = range.getRow();
  const col = range.getColumn();
  const value = e.value;
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Check if filter controls (Row 6) are modified
  if (row === 6 && (col === 2 || col === 4 || col === 6 || col === 8)) {
    refreshHomeTab(ss);
    return;
  }

  // 2. Check if a Job Claim action (Row 9+, Col 8 / Column H) is requested
  if (row >= 9 && col === 8 && value && value !== "Claim Job ➕") {
    try {
      const jobRowData = sheet.getRange(row, 1, 1, 8).getValues()[0];
      const jobRole = jobRowData[2];         // Col C
      const clientName = jobRowData[3];       // Col D
      const applyUrl = jobRowData[4];         // Col E
      const claimEmployee = value.trim();     // Employee name target
      
      let targetSheet = ss.getSheetByName(claimEmployee);
      if (!targetSheet) {
        targetSheet = ss.insertSheet(claimEmployee);
        // Add headers matching Employee_Cols config
        targetSheet.appendRow([
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
        formatSheetTheme(targetSheet);
      }

      // Check if job URL is already logged by this employee to prevent duplicates
      const lastTargetRow = targetSheet.getLastRow();
      let alreadyClaimed = false;
      
      if (lastTargetRow > 1) {
        const existingUrls = targetSheet.getRange(2, 4, lastTargetRow - 1, 1).getValues();
        for (let i = 0; i < existingUrls.length; i++) {
          if (existingUrls[i][0] === applyUrl) {
            alreadyClaimed = true;
            break;
          }
        }
      }

      if (alreadyClaimed) {
        range.setValue("Claim Job ➕");
        ss.toast(`⚠️ Job URL is already logged in ${claimEmployee}'s tab!`, "Duplicate Job");
        return;
      }

      // Add record to the employee's sheet tab
      targetSheet.appendRow([
        new Date(), 
        jobRole, 
        clientName, 
        applyUrl, 
        "New", // status
        "Medium", // priority
        "", // stage
        "", // followUpDate
        "" // notes
      ]);
      formatSheetTheme(targetSheet);

      // Reset dropdown cell value back to default prompt
      range.setValue("Claim Job ➕");
      
      // Invalidate script cache and rebuild Home grid
      clearApplicationsCache();
      refreshHomeTab(ss);
      
      ss.toast(`🎉 Job claimed by ${claimEmployee}!`, "Success");
    } catch (err) {
      range.setValue("Claim Job ➕");
      ss.toast("❌ Exception occurred: " + err.toString(), "Error");
    }
  }
}

/**
 * Re-reads database, applies filters, and renders the dashboard table.
 * @param {Spreadsheet} ss Active Spreadsheet workbook.
 */
function refreshHomeTab(ss) {
  let home = ss.getSheetByName("Home");
  if (!home) {
    home = ss.insertSheet("Home", 0);
  }
  
  const sheets = ss.getSheets();
  const employees = ["Select Employee"];
  
  // Collect active employee sheet names for filtering lists
  for (let i = 0; i < sheets.length; i++) {
    const name = sheets[i].getName();
    if (name !== "Home" && name !== "Dashboard") {
      employees.push(name);
    }
  }

  // Fetch unique job applications (utilizes Cache layer)
  const uniqueApplications = getApplicationsData(false);

  // Setup Home Layout grid & filters
  setupHomeLayout(home, employees);

  // Gather current filter selections
  const filters = {
    search: (home.getRange("B6").getValue() || "").toString(),
    role: (home.getRange("D6").getValue() || "All Roles").toString(),
    employee: (home.getRange("F6").getValue() || "All Employees").toString(),
    dateRange: (home.getRange("H6").getValue() || "All Time").toString()
  };

  // Clear existing data rows starting from row 9
  const lastRow = home.getLastRow();
  if (lastRow >= 9) {
    home.getRange(9, 1, lastRow - 8, 8).clearDataValidations().clearContent().clearFormat().setBackground(null);
  }

  // Apply filters
  const filteredApps = applyFilters(uniqueApplications, filters);

  // Render applications table
  renderApplicationTable(home, filteredApps, employees);
}

/**
 * Formats individual employee sheet tabs with design themes and column sizes.
 * @param {Sheet} sheet Target employee tab.
 */
function formatSheetTheme(sheet) {
  if (!sheet) return;
  sheet.setHiddenGridlines(false);
  
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow === 0 || lastColumn === 0) return;

  // Header range formatting
  const headerRange = sheet.getRange(1, 1, 1, lastColumn);
  headerRange.setBackground(CONFIG.THEME.primaryDark)
    .setFontColor(CONFIG.THEME.surface)
    .setFontWeight("bold")
    .setFontFamily(CONFIG.THEME.font)
    .setFontSize(10)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 36);

  // Data range formatting
  if (lastRow > 1) {
    const dataRange = sheet.getRange(2, 1, lastRow - 1, lastColumn);
    dataRange.setFontFamily(CONFIG.THEME.font)
      .setFontSize(10)
      .setVerticalAlignment("middle")
      .setFontColor(CONFIG.THEME.textMain);
      
    for (let r = 2; r <= lastRow; r++) {
      const rowRange = sheet.getRange(r, 1, 1, lastColumn);
      rowRange.setBackground(r % 2 === 0 ? CONFIG.THEME.rowAlt : CONFIG.THEME.surface);
      sheet.setRowHeight(r, 28);
      
      // Apply status badges if status value is valid
      const statusCell = sheet.getRange(r, CONFIG.EMPLOYEE_COLS.STATUS + 1);
      const statusVal = statusCell.getValue();
      if (statusVal) {
        applyStatusBadge(statusCell, statusVal);
      }
    }
    
    // Format Date Column (dd-mmm)
    const timeRange = sheet.getRange(2, CONFIG.EMPLOYEE_COLS.DATE + 1, lastRow - 1, 1);
    timeRange.setNumberFormat("dd-mmm").setHorizontalAlignment("center");
    
    // Wrap long URLs to protect layout structure
    const urlRange = sheet.getRange(2, CONFIG.EMPLOYEE_COLS.URL + 1, lastRow - 1, 1);
    urlRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setFontColor(CONFIG.THEME.primary);
  }

  // Set standard column sizes
  sheet.setColumnWidth(1, 120); // Date/Month
  sheet.setColumnWidth(2, 180); // Job Role
  sheet.setColumnWidth(3, 180); // Client Name
  sheet.setColumnWidth(4, 300); // Application URL
  sheet.setColumnWidth(5, 100); // Status
  sheet.setColumnWidth(6, 100); // Priority
  sheet.setColumnWidth(7, 120); // Stage
  sheet.setColumnWidth(8, 120); // Follow-up Date
  sheet.setColumnWidth(9, 200); // Notes
}

/**
 * Custom function triggered manually to clear cache and rebuild the sheet dashboard.
 */
function forceRebuildCache() {
  clearApplicationsCache();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  getApplicationsData(true);
  refreshHomeTab(ss);
  
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast("Cache successfully cleared and Home dashboard updated!", "Rebuild Done");
  } catch (e) {
    console.log("Rebuild finished successfully.");
  }
}

/**
 * Re-applies premium theme formatting across all employee tabs.
 */
function runInitialSetupAndFormatting() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const name = sheets[i].getName();
    if (name !== "Home" && name !== "Dashboard") {
      formatSheetTheme(sheets[i]);
    }
  }
  refreshHomeTab(ss);
  
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast("Premium Theme Formatting successfully applied to all tabs!", "Theme Complete");
  } catch (e) {
    console.log("Theme formatting applied successfully.");
  }
}

// --- UTILITIES (Utils) ---

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

function sanitizeInput(text) {
  if (text === null || text === undefined) return "";
  return text.toString().trim().replace(/<[^>]*>/g, '').replace(/[\n\r]+/g, ' ');
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
  const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
  return urlPattern.test(url);
}

function arrayUnique(array) {
  if (!array || !Array.isArray(array)) return [];
  return array.filter((value, index, self) => self.indexOf(value) === index);
}

// --- DATA ACCESS LAYER (DataLayer) ---

function getApplicationsData(forceRefresh = false) {
  const cache = CacheService.getScriptCache();
  
  if (!forceRefresh) {
    const cached = cache.get(CONFIG.CACHE_KEY_APPS);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        parsed.forEach(item => {
          if (item.timestamp) item.timestamp = new Date(item.timestamp);
        });
        return parsed;
      } catch (e) {
        console.warn("Failed to parse cached applications, rebuilding cache...", e);
      }
    }
  }

  const freshData = collectAllApplications();
  try {
    cache.put(CONFIG.CACHE_KEY_APPS, JSON.stringify(freshData), CONFIG.CACHE_TTL);
  } catch (e) {
    console.error("Cache write failure:", e);
  }
  return freshData;
}

function collectAllApplications() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
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
    const hasHeader = (firstRow[0] && firstRow[0].toString().toLowerCase().indexOf("date") !== -1);
    
    const indices = parseColumnIndices(firstRow);
    const startRow = hasHeader ? 1 : 0;
    
    for (let r = startRow; r < data.length; r++) {
      const row = data[r];
      const jobRole = (row[indices.role] || "").toString().trim();
      const clientName = (row[indices.client] || "").toString().trim();
      const rawUrl = (row[indices.url] || "").toString().trim();
      const status = (row[indices.status] || "New").toString().trim();
      const priority = (row[indices.priority] || "Medium").toString().trim();
      
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
      }
    }
  }

  for (let k = 0; k < uniqueApplications.length; k++) {
    const app = uniqueApplications[k];
    const urlKey = app.url.toLowerCase();
    app.claimedBy = urlClaims[urlKey] ? urlClaims[urlKey].join(", ") : app.employeeName;
  }

  uniqueApplications.sort((a, b) => b.timestamp - a.timestamp);
  return uniqueApplications;
}

function clearApplicationsCache() {
  const cache = CacheService.getScriptCache();
  cache.remove(CONFIG.CACHE_KEY_APPS);
}

// --- INPUT VALIDATION (ValidationService) ---

function validateApplication(data) {
  if (!data) return "Payload is empty.";
  if (!data.jobRole || sanitizeInput(data.jobRole) === "") return "Missing required field: jobRole";
  if (!data.clientName || sanitizeInput(data.clientName) === "") return "Missing required field: clientName";
  if (!data.applicationUrl || sanitizeInput(data.applicationUrl) === "") return "Missing required field: applicationUrl";
  if (!validateUrl(data.applicationUrl)) return "Invalid URL format.";
  return null;
}

function validateUrl(url) {
  if (!url) return false;
  const cleanUrl = url.trim().toLowerCase();
  return cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://");
}

function validateEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function validateEmployee(name) {
  if (!name) return false;
  const cleanName = sanitizeEmployeeName(name);
  if (cleanName === "" || cleanName === "Home" || cleanName === "Dashboard") return false;
  return true;
}

function sanitizeEmployeeName(name) {
  if (!name) return "General";
  return name.toString().trim().replace(/[\\\/\?\*\:\[\]]/g, '').substring(0, 31);
}

// --- FILTER LAYER (FilterService) ---

function applyFilters(applications, filters) {
  if (!applications || applications.length === 0) return [];
  if (!filters) return applications;

  let filtered = applications;

  if (filters.search && filters.search.trim() !== "") {
    filtered = filterBySearch(filtered, filters.search);
  }
  if (filters.role && filters.role !== "All Roles") {
    filtered = filtered.filter(app => 
      app.jobRole && app.jobRole.toLowerCase().includes(filters.role.toLowerCase())
    );
  }
  if (filters.status && filters.status !== "All Statuses") {
    filtered = filtered.filter(app => 
      app.status && app.status.trim().toLowerCase() === filters.status.trim().toLowerCase()
    );
  }
  if (filters.employee && filters.employee !== "All Employees") {
    filtered = filtered.filter(app => 
      app.claimedBy && app.claimedBy.includes(filters.employee)
    );
  }
  if (filters.dateRange && filters.dateRange !== "All Time") {
    filtered = filterByDateRange(filtered, filters.dateRange);
  }

  return filtered;
}

function filterBySearch(apps, searchTerm) {
  const query = searchTerm.toLowerCase().trim();
  return apps.filter(app => {
    const jobMatch = app.jobRole && app.jobRole.toLowerCase().includes(query);
    const clientMatch = app.clientName && app.clientName.toLowerCase().includes(query);
    const ownerMatch = app.claimedBy && app.claimedBy.toLowerCase().includes(query);
    return jobMatch || clientMatch || ownerMatch;
  });
}

function filterByDateRange(apps, range) {
  const now = new Date();
  return apps.filter(app => {
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
}

// --- ANALYTICS (AnalyticsService) ---

function calculateKPIs(applications) {
  if (!applications) return { totalLeads: 0, activeClients: 0, uniqueRoles: 0, addedToday: 0 };
  const now = new Date();
  const todayStr = now.toDateString();
  const clients = {};
  const roles = {};
  let addedToday = 0;
  
  applications.forEach(app => {
    if (app.clientName) clients[app.clientName.toLowerCase()] = true;
    if (app.jobRole) roles[app.jobRole.toLowerCase()] = true;
    if (app.timestamp) {
      const appDate = new Date(app.timestamp);
      if (appDate.toDateString() === todayStr) addedToday++;
    }
  });

  return {
    totalLeads: applications.length,
    activeClients: Object.keys(clients).length,
    uniqueRoles: Object.keys(roles).length,
    addedToday: addedToday
  };
}

function getSuccessRate(applications) {
  if (!applications || applications.length === 0) return 0;
  let successful = 0;
  applications.forEach(app => {
    const status = (app.status || "").toLowerCase();
    if (status === "accepted" || status === "offer") successful++;
  });
  return parseFloat(((successful / applications.length) * 100).toFixed(1));
}

// --- RENDER SERVICES (UIRenderer) ---

function setupHomeLayout(home, employees) {
  home.setHiddenGridlines(true);
  
  home.setColumnWidth(1, 50);  // S.No
  home.setColumnWidth(2, 120); // Date
  home.setColumnWidth(3, 180); // Job Role
  home.setColumnWidth(4, 180); // Client Name
  home.setColumnWidth(5, 200); // Application URL
  home.setColumnWidth(6, 120); // Action
  home.setColumnWidth(7, 180); // Claimed By
  home.setColumnWidth(8, 150); // Claim Job

  home.getRange("A1:H2").merge()
    .setValue("⚡ Primetek Global Solutions Dashboard")
    .setBackground(CONFIG.THEME.primaryDark)
    .setFontColor(CONFIG.THEME.surface)
    .setFontWeight("bold")
    .setFontFamily(CONFIG.THEME.font)
    .setFontSize(16)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  
  setupKPICards(home);
  setupFilterControls(home, employees);
}

function setupKPICards(sheet) {
  const kpiLabel = (cell, text) => {
    sheet.getRange(cell).setValue(text)
      .setBackground(CONFIG.THEME.headerBg)
      .setFontColor(CONFIG.THEME.textMuted)
      .setFontSize(9)
      .setFontFamily(CONFIG.THEME.font)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
  };

  kpiLabel("A4:B4", "📊 Total Leads");
  kpiLabel("C4:D4", "🏢 Active Clients");
  kpiLabel("E4:F4", "💼 Unique Roles");
  kpiLabel("G4:H4", "📅 Added Today");
  
  const kpiVal = (cell, formula, color) => {
    sheet.getRange(cell).setFormula(formula)
      .setFontSize(18)
      .setFontWeight("bold")
      .setFontFamily(CONFIG.THEME.font)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle")
      .setFontColor(color);
  };

  kpiVal("A5:B5", '=IF(COUNTA(E9:E)=0, 0, COUNTA(E9:E))', CONFIG.THEME.primary);
  kpiVal("C5:D5", '=IF(COUNTA(D9:D)=0, 0, COUNTUNIQUE(D9:D))', "#065F46");
  kpiVal("E5:F5", '=IF(COUNTA(C9:C)=0, 0, COUNTUNIQUE(C9:C))', CONFIG.THEME.textMain);
  kpiVal("G5:H5", '=IF(COUNTA(B9:B)=0, 0, COUNTIF(B9:B, TEXT(TODAY(),"dd-mmm")))', "#B45309");
}

function setupFilterControls(sheet, employees) {
  const filterLabelStyle = (range, label) => {
    range.setValue(label)
      .setFontFamily(CONFIG.THEME.font)
      .setFontSize(9)
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
    range.setBackground(CONFIG.THEME.surface)
      .setFontColor(CONFIG.THEME.textMain)
      .setFontFamily(CONFIG.THEME.font)
      .setFontSize(10)
      .setBorder(true, true, true, true, false, false, CONFIG.THEME.border, SpreadsheetApp.BorderStyle.SOLID);
  };

  inputStyle(sheet.getRange("B6"));
  if (sheet.getRange("B6").getValue() === "") sheet.getRange("B6").setValue("");

  const roleCell = sheet.getRange("D6");
  inputStyle(roleCell);
  const roles = ["All Roles"].concat(CONFIG.DEFAULT_ROLES);
  roleCell.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(roles, false).build());
  if (!roleCell.getValue()) roleCell.setValue("All Roles");

  const submitterCell = sheet.getRange("F6");
  inputStyle(submitterCell);
  const submitterList = ["All Employees"].concat(employees.slice(1));
  submitterCell.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(submitterList, false).build());
  if (!submitterCell.getValue()) submitterCell.setValue("All Employees");

  const dateCell = sheet.getRange("H6");
  inputStyle(dateCell);
  const dates = ["All Time", "Today", "Past 7 Days", "Past 30 Days"];
  dateCell.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(dates, false).build());
  if (!dateCell.getValue()) dateCell.setValue("All Time");

  sheet.setRowHeight(6, 36);

  const headers = [["S.No", "Date/Month", "Job Role", "Client Name", "Application URL", "Action", "Claimed By", "Claim Job"]];
  sheet.getRange("A8:H8").setValues(headers)
    .setBackground(CONFIG.THEME.headerBg)
    .setFontColor(CONFIG.THEME.textMuted)
    .setFontWeight("bold")
    .setFontSize(9)
    .setFontFamily(CONFIG.THEME.font)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(8, 32);
}

function renderApplicationTable(sheet, applications, employees) {
  if (!applications || applications.length === 0) return;

  const cellData = [];
  for (let j = 0; j < applications.length; j++) {
    const item = applications[j];
    cellData.push([
      j + 1,
      item.timestamp ? new Date(item.timestamp) : "",
      item.jobRole,
      item.clientName,
      item.url,
      '=HYPERLINK(E' + (9 + j) + ', "Apply 🔗")',
      item.claimedBy,
      "Claim Job ➕"
    ]);
  }
  
  const outputRange = sheet.getRange(9, 1, applications.length, 8);
  outputRange.setValues(cellData)
    .setFontFamily(CONFIG.THEME.font)
    .setFontSize(10)
    .setVerticalAlignment("middle")
    .setHorizontalAlignment("center")
    .setFontColor(CONFIG.THEME.textMain);

  sheet.getRange(9, 2, applications.length, 1).setNumberFormat("dd-mmm");

  const claimDropdownList = ["Claim Job ➕"].concat(employees.slice(1));
  const empRule = SpreadsheetApp.newDataValidation().requireValueInList(claimDropdownList, false).build();
  
  for (let r = 0; r < applications.length; r++) {
    const currentRowNum = 9 + r;
    sheet.setRowHeight(currentRowNum, 32);
    
    const rowRange = sheet.getRange(currentRowNum, 1, 1, 8);
    rowRange.setBackground(currentRowNum % 2 === 0 ? CONFIG.THEME.rowAlt : CONFIG.THEME.surface);
    
    sheet.getRange(currentRowNum, 3).setFontWeight("bold").setHorizontalAlignment("left");
    sheet.getRange(currentRowNum, 4).setFontColor(CONFIG.THEME.textMuted).setHorizontalAlignment("left");
    sheet.getRange(currentRowNum, 5).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setFontColor(CONFIG.THEME.primary);
    sheet.getRange(currentRowNum, 6).setFontWeight("bold").setFontColor(CONFIG.THEME.primary);
    sheet.getRange(currentRowNum, 7).setBackground("#ECFDF5").setFontColor("#047857").setFontWeight("bold");
    sheet.getRange(currentRowNum, 8).setDataValidation(empRule).setBackground(CONFIG.THEME.surface).setFontWeight("bold");
  }

  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }
  sheet.getRange(8, 1, applications.length + 1, 8).createFilter();
}

function applyStatusBadge(cell, status) {
  if (!cell || !status) return;
  const normalized = status.toUpperCase().trim();
  const badge = CONFIG.STATUS[normalized] || CONFIG.STATUS.NEW;
  
  cell.setBackground(badge.bg)
    .setFontColor(badge.text)
    .setFontWeight("bold")
    .setHorizontalAlignment("center");
}

// --- REST WEB ENDPOINTS (ApiService) ---

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

function handleGetRequest(params) {
  const forceRefresh = params.refresh === "true";
  const data = getApplicationsData(forceRefresh);
  let resultData = data;
  
  if (params.employee) {
    const empName = params.employee.trim();
    resultData = data.filter(app => 
      app.claimedBy && app.claimedBy.includes(empName)
    );
  }
  return sendJsonResponse({ applications: resultData }, true);
}

function handlePostRequest(payload) {
  const validationError = validateApplication(payload);
  if (validationError) {
    return sendJsonResponse({ error: validationError }, false);
  }

  let employeeName = (payload.employeeName || "General").trim();
  employeeName = sanitizeEmployeeName(employeeName);
  
  if (employeeName === "Home" || employeeName === "Dashboard") {
    employeeName = "General";
  }

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(employeeName);
  
  if (!sheet) {
    sheet = ss.insertSheet(employeeName);
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

  formatSheetTheme(sheet);
  
  clearApplicationsCache();
  refreshHomeTab(ss);
  
  return sendJsonResponse({ message: "Application successfully added!" }, true);
}

function sendJsonResponse(data, success = true) {
  const response = {
    success: success,
    timestamp: new Date().getTime(),
    data: data
  };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

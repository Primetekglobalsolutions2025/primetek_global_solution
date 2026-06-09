// --- CONFIGURATION ---
const CONFIG = {
  SPREADSHEET_ID: "1im0l80fq60pqBYgMOXPQ3h0IoGOjimMWdvCDBFjWfo8",
  CACHE_DURATION: 300, // 5 minutes
  EXCLUDED_SHEETS: ["Home", "Dashboard"],
  DEFAULT_EMPLOYEE: "General"
};

// --- THEME CONSTANTS ---
const THEME = {
  primary: "#4F46E5",
  primaryDark: "#312E81",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  textMain: "#0F172A",
  textMuted: "#64748B",
  border: "#E2E8F0",
  headerBg: "#F1F5F9",
  rowAlt: "#F8FAFC",
  successBg: "#DCFCE7",
  successText: "#166534",
  font: "Google Sans, Arial, sans-serif"
};

// --- UTILITY FUNCTIONS ---

/**
 * Safely parse column indices from header row
 */
function parseColumnIndices(headerRow) {
  const defaults = { timestamp: 0, jobRole: 1, clientName: 2, url: 3 };
  
  if (!headerRow || headerRow.length === 0) return defaults;
  
  const hasHeader = headerRow[0] && 
    headerRow[0].toString().toLowerCase().includes("date");
  
  if (!hasHeader) return defaults;
  
  return {
    timestamp: findColumnIndex(headerRow, ["date", "timestamp"]) ?? defaults.timestamp,
    jobRole: findColumnIndex(headerRow, ["role", "job"]) ?? defaults.jobRole,
    clientName: findColumnIndex(headerRow, ["client", "company"]) ?? defaults.clientName,
    url: findColumnIndex(headerRow, ["url", "link", "application"]) ?? defaults.url
  };
}

/**
 * Find column index by multiple possible header names
 */
function findColumnIndex(headers, keywords) {
  for (let keyword of keywords) {
    const idx = headers.findIndex(h => 
      h.toString().toLowerCase().includes(keyword.toLowerCase())
    );
    if (idx !== -1) return idx;
  }
  return null;
}

/**
 * Check if sheet should be excluded from processing
 */
function isExcludedSheet(sheetName) {
  return CONFIG.EXCLUDED_SHEETS.includes(sheetName);
}

/**
 * Validate employee name
 */
function sanitizeEmployeeName(name) {
  if (!name || typeof name !== 'string') return CONFIG.DEFAULT_EMPLOYEE;
  const cleaned = name.trim();
  return isExcludedSheet(cleaned) ? CONFIG.DEFAULT_EMPLOYEE : cleaned;
}

/**
 * Get cache key for application data
 */
function getCacheKey() {
  return `applications_${CONFIG.SPREADSHEET_ID}`;
}

// --- DATA COLLECTION ---

/**
 * Collect all applications from spreadsheet with caching
 */
function collectAllApplications(useCache = true) {
  const cache = CacheService.getScriptCache();
  const cacheKey = getCacheKey();
  
  if (useCache) {
    const cached = cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        Logger.log("Cache parse error: " + e);
      }
    }
  }
  
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheets = ss.getSheets();
  const result = {
    applications: [],
    urlClaims: {},
    employees: []
  };
  
  sheets.forEach(sheet => {
    const employeeName = sheet.getName();
    
    if (isExcludedSheet(employeeName)) return;
    
    result.employees.push(employeeName);
    
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) return;
    
    const colIndices = parseColumnIndices(data[0]);
    const hasHeader = data[0][0] && 
      data[0][0].toString().toLowerCase().includes("date");
    const startRow = hasHeader ? 1 : 0;
    
    for (let r = startRow; r < data.length; r++) {
      const row = data[r];
      
      // Skip empty rows
      if (!row[colIndices.jobRole] && !row[colIndices.clientName]) continue;
      
      const rawUrl = (row[colIndices.url] || "").toString().trim();
      const urlKey = rawUrl.toLowerCase();
      
      // Track URL claims
      if (urlKey) {
        if (!result.urlClaims[urlKey]) {
          result.urlClaims[urlKey] = [];
        }
        if (!result.urlClaims[urlKey].includes(employeeName)) {
          result.urlClaims[urlKey].push(employeeName);
        }
      }
      
      result.applications.push({
        employeeName,
        timestamp: row[colIndices.timestamp] ? 
          new Date(row[colIndices.timestamp]) : new Date(),
        jobRole: (row[colIndices.jobRole] || "").toString().trim(),
        clientName: (row[colIndices.clientName] || "").toString().trim(),
        url: rawUrl
      });
    }
  });
  
  // Cache the result
  try {
    cache.put(cacheKey, JSON.stringify(result), CONFIG.CACHE_DURATION);
  } catch (e) {
    Logger.log("Cache write error: " + e);
  }
  
  return result;
}

/**
 * Process applications: deduplicate and enrich
 */
function processApplications(rawData) {
  const { applications, urlClaims } = rawData;
  const uniqueApplications = [];
  const seenUrls = {};
  
  // Deduplicate by URL, keeping latest
  applications.forEach(app => {
    const urlKey = app.url.toLowerCase();
    
    if (!urlKey) {
      uniqueApplications.push(app);
      return;
    }
    
    if (!seenUrls[urlKey]) {
      seenUrls[urlKey] = app;
      uniqueApplications.push(app);
    } else {
      // Keep the latest timestamp
      if (app.timestamp > seenUrls[urlKey].timestamp) {
        Object.assign(seenUrls[urlKey], {
          timestamp: app.timestamp,
          employeeName: app.employeeName,
          jobRole: app.jobRole,
          clientName: app.clientName
        });
      }
    }
  });
  
  // Enrich with claimedBy
  uniqueApplications.forEach(app => {
    const urlKey = app.url.toLowerCase();
    app.claimedBy = urlClaims[urlKey] ? 
      urlClaims[urlKey].join(", ") : app.employeeName;
  });
  
  // Sort by timestamp descending
  uniqueApplications.sort((a, b) => b.timestamp - a.timestamp);
  
  return uniqueApplications;
}

// --- WEB APP ENDPOINTS ---

/**
 * Handle GET requests - return all applications
 */
function doGet(e) {
  try {
    const rawData = collectAllApplications(true);
    const applications = processApplications(rawData);
    
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: true, 
        data: applications,
        count: applications.length 
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    Logger.log("doGet error: " + err);
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: false, 
        error: err.toString() 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle POST requests - add new application
 */
function doPost(e) {
  try {
    // Validate input
    if (!e.postData || !e.postData.contents) {
      throw new Error("No data provided");
    }
    
    const data = JSON.parse(e.postData.contents);
    
    // Validate required fields
    if (!data.jobRole && !data.clientName) {
      throw new Error("Job role or client name is required");
    }
    
    const employeeName = sanitizeEmployeeName(data.employeeName);
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    let sheet = ss.getSheetByName(employeeName);
    
    if (!sheet) {
      sheet = ss.insertSheet(employeeName);
      sheet.appendRow(["Date/Month", "Job Role", "Client Name", "Application URL"]);
    }
    
    // Check for duplicate URL
    const applicationUrl = (data.applicationUrl || "").toString().trim();
    if (applicationUrl) {
      const existingData = sheet.getDataRange().getValues();
      const urlColumnIndex = 3; // Column D (0-indexed)
      
      for (let i = 1; i < existingData.length; i++) {
        if (existingData[i][urlColumnIndex] === applicationUrl) {
          return ContentService
            .createTextOutput(JSON.stringify({ 
              success: false, 
              error: "Application URL already exists in this sheet",
              duplicate: true
            }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    
    sheet.appendRow([
      new Date(),
      data.jobRole || "",
      data.clientName || "",
      applicationUrl
    ]);
    
    formatSheetTheme(sheet);
    
    // Clear cache to force refresh
    CacheService.getScriptCache().remove(getCacheKey());
    
    // Refresh home tab
    refreshHomeTab(ss);
    
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: true,
        message: "Application added successfully"
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    Logger.log("doPost error: " + err);
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: false, 
        error: err.toString() 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- FORMATTING FUNCTIONS ---

/**
 * Apply theme formatting to a sheet
 */
function formatSheetTheme(sheet) {
  if (!sheet) return;
  
  sheet.setHiddenGridlines(false);
  
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  
  if (lastRow === 0 || lastColumn === 0) return;
  
  // Header row
  const headerRange = sheet.getRange(1, 1, 1, lastColumn);
  headerRange
    .setBackground(THEME.primaryDark)
    .setFontColor(THEME.surface)
    .setFontWeight("bold")
    .setFontFamily(THEME.font)
    .setFontSize(10)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  
  sheet.setRowHeight(1, 36);
  
  // Data rows
  if (lastRow > 1) {
    const dataRange = sheet.getRange(2, 1, lastRow - 1, lastColumn);
    dataRange
      .setFontFamily(THEME.font)
      .setFontSize(10)
      .setVerticalAlignment("middle")
      .setFontColor(THEME.textMain);
    
    // Alternate row colors
    for (let r = 2; r <= lastRow; r++) {
      const rowRange = sheet.getRange(r, 1, 1, lastColumn);
      rowRange.setBackground(r % 2 === 0 ? THEME.rowAlt : THEME.surface);
      sheet.setRowHeight(r, 28);
    }
    
    // Date column formatting
    const timeRange = sheet.getRange(2, 1, lastRow - 1, 1);
    timeRange
      .setNumberFormat("dd-mmm")
      .setHorizontalAlignment("center");
    
    // URL column formatting
    const urlRange = sheet.getRange(2, 4, lastRow - 1, 1);
    urlRange
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
      .setFontColor(THEME.primary);
  }
  
  // Column widths
  sheet.setColumnWidth(1, 120);  // Date/Month
  sheet.setColumnWidth(2, 180);  // Job Role
  sheet.setColumnWidth(3, 180);  // Client Name
  sheet.setColumnWidth(4, 300);  // Application URL
}

// --- EVENT HANDLERS ---

/**
 * Handle edit events on Home sheet
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
  
  // Filter changes (Row 6, columns B, D, F, H)
  if (row === 6 && [2, 4, 6, 8].includes(col)) {
    refreshHomeTab(ss);
    return;
  }
  
  // Claim job logic (Row 9+, Column H)
  if (row >= 9 && col === 8 && value && value !== "Claim Job ➕") {
    handleJobClaim(ss, sheet, row, value, range);
  }
}

/**
 * Handle job claim action
 */
function handleJobClaim(ss, sheet, row, claimEmployee, range) {
  try {
    const jobRowData = sheet.getRange(row, 1, 1, 8).getValues()[0];
    const jobRole = jobRowData[2];        // Col C
    const clientName = jobRowData[3];     // Col D
    const applyUrl = jobRowData[4];       // Col E
    const claimEmp = sanitizeEmployeeName(claimEmployee);
    
    let targetSheet = ss.getSheetByName(claimEmp);
    
    if (!targetSheet) {
      targetSheet = ss.insertSheet(claimEmp);
      targetSheet.appendRow(["Date/Month", "Job Role", "Client Name", "Application URL"]);
      formatSheetTheme(targetSheet);
    }
    
    // Check for duplicates
    const lastTargetRow = targetSheet.getLastRow();
    if (lastTargetRow > 1) {
      const existingUrls = targetSheet.getRange(2, 4, lastTargetRow - 1, 1).getValues();
      for (let i = 0; i < existingUrls.length; i++) {
        if (existingUrls[i][0] === applyUrl) {
          range.setValue("Claim Job ➕");
          ss.toast(`⚠️ Job already logged in ${claimEmp}'s tab!`, "Duplicate");
          return;
        }
      }
    }
    
    targetSheet.appendRow([new Date(), jobRole, clientName, applyUrl]);
    formatSheetTheme(targetSheet);
    
    // Reset claim cell
    range.setValue("Claim Job ➕");
    
    // Clear cache and refresh
    CacheService.getScriptCache().remove(getCacheKey());
    refreshHomeTab(ss);
    
    ss.toast(`🎉 Successfully claimed by ${claimEmp}!`, "Success");
    
  } catch (err) {
    Logger.log("handleJobClaim error: " + err);
    range.setValue("Claim Job ➕");
    ss.toast("❌ Error: " + err.toString(), "Error");
  }
}

// --- HOME TAB FUNCTIONS ---

/**
 * Refresh the Home dashboard tab
 */
function refreshHomeTab(ss) {
  let home = ss.getSheetByName("Home");
  if (!home) {
    home = ss.insertSheet("Home", 0);
  }
  
  const rawData = collectAllApplications(false); // Don't use cache for UI refresh
  const applications = processApplications(rawData);
  const employees = ["Select Employee"].concat(rawData.employees);
  
  setupHomeLayout(home, employees);
  
  const filters = getActiveFilters(home);
  const filteredApps = applyFilters(applications, filters);
  
  renderApplicationTable(home, filteredApps, employees);
}

/**
 * Get current filter values from Home sheet
 */
function getActiveFilters(home) {
  return {
    search: (home.getRange("B6").getValue() || "").toString().toLowerCase().trim(),
    role: (home.getRange("D6").getValue() || "All Roles").toString().toLowerCase(),
    submitter: (home.getRange("F6").getValue() || "All Employees").toString().trim(),
    date: (home.getRange("H6").getValue() || "All Time").toString().trim()
  };
}

/**
 * Apply filters to applications
 */
function applyFilters(applications, filters) {
  const now = new Date();
  
  return applications.filter(app => {
    // Submitter filter
    if (filters.submitter !== "All Employees" && 
        !app.claimedBy.includes(filters.submitter)) {
      return false;
    }
    
    // Search filter
    if (filters.search) {
      const searchText = `${app.jobRole} ${app.clientName} ${app.claimedBy}`.toLowerCase();
      if (!searchText.includes(filters.search)) return false;
    }
    
    // Role filter
    if (filters.role !== "all roles" && 
        !app.jobRole.toLowerCase().includes(filters.role)) {
      return false;
    }
    
    // Date filter
    if (filters.date !== "All Time" && app.timestamp) {
      const appDate = new Date(app.timestamp);
      const diffDays = Math.ceil(Math.abs(now - appDate) / (1000 * 60 * 60 * 24));
      
      if (filters.date === "Today" && appDate.toDateString() !== now.toDateString()) {
        return false;
      }
      if (filters.date === "Past 7 Days" && diffDays > 7) {
        return false;
      }
      if (filters.date === "Past 30 Days" && diffDays > 30) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Render applications in the Home table
 */
function renderApplicationTable(home, applications, employees) {
  // Clear existing data
  const lastRow = home.getLastRow();
  if (lastRow >= 9) {
    home.getRange(9, 1, lastRow - 8, 8)
      .clearDataValidations()
      .clearContent()
      .clearFormat()
      .setBackground(null);
  }
  
  if (applications.length === 0) return;
  
  // Prepare cell data
  const cellData = applications.map((app, index) => [
    index + 1,
    app.timestamp ? new Date(app.timestamp) : "",
    app.jobRole,
    app.clientName,
    app.url,
    `=HYPERLINK(E${9 + index}, "Apply 🔗")`,
    app.claimedBy,
    "Claim Job ➕"
  ]);
  
  const outputRange = home.getRange(9, 1, applications.length, 8);
  outputRange
    .setValues(cellData)
    .setFontFamily(THEME.font)
    .setFontSize(10)
    .setVerticalAlignment("middle")
    .setHorizontalAlignment("center")
    .setFontColor(THEME.textMain);
  
  // Date column formatting
  home.getRange(9, 2, applications.length, 1).setNumberFormat("dd-mmm");
  
  // Row-specific formatting
  const claimDropdownList = ["Claim Job ➕"].concat(employees.slice(1));
  const empRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(claimDropdownList, false)
    .build();
  
  for (let r = 0; r < applications.length; r++) {
    const currentRow = 9 + r;
    home.setRowHeight(currentRow, 32);
    
    const rowRange = home.getRange(currentRow, 1, 1, 8);
    rowRange.setBackground(currentRow % 2 === 0 ? THEME.rowAlt : THEME.surface);
    
    // Job Role
    home.getRange(currentRow, 3)
      .setFontWeight("bold")
      .setHorizontalAlignment("left");
    
    // Client Name
    home.getRange(currentRow, 4)
      .setFontColor(THEME.textMuted)
      .setHorizontalAlignment("left");
    
    // Application URL
    home.getRange(currentRow, 5)
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
      .setFontColor(THEME.primary);
    
    // Action link
    home.getRange(currentRow, 6)
      .setFontWeight("bold")
      .setFontColor(THEME.primary);
    
    // Claimed By
    home.getRange(currentRow, 7)
      .setBackground("#ECFDF5")
      .setFontColor("#047857")
      .setFontWeight("bold");
    
    // Claim Job dropdown
    home.getRange(currentRow, 8)
      .setDataValidation(empRule)
      .setBackground(THEME.surface)
      .setFontWeight("bold");
  }
  
  // Apply filter to table
  if (home.getFilter()) {
    home.getFilter().remove();
  }
  home.getRange(8, 1, applications.length + 1, 8).createFilter();
}

/**
 * Setup Home sheet layout and controls
 */
function setupHomeLayout(home, employees) {
  home.setHiddenGridlines(true);
  
  // Column widths
  home.setColumnWidth(1, 50);   // S.No
  home.setColumnWidth(2, 120);  // Date
  home.setColumnWidth(3, 180);  // Job Role
  home.setColumnWidth(4, 180);  // Client Name
  home.setColumnWidth(5, 200);  // Application URL
  home.setColumnWidth(6, 120);  // Action
  home.setColumnWidth(7, 180);  // Claimed By
  home.setColumnWidth(8, 150);  // Claim Job
  
  // Title bar
  home.getRange("A1:H2")
    .merge()
    .setValue("⚡ Primetek Global Solutions Dashboard")
    .setBackground(THEME.primaryDark)
    .setFontColor(THEME.surface)
    .setFontWeight("bold")
    .setFontFamily(THEME.font)
    .setFontSize(16)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  
  // KPI Dashboard Cards (Row 4)
  setupKPICards(home);
  
  // Filter Control Panel (Row 6)
  setupFilterControls(home, employees);
  
  // Table Headers (Row 8)
  const headers = [["S.No", "Date/Month", "Job Role", "Client Name", 
                    "Application URL", "Action", "Claimed By", "Claim Job"]];
  
  home.getRange("A8:H8")
    .setValues(headers)
    .setBackground(THEME.headerBg)
    .setFontColor(THEME.textMuted)
    .setFontWeight("bold")
    .setFontSize(9)
    .setFontFamily(THEME.font)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  
  home.setRowHeight(8, 32);
}

/**
 * Setup KPI dashboard cards
 */
function setupKPICards(home) {
  const kpis = [
    { range: "A4:B4", label: "📊 Total Leads", formula: '=IF(COUNTA(E9:E)=0, 0, COUNTA(E9:E))', color: THEME.primary },
    { range: "C4:D4", label: "🏢 Active Clients", formula: '=IF(COUNTA(D9:D)=0, 0, COUNTUNIQUE(D9:D))', color: THEME.successText },
    { range: "E4:F4", label: "💼 Unique Roles", formula: '=IF(COUNTA(C9:C)=0, 0, COUNTUNIQUE(C9:C))', color: THEME.textMain },
    { range: "G4:H4", label: "📅 Added Today", formula: '=IF(COUNTA(B9:B)=0, 0, COUNTIF(B9:B, TEXT(TODAY(),"dd-mmm")))', color: "#B45309" }
  ];
  
  kpis.forEach(kpi => {
    const labelRange = home.getRange(kpi.range);
    labelRange
      .merge()
      .setValue(kpi.label)
      .setBackground(THEME.headerBg)
      .setFontColor(THEME.textMuted)
      .setFontSize(9)
      .setHorizontalAlignment("center");
    
    const valueRange = home.getRange(kpi.range.replace("4", "5"));
    valueRange
      .merge()
      .setFormula(kpi.formula)
      .setFontSize(18)
      .setFontWeight("bold")
      .setHorizontalAlignment("center")
      .setFontColor(kpi.color);
  });
}

/**
 * Setup filter controls
 */
function setupFilterControls(home, employees) {
  const filters = [
    { labelCell: "A6", inputCell: "B6", label: "🔍 Search:", type: "text" },
    { labelCell: "C6", inputCell: "D6", label: "💼 Role:", type: "list", 
      options: ["All Roles", "Control Engineer", "Data Engineer", "Data Analyst", "Software Engineer"] },
    { labelCell: "E6", inputCell: "F6", label: "👤 Submitter:", type: "list", 
      options: ["All Employees"].concat(employees.slice(1)) },
    { labelCell: "G6", inputCell: "H6", label: "📅 Date:", type: "list", 
      options: ["All Time", "Today", "Past 7 Days", "Past 30 Days"] }
  ];
  
  filters.forEach(filter => {
    // Label
    home.getRange(filter.labelCell)
      .setValue(filter.label)
      .setFontFamily(THEME.font)
      .setFontSize(9)
      .setFontColor(THEME.textMuted)
      .setFontWeight("bold")
      .setHorizontalAlignment("right")
      .setVerticalAlignment("middle");
    
    // Input
    const inputRange = home.getRange(filter.inputCell);
    inputRange
      .setBackground(THEME.surface)
      .setFontColor(THEME.textMain)
      .setBorder(true, true, true, true, false, false, 
                 THEME.border, SpreadsheetApp.BorderStyle.SOLID);
    
    if (filter.type === "list") {
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(filter.options, false)
        .build();
      inputRange.setDataValidation(rule);
      
      if (!inputRange.getValue()) {
        inputRange.setValue(filter.options[0]);
      }
    } else if (filter.type === "text" && !inputRange.getValue()) {
      inputRange.setValue("");
    }
  });
  
  home.setRowHeight(6, 36);
}

// --- INSTALLATION ---

/**
 * Run this once to initialize the dashboard
 */
function runInitialSetupAndFormatting() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheets = ss.getSheets();
  
  sheets.forEach(sheet => {
    if (!isExcludedSheet(sheet.getName())) {
      formatSheetTheme(sheet);
    }
  });
  
  refreshHomeTab(ss);
  
  SpreadsheetApp.getActiveSpreadsheet()
    .toast("✅ Premium Dashboard Initialized Successfully!", "Success", 5);
}

/**
 * Clear cache manually (useful for debugging)
 */
function clearCache() {
  CacheService.getScriptCache().remove(getCacheKey());
  SpreadsheetApp.getActiveSpreadsheet()
    .toast("✅ Cache cleared successfully", "Cache", 3);
}

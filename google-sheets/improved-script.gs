// --- CONFIGURATION ---
const CONFIG = {
  SPREADSHEET_ID: "1im0l80fq60pqBYgMOXPQ3h0IoGOjimMWdvCDBFjWfo8",
  CACHE_TTL: 300, // 5 minutes (in seconds)
  CACHE_KEY_APPS: "primetek_all_apps",
  THEME: {
    primary: "#4F46E5",       // Indigo 600
    primaryDark: "#312E81",   // Indigo 900
    background: "#F8FAFC",    // Slate 50
    surface: "#FFFFFF",       // White
    textMain: "#0F172A",      // Slate 900
    textMuted: "#64748B",     // Slate 500
    border: "#E2E8F0",        // Slate 200
    headerBg: "#F1F5F9",      // Slate 100
    rowAlt: "#F8FAFC",        // Slate 50
    successBg: "#DCFCE7",     // Green 100
    successText: "#166534",   // Green 800
    font: "Google Sans, Arial, sans-serif"
  }
};

/**
 * Called automatically when spreadsheet is opened.
 * Adds custom control menus to the Google Sheets UI.
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("⚡ Primetek Panel")
      .addItem("🔄 Rebuild Cache & Refresh", "forceRebuildCache")
      .addItem("🎨 Format All Sheets Theme", "runInitialSetupAndFormatting")
      .addToUi();
  } catch (e) {
    console.warn("Failed to create menu (likely running as Web App context):", e);
  }
}

/**
 * Web App GET endpoint.
 * Returns unique job applications (reads from script cache if available).
 */
function doGet(e) {
  try {
    const data = getApplicationsData(false); // Utilize cache
    return createJsonResponse({ success: true, data: data });
  } catch (err) {
    console.error("Error in doGet:", err);
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Web App POST endpoint.
 * Adds new job application. Clears cache and updates home view.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ success: false, error: "Missing payload contents" });
    }

    const payload = JSON.parse(e.postData.contents);
    const validationError = validatePostPayload(payload);
    if (validationError) {
      return createJsonResponse({ success: false, error: validationError });
    }

    let employeeName = (payload.employeeName || "General").trim();
    if (employeeName === "Home" || employeeName === "Dashboard") {
      employeeName = "General";
    }

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName(employeeName);
    
    if (!sheet) {
      sheet = ss.insertSheet(employeeName);
      sheet.appendRow(["Date/Month", "Job Role", "Client Name", "Application URL"]);
    }
    
    sheet.appendRow([
      new Date(),
      (payload.jobRole || "").trim(),
      (payload.clientName || "").trim(),
      (payload.applicationUrl || "").trim()
    ]);

    formatSheetTheme(sheet);
    
    // Invalidate cache and update home tab
    clearApplicationsCache();
    refreshHomeTab(ss);
    
    return createJsonResponse({ success: true });
  } catch (err) {
    console.error("Error in doPost:", err);
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Formats individual employee sheet tabs with custom design themes.
 */
function formatSheetTheme(sheet) {
  if (!sheet) return;
  sheet.setHiddenGridlines(false);
  
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow === 0 || lastColumn === 0) return;

  // Header formatting
  const headerRange = sheet.getRange(1, 1, 1, lastColumn);
  headerRange.setBackground(CONFIG.THEME.primaryDark)
    .setFontColor(CONFIG.THEME.surface)
    .setFontWeight("bold")
    .setFontFamily(CONFIG.THEME.font)
    .setFontSize(10)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 36);

  // Rows formatting
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
    }
    
    // Date/Month column formatting (dd-mmm)
    const timeRange = sheet.getRange(2, 1, lastRow - 1, 1);
    timeRange.setNumberFormat("dd-mmm").setHorizontalAlignment("center");
    
    // Wrap long URLs to protect layout structure
    const urlRange = sheet.getRange(2, 4, lastRow - 1, 1);
    urlRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setFontColor(CONFIG.THEME.primary);
  }

  sheet.setColumnWidth(1, 120); // Date/Month
  sheet.setColumnWidth(2, 180); // Job Role
  sheet.setColumnWidth(3, 180); // Client Name
  sheet.setColumnWidth(4, 300); // Application URL
}

/**
 * Edit listener on Home sheet filters or Claim dropdowns.
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

  // 1. If filters in Row 6 are modified, rebuild grid
  if (row === 6 && (col === 2 || col === 4 || col === 6 || col === 8)) {
    refreshHomeTab(ss);
    return;
  }

  // 2. Claim Action (Row 9+, Col 8 / Column H)
  if (row >= 9 && col === 8 && value && value !== "Claim Job ➕") {
    try {
      const jobRowData = sheet.getRange(row, 1, 1, 8).getValues()[0];
      const jobRole = jobRowData[2];       // Col C
      const clientName = jobRowData[3];     // Col D
      const applyUrl = jobRowData[4];       // Col E
      const claimEmployee = value.trim();   // selected employee name

      let targetSheet = ss.getSheetByName(claimEmployee);
      if (!targetSheet) {
        targetSheet = ss.insertSheet(claimEmployee);
        targetSheet.appendRow(["Date/Month", "Job Role", "Client Name", "Application URL"]);
        formatSheetTheme(targetSheet);
      }

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
        ss.toast(`⚠️ Job already logged in ${claimEmployee}'s tab!`, "Duplicate");
        return;
      }

      targetSheet.appendRow([new Date(), jobRole, clientName, applyUrl]);
      formatSheetTheme(targetSheet);

      // Reset dropdown immediately
      range.setValue("Claim Job ➕");
      
      // Invalidate cache and update Home tab
      clearApplicationsCache();
      refreshHomeTab(ss);
      
      ss.toast(`🎉 Successfully claimed by ${claimEmployee}!`, "Success");
    } catch (err) {
      range.setValue("Claim Job ➕");
      ss.toast("❌ Error: " + err.toString(), "Error");
    }
  }
}

/**
 * Re-reads database, applies filters, and writes back application rows to the Home Sheet.
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

  // Fetch unique job applications using cache layer
  const uniqueApplications = getApplicationsData(false);

  setupHomeLayout(home, employees, ss);

  const filterSearch = (home.getRange("B6").getValue() || "").toString().toLowerCase().trim();
  const filterRole = (home.getRange("D6").getValue() || "All Roles").toString().toLowerCase().trim();
  const filterSubmitter = (home.getRange("F6").getValue() || "All Employees").toString().trim();
  const filterDate = (home.getRange("H6").getValue() || "All Time").toString().trim();

  // Clear existing Home tab records
  const lastRow = home.getLastRow();
  if (lastRow >= 9) {
    home.getRange(9, 1, lastRow - 8, 8).clearDataValidations().clearContent().clearFormat().setBackground(null);
  }

  const filteredApps = [];
  const now = new Date();
  
  for (let k = 0; k < uniqueApplications.length; k++) {
    const app = uniqueApplications[k];
    
    // Submitter / Claimer filter
    if (filterSubmitter !== "All Employees" && app.claimedBy.indexOf(filterSubmitter) === -1) continue;
    
    // Keyword search filter
    if (filterSearch !== "") {
      const matchText = (app.jobRole + " " + app.clientName + " " + app.claimedBy).toLowerCase();
      if (matchText.indexOf(filterSearch) === -1) continue;
    }
    
    // Role filter
    if (filterRole !== "all roles" && app.jobRole.toLowerCase().indexOf(filterRole) === -1) continue;
    
    // Date preset filter
    if (filterDate !== "All Time" && app.timestamp) {
      const appDate = new Date(app.timestamp);
      const diffDays = Math.ceil(Math.abs(now.getTime() - appDate.getTime()) / (1000 * 60 * 60 * 24));
      if (filterDate === "Today" && appDate.toDateString() !== now.toDateString()) continue;
      if (filterDate === "Past 7 Days" && diffDays > 7) continue;
      if (filterDate === "Past 30 Days" && diffDays > 30) continue;
    }
    filteredApps.push(app);
  }

  if (filteredApps.length > 0) {
    const cellData = [];
    for (let j = 0; j < filteredApps.length; j++) {
      const item = filteredApps[j];
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
    
    const outputRange = home.getRange(9, 1, filteredApps.length, 8);
    outputRange.setValues(cellData)
      .setFontFamily(CONFIG.THEME.font)
      .setFontSize(10)
      .setVerticalAlignment("middle")
      .setHorizontalAlignment("center")
      .setFontColor(CONFIG.THEME.textMain);

    // Format Date Column
    home.getRange(9, 2, filteredApps.length, 1).setNumberFormat("dd-mmm");

    // Dropdown validation rules for claiming
    const claimDropdownList = ["Claim Job ➕"].concat(employees.slice(1));
    const empRule = SpreadsheetApp.newDataValidation().requireValueInList(claimDropdownList, false).build();
    
    for (let r = 0; r < filteredApps.length; r++) {
      const currentRowNum = 9 + r;
      home.setRowHeight(currentRowNum, 32);
      
      const rowRange = home.getRange(currentRowNum, 1, 1, 8);
      rowRange.setBackground(currentRowNum % 2 === 0 ? CONFIG.THEME.rowAlt : CONFIG.THEME.surface);
      
      home.getRange(currentRowNum, 3).setFontWeight("bold").setHorizontalAlignment("left"); // Role
      home.getRange(currentRowNum, 4).setFontColor(CONFIG.THEME.textMuted).setHorizontalAlignment("left"); // Company Name
      home.getRange(currentRowNum, 5).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setFontColor(CONFIG.THEME.primary); // Link
      home.getRange(currentRowNum, 6).setFontWeight("bold").setFontColor(CONFIG.THEME.primary); // Action Link
      home.getRange(currentRowNum, 7).setBackground("#ECFDF5").setFontColor("#047857").setFontWeight("bold"); // Claimed By
      home.getRange(currentRowNum, 8).setDataValidation(empRule).setBackground(CONFIG.THEME.surface).setFontWeight("bold"); // Dropdown
    }

    // Apply header filter automatically
    if (home.getFilter()) {
      home.getFilter().remove();
    }
    home.getRange(8, 1, filteredApps.length + 1, 8).createFilter();
  }
}

/**
 * Builds the structural KPI, filter headers, and metadata grid of the Home Tab.
 */
function setupHomeLayout(home, employees, ss) {
  home.setHiddenGridlines(true);
  home.setColumnWidth(1, 50);  // S.No
  home.setColumnWidth(2, 120); // Date
  home.setColumnWidth(3, 180); // Job Role
  home.setColumnWidth(4, 180); // Client Name
  home.setColumnWidth(5, 200); // Application URL
  home.setColumnWidth(6, 120); // Action
  home.setColumnWidth(7, 180); // Claimed By
  home.setColumnWidth(8, 150); // Claim Job

  // 1. Title Bar
  home.getRange("A1:H2").merge()
    .setValue("⚡ Primetek Global Solutions Dashboard")
    .setBackground(CONFIG.THEME.primaryDark)
    .setFontColor(CONFIG.THEME.surface)
    .setFontWeight("bold")
    .setFontFamily(CONFIG.THEME.font)
    .setFontSize(16)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  
  // 2. KPI Cards
  const kpiLabel = (cell, text) => {
    home.getRange(cell).setValue(text).setBackground(CONFIG.THEME.headerBg).setFontColor(CONFIG.THEME.textMuted).setFontSize(9).setHorizontalAlignment("center");
  };
  kpiLabel("A4:B4", "📊 Total Leads");
  kpiLabel("C4:D4", "🏢 Active Clients");
  kpiLabel("E4:F4", "💼 Unique Roles");
  kpiLabel("G4:H4", "📅 Added Today");
  
  const kpiVal = (cell, formula, color) => {
    home.getRange(cell).setFormula(formula).setFontSize(18).setFontWeight("bold").setHorizontalAlignment("center").setFontColor(color);
  };
  kpiVal("A5:B5", '=IF(COUNTA(E9:E)=0, 0, COUNTA(E9:E))', CONFIG.THEME.primary);
  kpiVal("C5:D5", '=IF(COUNTA(D9:D)=0, 0, COUNTUNIQUE(D9:D))', CONFIG.THEME.successText);
  kpiVal("E5:F5", '=IF(COUNTA(C9:C)=0, 0, COUNTUNIQUE(C9:C))', CONFIG.THEME.textMain);
  kpiVal("G5:H5", '=IF(COUNTA(B9:B)=0, 0, COUNTIF(B9:B, TEXT(TODAY(),"dd-mmm")))', "#B45309"); // Amber
  
  // 3. Filter Controls Header Row (Row 6)
  const filterLabelStyle = (range, label) => {
    range.setValue(label).setFontFamily(CONFIG.THEME.font).setFontSize(9).setFontColor(CONFIG.THEME.textMuted).setFontWeight("bold").setHorizontalAlignment("right").setVerticalAlignment("middle");
  };
  
  filterLabelStyle(home.getRange("A6"), "🔍 Search:");
  filterLabelStyle(home.getRange("C6"), "💼 Role:");
  filterLabelStyle(home.getRange("E6"), "👤 Submitter:");
  filterLabelStyle(home.getRange("G6"), "📅 Date:");

  const inputStyle = (range) => {
    range.setBackground(CONFIG.THEME.surface).setFontColor(CONFIG.THEME.textMain).setBorder(true, true, true, true, false, false, CONFIG.THEME.border, SpreadsheetApp.BorderStyle.SOLID);
  };

  inputStyle(home.getRange("B6"));
  if (home.getRange("B6").getValue() === "") home.getRange("B6").setValue("");

  const roleCell = home.getRange("D6");
  inputStyle(roleCell);
  const roles = ["All Roles", "Control Engineer", "Data Engineer", "Data Analyst", "Software Engineer"];
  roleCell.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(roles, false).build());
  if (!roleCell.getValue()) roleCell.setValue("All Roles");

  const submitterCell = home.getRange("F6");
  inputStyle(submitterCell);
  const submitterList = ["All Employees"].concat(employees.slice(1));
  submitterCell.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(submitterList, false).build());
  if (!submitterCell.getValue()) submitterCell.setValue("All Employees");

  const dateCell = home.getRange("H6");
  inputStyle(dateCell);
  const dates = ["All Time", "Today", "Past 7 Days", "Past 30 Days"];
  dateCell.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(dates, false).build());
  if (!dateCell.getValue()) dateCell.setValue("All Time");

  home.setRowHeight(6, 36);

  // 4. Table Header Row (Row 8)
  const headers = [["S.No", "Date/Month", "Job Role", "Client Name", "Application URL", "Action", "Claimed By", "Claim Job"]];
  home.getRange("A8:H8").setValues(headers)
    .setBackground(CONFIG.THEME.headerBg)
    .setFontColor(CONFIG.THEME.textMuted)
    .setFontWeight("bold")
    .setFontSize(9)
    .setFontFamily(CONFIG.THEME.font)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  home.setRowHeight(8, 32);
}

/**
 * High-performance Cache Service controller.
 * Pulls application workbook data from the cache or collects and parses it from sheets.
 */
function getApplicationsData(forceRefresh = false) {
  const cache = CacheService.getScriptCache();
  
  if (!forceRefresh) {
    const cached = cache.get(CONFIG.CACHE_KEY_APPS);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Map string date values back to Date objects
        parsed.forEach(item => {
          if (item.timestamp) item.timestamp = new Date(item.timestamp);
        });
        return parsed;
      } catch (e) {
        console.warn("Failed to parse cached applications, triggering rebuild:", e);
      }
    }
  }

  // Cache missed - collect and recompile from individual employee tabs
  const freshData = collectAllApplications();
  try {
    cache.put(CONFIG.CACHE_KEY_APPS, JSON.stringify(freshData), CONFIG.CACHE_TTL);
  } catch (e) {
    console.error("Cache saving exception:", e);
  }
  return freshData;
}

/**
 * Loops sheets and aggregates job applications.
 */
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
    
    const colIndices = { timestamp: 0, jobRole: 1, clientName: 2, url: 3 };
    if (hasHeader) {
      const tIdx = firstRow.findIndex(h => h.toString().toLowerCase().includes("date"));
      const rIdx = firstRow.findIndex(h => h.toString().toLowerCase().includes("role"));
      const cIdx = firstRow.findIndex(h => h.toString().toLowerCase().includes("client"));
      const uIdx = firstRow.findIndex(h => h.toString().toLowerCase().includes("url"));
      if (tIdx !== -1) colIndices.timestamp = tIdx;
      if (rIdx !== -1) colIndices.jobRole = rIdx;
      if (cIdx !== -1) colIndices.clientName = cIdx;
      if (uIdx !== -1) colIndices.url = uIdx;
    }
    
    const startRow = hasHeader ? 1 : 0;
    for (let r = startRow; r < data.length; r++) {
      const row = data[r];
      const jobRole = (row[colIndices.jobRole] || "").toString().trim();
      const clientName = (row[colIndices.clientName] || "").toString().trim();
      const rawUrl = (row[colIndices.url] || "").toString().trim();
      
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

      // Convert Date object to string or numeric timestamp to save safely in Cache JSON
      const timestampTime = row[colIndices.timestamp] ? new Date(row[colIndices.timestamp]).getTime() : new Date().getTime();

      allApplications.push({
        employeeName: employeeName,
        timestamp: timestampTime,
        jobRole: jobRole,
        clientName: clientName,
        url: rawUrl
      });
    }
  }

  // Deduplicate entries by URL and keep the latest details
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
      }
    }
  }

  // Compile final clean list for caching
  for (let k = 0; k < uniqueApplications.length; k++) {
    const app = uniqueApplications[k];
    const urlKey = app.url.toLowerCase();
    app.claimedBy = urlClaims[urlKey] ? urlClaims[urlKey].join(", ") : app.employeeName;
  }

  // Sort descending by timestamp
  uniqueApplications.sort((a, b) => b.timestamp - a.timestamp);
  
  return uniqueApplications;
}

/**
 * Invalidates the Apps Script memory cache key.
 */
function clearApplicationsCache() {
  const cache = CacheService.getScriptCache();
  cache.remove(CONFIG.CACHE_KEY_APPS);
}

/**
 * Custom function triggered manually to clear cache and rebuild the sheet dashboard.
 */
function forceRebuildCache() {
  clearApplicationsCache();
  
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  
  // Recompile fresh data
  getApplicationsData(true);
  
  refreshHomeTab(ss);
  
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast("Spreadsheet cache successfully cleared and rebuilt!", "Rebuild Done");
  } catch (e) {
    console.log("Rebuild finished successfully.");
  }
}

/**
 * Re-applies premium theme formatting across all employee tabs.
 */
function runInitialSetupAndFormatting() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const name = sheets[i].getName();
    if (name !== "Home" && name !== "Dashboard") {
      formatSheetTheme(sheets[i]);
    }
  }
  refreshHomeTab(ss);
  
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast("Premium Theme Formatting successfully applied!", "Theme Formatting Done");
  } catch (e) {
    console.log("Theme formatting applied successfully.");
  }
}

/**
 * Checks POST parameter payload validity.
 */
function validatePostPayload(data) {
  if (!data.jobRole || data.jobRole.toString().trim() === "") return "Missing required parameter: jobRole";
  if (!data.clientName || data.clientName.toString().trim() === "") return "Missing required parameter: clientName";
  if (!data.applicationUrl || data.applicationUrl.toString().trim() === "") return "Missing required parameter: applicationUrl";
  return null;
}

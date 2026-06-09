/**
 * Main.gs
 * Application entry points, custom menus, edit listeners, and initialization functions.
 */

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
 * Formats individual employee sheet tabs with design themes and custom column widths.
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
  
  // Recompile fresh data
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

/**
 * Test function for Main.gs.
 */
function testMain() {
  Logger.log("--- Testing Main.gs ---");
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    assert(ss !== null, "Unable to load active spreadsheet instance");
    Logger.log("✓ Main checks passed.");
  } catch (e) {
    Logger.log("Main check skipped (not in active Google Sheet execution container): " + e.toString());
  }
}

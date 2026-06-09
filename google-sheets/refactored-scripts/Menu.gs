/**
 * Menu.gs
 * Manages custom spreadsheet panels and run triggers.
 */

/**
 * Triggered automatically when spreadsheet is opened.
 */
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
    console.warn("UI menu setup bypassed (likely web application execution context):", e);
  }
}

/**
 * Resets search inputs and filter cells back to default.
 */
function clearDashboardFilters() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const home = ss.getSheetByName("Home");
  if (!home) return;
  
  home.getRange("B6").setValue(""); // Search
  home.getRange("D6").setValue("All Roles");
  home.getRange("F6").setValue("All Employees");
  home.getRange("H6").setValue("All Time");
  
  refreshHomeTab(ss);
  ss.toast("Filters successfully cleared!", "Reset Done");
}

/**
 * Re-creates the Home tab layout and metrics.
 */
function resetDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const home = ss.getSheetByName("Home");
  if (home) {
    ss.deleteSheet(home);
  }
  
  // Re-run setup
  runInitialSetupAndFormatting();
  ss.toast("Dashboard layout rebuilt successfully!", "Reset Done");
}

/**
 * Test function.
 */
function testMenu() {
  Logger.log("Menu service check completed.");
}

/**
 * Triggered automatically on spreadsheet edit.
 */
function onEdit(e) {
  if (!e) return;
  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== "Home") return;

  const row = range.getRow();
  const col = range.getColumn();
  const value = e.value;
  const ss = getActiveSpreadsheet();

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
        applyUrl
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

/**
 * Re-reads database, applies filters, and writes back application rows to the Home Sheet.
 */
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
    dateRange: (home.getRange("H6").getValue() || "All Time").toString()
  };

  const lastRow = home.getLastRow();
  if (lastRow >= 9) {
    home.getRange(9, 1, lastRow - 8, 9)
      .clearDataValidations()
      .clearContent()
      .clearFormat()
      .setBackground(null);
  }

  const filteredApps = FilterService.applyFilters(uniqueApplications, filters);
  DashboardService.renderTable(home, filteredApps, employees);
}

/**
 * Re-applies formatting across all employee tabs.
 */
function runInitialSetupAndFormatting() {
  const ss = getActiveSpreadsheet();
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const name = sheets[i].getName();
    if (name !== "Home" && name !== "Dashboard") {
      EmployeeService.formatSheet(sheets[i]);
    }
  }
  refreshHomeTab(ss);
}


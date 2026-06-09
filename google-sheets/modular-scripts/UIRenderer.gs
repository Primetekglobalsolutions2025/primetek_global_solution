/**
 * UIRenderer.gs
 * Builds, formats, and renders the visual dashboard on the Home sheet.
 */

/**
 * Creates or resets the Home sheet structure.
 * @param {Sheet} home The Home sheet object.
 * @param {Array<string>} employees List of employee sheet names.
 */
function setupHomeLayout(home, employees) {
  home.setHiddenGridlines(true);
  
  // Reset column sizing
  home.setColumnWidth(1, 50);  // S.No
  home.setColumnWidth(2, 120); // Date
  home.setColumnWidth(3, 180); // Job Role
  home.setColumnWidth(4, 180); // Client Name
  home.setColumnWidth(5, 200); // Application URL
  home.setColumnWidth(6, 120); // Action (Apply Link)
  home.setColumnWidth(7, 180); // Claimed By
  home.setColumnWidth(8, 150); // Claim Job Action

  // 1. Dashboard Gradient Header (Row 1-2)
  home.getRange("A1:H2").merge()
    .setValue("⚡ Primetek Global Solutions Dashboard")
    .setBackground(CONFIG.THEME.primaryDark)
    .setFontColor(CONFIG.THEME.surface)
    .setFontWeight("bold")
    .setFontFamily(CONFIG.THEME.font)
    .setFontSize(16)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  
  // 2. Build metrics cards and filter controls
  setupKPICards(home);
  setupFilterControls(home, employees);
}

/**
 * Renders the high-level KPI cards with Sheets formulas.
 * @param {Sheet} sheet Target sheet.
 */
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
  kpiVal("C5:D5", '=IF(COUNTA(D9:D)=0, 0, COUNTUNIQUE(D9:D))', "#065F46"); // Emerald
  kpiVal("E5:F5", '=IF(COUNTA(C9:C)=0, 0, COUNTUNIQUE(C9:C))', CONFIG.THEME.textMain);
  kpiVal("G5:H5", '=IF(COUNTA(B9:B)=0, 0, COUNTIF(B9:B, TEXT(TODAY(),"dd-mmm")))', "#B45309"); // Amber
}

/**
 * Creates filter text-inputs and validation dropdown rules.
 * @param {Sheet} sheet Target sheet.
 * @param {Array<string>} employees List of employees.
 */
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

  // Text search input
  inputStyle(sheet.getRange("B6"));
  if (sheet.getRange("B6").getValue() === "") {
    sheet.getRange("B6").setValue("");
  }

  // Job Role filter dropdown
  const roleCell = sheet.getRange("D6");
  inputStyle(roleCell);
  const roles = ["All Roles"].concat(CONFIG.DEFAULT_ROLES);
  roleCell.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(roles, false).build());
  if (!roleCell.getValue()) roleCell.setValue("All Roles");

  // Employee filter dropdown
  const submitterCell = sheet.getRange("F6");
  inputStyle(submitterCell);
  const submitterList = ["All Employees"].concat(employees.slice(1));
  submitterCell.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(submitterList, false).build());
  if (!submitterCell.getValue()) submitterCell.setValue("All Employees");

  // Date range filter dropdown
  const dateCell = sheet.getRange("H6");
  inputStyle(dateCell);
  const dates = ["All Time", "Today", "Past 7 Days", "Past 30 Days"];
  dateCell.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(dates, false).build());
  if (!dateCell.getValue()) dateCell.setValue("All Time");

  sheet.setRowHeight(6, 36);

  // Table Headers (Row 8)
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

/**
 * Writes the filtered list of applications onto the dashboard sheet.
 * @param {Sheet} sheet Target dashboard.
 * @param {Array<Object>} applications Filtered applications list.
 * @param {Array<string>} employees List of employees.
 */
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

  // Format Date Column
  sheet.getRange(9, 2, applications.length, 1).setNumberFormat("dd-mmm");

  // Setup dropdown values for the claim cell
  const claimDropdownList = ["Claim Job ➕"].concat(employees.slice(1));
  const empRule = SpreadsheetApp.newDataValidation().requireValueInList(claimDropdownList, false).build();
  
  for (let r = 0; r < applications.length; r++) {
    const currentRowNum = 9 + r;
    sheet.setRowHeight(currentRowNum, 32);
    
    // Zebra striping backgrounds
    const rowRange = sheet.getRange(currentRowNum, 1, 1, 8);
    rowRange.setBackground(currentRowNum % 2 === 0 ? CONFIG.THEME.rowAlt : CONFIG.THEME.surface);
    
    sheet.getRange(currentRowNum, 3).setFontWeight("bold").setHorizontalAlignment("left"); // Role
    sheet.getRange(currentRowNum, 4).setFontColor(CONFIG.THEME.textMuted).setHorizontalAlignment("left"); // Company Name
    sheet.getRange(currentRowNum, 5).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setFontColor(CONFIG.THEME.primary); // Link
    sheet.getRange(currentRowNum, 6).setFontWeight("bold").setFontColor(CONFIG.THEME.primary); // Action Link
    sheet.getRange(currentRowNum, 7).setBackground("#ECFDF5").setFontColor("#047857").setFontWeight("bold"); // Claimed By
    sheet.getRange(currentRowNum, 8).setDataValidation(empRule).setBackground(CONFIG.THEME.surface).setFontWeight("bold"); // Dropdown
  }

  // Setup auto-filtering on headers
  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }
  sheet.getRange(8, 1, applications.length + 1, 8).createFilter();
}

/**
 * Stylizes a status cell with status-specific background and font colors.
 * @param {Range} cell Range containing a status value.
 * @param {string} status Status value.
 */
function applyStatusBadge(cell, status) {
  if (!cell || !status) return;
  const normalized = status.toUpperCase().trim();
  const badge = CONFIG.STATUS[normalized] || CONFIG.STATUS.NEW;
  
  cell.setBackground(badge.bg)
    .setFontColor(badge.text)
    .setFontWeight("bold")
    .setHorizontalAlignment("center");
}

/**
 * Test function for UIRenderer.gs.
 */
function testUIRenderer() {
  Logger.log("--- Testing UIRenderer.gs ---");
  // Basic validation checks on theme metrics
  assert(CONFIG.THEME.primary !== null, "Primary color missing in config");
  assert(CONFIG.THEME.font !== null, "Font configuration missing in config");
  Logger.log("✓ UIRenderer checks completed.");
}

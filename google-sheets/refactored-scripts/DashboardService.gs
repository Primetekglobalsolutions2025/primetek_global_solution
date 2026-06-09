/**
 * DashboardService.gs
 * Designs, formats, and renders the central Home Dashboard tab.
 */

const DashboardService = {
  /**
   * Initializes and formats the dashboard sheet.
   * @param {Sheet} home The dashboard sheet tab.
   * @param {Array<string>} employees List of employees.
   */
  setupLayout(home, employees, dynamicRoles) {
    if (!home) return;
    
    home.setHiddenGridlines(true);
    
    // Set column dimensions for the 9 columns (A to I)
    home.setColumnWidth(1, 50);  // A: S.No
    home.setColumnWidth(2, 100); // B: Status badge
    home.setColumnWidth(3, 120); // C: Date/Month
    home.setColumnWidth(4, 180); // D: Job Role
    home.setColumnWidth(5, 180); // E: Client Name
    home.setColumnWidth(6, 200); // F: Application URL
    home.setColumnWidth(7, 100); // G: Action (Apply link)
    home.setColumnWidth(8, 150); // H: Claimed By
    home.setColumnWidth(9, 150); // I: Claim Action

    // 1. Dashboard Gradient Header (Row 1-2)
    home.getRange("A1:I2").merge()
      .setValue("⚡ PRIMETEK JOB TRACKER PANEL")
      .setBackground(CONFIG.THEME.primaryDark)
      .setFontColor(CONFIG.THEME.surface)
      .setFontWeight("bold")
      .setFontFamily(CONFIG.THEME.font)
      .setFontSize(16)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");

    // 2. Build 8 KPI Cards (Row 4-5)
    this.setupKPICards(home);

    // 3. Build Filter Controls Bar (Row 6)
    this.setupFilters(home, employees, dynamicRoles);
  },

  /**
   * Draws the 8 KPI metrics cards.
   * @param {Sheet} sheet Target sheet.
   */
  setupKPICards(sheet) {
    const labels = [
      ["A4", "📊 Total Jobs"],
      ["B4", "🏢 Active Clients"],
      ["C4", "💼 Unique Roles"],
      ["D4", "📅 Added Today"],
      ["E4", "🟡 Applied"],
      ["F4", "🔵 Interview"],
      ["G4", "🟣 Offer"],
      ["H4", "✅ Acceptance Rate"]
    ];

    labels.forEach(([cell, text]) => {
      sheet.getRange(cell).setValue(text)
        .setBackground(CONFIG.THEME.headerBg)
        .setFontColor(CONFIG.THEME.textMuted)
        .setFontSize(8)
        .setFontFamily(CONFIG.THEME.font)
        .setHorizontalAlignment("center")
        .setVerticalAlignment("middle");
    });

    const kpiVal = (cell, formula, color) => {
      sheet.getRange(cell).setFormula(formula)
        .setFontSize(14)
        .setFontWeight("bold")
        .setFontFamily(CONFIG.THEME.font)
        .setHorizontalAlignment("center")
        .setVerticalAlignment("middle")
        .setFontColor(color)
        .setBackground(CONFIG.THEME.surface);
    };

    kpiVal("A5", '=IF(COUNTA(E9:E)=0, 0, COUNTA(E9:E))', CONFIG.THEME.primary);
    kpiVal("B5", '=IF(COUNTA(E9:E)=0, 0, COUNTUNIQUE(E9:E))', "#065F46"); // Green
    kpiVal("C5", '=IF(COUNTA(D9:D)=0, 0, COUNTUNIQUE(D9:D))', CONFIG.THEME.textMain);
    kpiVal("D5", '=IF(COUNTA(C9:C)=0, 0, COUNTIF(C9:C, TEXT(TODAY(),"dd-mmm")))', "#B45309"); // Amber
    kpiVal("E5", '=IF(COUNTA(B9:B)=0, 0, COUNTIF(B9:B, "Applied"))', "#92400E");
    kpiVal("F5", '=IF(COUNTA(B9:B)=0, 0, COUNTIF(B9:B, "Interview"))', "#1E40AF");
    kpiVal("G5", '=IF(COUNTA(B9:B)=0, 0, COUNTIF(B9:B, "Offer"))', "#5B21B6");
    kpiVal("H5", '=IF(A5=0, "0.0%", TEXT(COUNTIF(B9:B, "Accepted")/A5, "0.0%"))', "#047857");

    // Format the Acceptance Rate cell as percentage
    sheet.getRange("H5").setNumberFormat("0.0%");
  },

  /**
   * Builds filter control headers and dropdown validators in Row 6.
   * @param {Sheet} sheet Target sheet.
   * @param {Array<string>} employees Employee names.
   */
  setupFilters(sheet, employees, dynamicRoles) {
    const filterLabelStyle = (range, label) => {
      range.setValue(label)
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
      range.setBackground(CONFIG.THEME.surface)
        .setFontColor(CONFIG.THEME.textMain)
        .setFontFamily(CONFIG.THEME.font)
        .setFontSize(9)
        .setBorder(true, true, true, true, false, false, CONFIG.THEME.border, SpreadsheetApp.BorderStyle.SOLID);
    };

    inputStyle(sheet.getRange("B6")); // Search text input
    if (sheet.getRange("B6").getValue() === "") {
      sheet.getRange("B6").setValue("");
    }

    // Role filter
    const roleCell = sheet.getRange("D6");
    inputStyle(roleCell);
    const roles = dynamicRoles || ["All Roles"].concat(CONFIG.DEFAULT_ROLES);
    roleCell.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(roles, false).build());
    if (!roleCell.getValue()) roleCell.setValue("All Roles");

    // Employee filter
    const submitterCell = sheet.getRange("F6");
    inputStyle(submitterCell);
    const submitterList = ["All Employees"].concat(employees.slice(1));
    submitterCell.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(submitterList, false).build());
    if (!submitterCell.getValue()) submitterCell.setValue("All Employees");

    // Date range filter
    const dateCell = sheet.getRange("H6");
    inputStyle(dateCell);
    const dates = ["All Time", "Today", "Past 7 Days", "Past 30 Days"];
    dateCell.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(dates, false).build());
    if (!dateCell.getValue()) dateCell.setValue("All Time");

    sheet.setRowHeight(6, 36);

    // Table Header Row (Row 8)
    const headers = [["S.No", "Status", "Date/Month", "Job Role", "Client Name", "Application URL", "Action", "Claimed By", "Claim Job"]];
    sheet.getRange("A8:I8").setValues(headers)
      .setBackground(CONFIG.THEME.headerBg)
      .setFontColor(CONFIG.THEME.textMuted)
      .setFontWeight("bold")
      .setFontSize(9)
      .setFontFamily(CONFIG.THEME.font)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    sheet.setRowHeight(8, 32);
  },

  /**
   * Renders the data rows on the dashboard.
   * @param {Sheet} sheet Target dashboard.
   * @param {Array<Object>} applications Filtered applications list.
   * @param {Array<string>} employees List of active employees.
   */
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
        '=HYPERLINK(F' + (9 + j) + ', "Apply 🔗")',
        item.claimedBy,
        "Claim Job ➕"
      ]);
    }

    const outputRange = sheet.getRange(9, 1, applications.length, 9);
    outputRange.setValues(cellData)
      .setFontFamily(CONFIG.THEME.font)
      .setFontSize(10)
      .setVerticalAlignment("middle")
      .setHorizontalAlignment("center")
      .setFontColor(CONFIG.THEME.textMain);

    sheet.getRange(9, 3, applications.length, 1).setNumberFormat("dd-mmm");

    const claimDropdownList = ["Claim Job ➕"].concat(employees.slice(1));
    const empRule = SpreadsheetApp.newDataValidation().requireValueInList(claimDropdownList, false).build();

    for (let r = 0; r < applications.length; r++) {
      const currentRowNum = 9 + r;
      sheet.setRowHeight(currentRowNum, 32);

      const rowRange = sheet.getRange(currentRowNum, 1, 1, 9);
      rowRange.setBackground(currentRowNum % 2 === 0 ? CONFIG.THEME.rowAlt : CONFIG.THEME.surface);

      const statusCell = sheet.getRange(currentRowNum, 2);
      ThemeService.applyStatusBadge(statusCell, statusCell.getValue());

      sheet.getRange(currentRowNum, 4).setFontWeight("bold").setHorizontalAlignment("left"); // Role
      sheet.getRange(currentRowNum, 5).setFontColor(CONFIG.THEME.textMuted).setHorizontalAlignment("left"); // Client
      sheet.getRange(currentRowNum, 6).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setFontColor(CONFIG.THEME.primary); // URL
      sheet.getRange(currentRowNum, 7).setFontWeight("bold").setFontColor(CONFIG.THEME.primary); // Action Link
      sheet.getRange(currentRowNum, 8).setBackground("#ECFDF5").setFontColor("#047857").setFontWeight("bold"); // Claimed By
      sheet.getRange(currentRowNum, 9).setDataValidation(empRule).setBackground(CONFIG.THEME.surface).setFontWeight("bold"); // Dropdown
    }

    // Set frozen rows
    sheet.setFrozenRows(8);

    // Filter bar
    if (sheet.getFilter()) {
      sheet.getFilter().remove();
    }
    sheet.getRange(8, 1, applications.length + 1, 9).createFilter();
  }
};

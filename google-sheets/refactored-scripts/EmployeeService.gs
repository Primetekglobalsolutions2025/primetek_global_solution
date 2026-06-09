/**
 * EmployeeService.gs
 * Sets up and manages employee sheet tabs, column headers, and data validations.
 */

const EmployeeService = {
  /**
   * Registers a new employee sheet with 16 column headers and dropdown rules.
   * @param {string} employeeName Sanitized employee name.
   * @return {Sheet} Newly created sheet tab.
   */
  createSheet(employeeName) {
    const ss = getActiveSpreadsheet();
    let sheet = ss.getSheetByName(employeeName);
    
    if (!sheet) {
      sheet = ss.insertSheet(employeeName);
    }
    
    // Set 16-Column Headers
    const headers = [[
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
      "Last Updated"
    ]];
    
    sheet.getRange(1, 1, 1, 16).setValues(headers);
    this.formatSheet(sheet);
    return sheet;
  },

  /**
   * Sets themes, column widths, and validation rules for employee sheets.
   * @param {Sheet} sheet Target sheet tab.
   */
  formatSheet(sheet) {
    if (!sheet) return;
    sheet.setHiddenGridlines(false);
    
    const lastRow = sheet.getLastRow();
    const lastColumn = Math.max(16, sheet.getLastColumn());

    // 1. Header range styling
    const headerRange = sheet.getRange(1, 1, 1, lastColumn);
    headerRange.setBackground(CONFIG.THEME.primaryDark)
      .setFontColor(CONFIG.THEME.surface)
      .setFontWeight("bold")
      .setFontFamily(CONFIG.THEME.font)
      .setFontSize(10)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    sheet.setRowHeight(1, 36);

    // 2. Data formatting
    if (lastRow > 1) {
      const dataRange = sheet.getRange(2, 1, lastRow - 1, lastColumn);
      dataRange.setFontFamily(CONFIG.THEME.font)
        .setFontSize(10)
        .setVerticalAlignment("middle")
        .setFontColor(CONFIG.THEME.textMain);
        
      for (let r = 2; r <= lastRow; r++) {
        sheet.setRowHeight(r, 28);
        const rowRange = sheet.getRange(r, 1, 1, lastColumn);
        rowRange.setBackground(r % 2 === 0 ? CONFIG.THEME.rowAlt : CONFIG.THEME.surface);

        // Apply badges in status and priority cells
        const statusCell = sheet.getRange(r, CONFIG.EMPLOYEE_COLS.STATUS + 1);
        const statusVal = statusCell.getValue();
        if (statusVal) {
          ThemeService.applyStatusBadge(statusCell, statusVal);
        }

        const priorityCell = sheet.getRange(r, CONFIG.EMPLOYEE_COLS.PRIORITY + 1);
        const priorityVal = priorityCell.getValue();
        if (priorityVal) {
          ThemeService.applyPriorityBadge(priorityCell, priorityVal);
        }
      }
      
      // Date Month column formatting (dd-mmm)
      const dateIdx = CONFIG.EMPLOYEE_COLS.DATE + 1;
      sheet.getRange(2, dateIdx, lastRow - 1, 1).setNumberFormat("dd-mmm").setHorizontalAlignment("center");

      // Follow-up Date column formatting (dd-mmm)
      const followUpIdx = CONFIG.EMPLOYEE_COLS.FOLLOW_UP + 1;
      sheet.getRange(2, followUpIdx, lastRow - 1, 1).setNumberFormat("dd-mmm").setHorizontalAlignment("center");

      // Interview Date column formatting (dd-mmm)
      const interviewIdx = CONFIG.EMPLOYEE_COLS.INTERVIEW_DATE + 1;
      sheet.getRange(2, interviewIdx, lastRow - 1, 1).setNumberFormat("dd-mmm").setHorizontalAlignment("center");

      // Application URL column formatting (clip overflow)
      const urlIdx = CONFIG.EMPLOYEE_COLS.URL + 1;
      sheet.getRange(2, urlIdx, lastRow - 1, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setFontColor(CONFIG.THEME.primary);
    }

    // 3. Register input validation rules for rows (up to 500 rows to ensure future lines have rules)
    const ruleRangeEnd = Math.max(500, lastRow + 100);
    const statusValues = Object.keys(CONFIG.STATUS).map(k => CONFIG.STATUS[k].label);
    const statusRule = SpreadsheetApp.newDataValidation().requireValueInList(statusValues, false).build();
    sheet.getRange(2, CONFIG.EMPLOYEE_COLS.STATUS + 1, ruleRangeEnd, 1).setDataValidation(statusRule);

    const priorityValues = Object.keys(CONFIG.PRIORITY).map(k => CONFIG.PRIORITY[k].label);
    const priorityRule = SpreadsheetApp.newDataValidation().requireValueInList(priorityValues, false).build();
    sheet.getRange(2, CONFIG.EMPLOYEE_COLS.PRIORITY + 1, ruleRangeEnd, 1).setDataValidation(priorityRule);

    // Standard columns dimensions
    sheet.setColumnWidth(1, 100);  // Date
    sheet.setColumnWidth(2, 180);  // Role
    sheet.setColumnWidth(3, 180);  // Client
    sheet.setColumnWidth(4, 250);  // URL
    sheet.setColumnWidth(5, 120);  // Status
    sheet.setColumnWidth(6, 100);  // Priority
    sheet.setColumnWidth(7, 120);  // Stage
    sheet.setColumnWidth(8, 110);  // Follow-up Date
    sheet.setColumnWidth(9, 200);  // Notes
    sheet.setColumnWidth(10, 110); // Interview Date
    sheet.setColumnWidth(11, 120); // Salary Range
    sheet.setColumnWidth(12, 150); // Recruiter Name
    sheet.setColumnWidth(13, 180); // Recruiter Email
    sheet.setColumnWidth(14, 120); // Location
    sheet.setColumnWidth(15, 120); // Source
    sheet.setColumnWidth(16, 150); // Last Updated
  }
};

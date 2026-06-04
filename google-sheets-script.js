// --- CONFIGURATION ---
const SPREADSHEET_ID = "1im0l80fq60pqBYgMOXPQ3h0IoGOjimMWdvCDBFjWfo8";

// --- THEME CONSTANTS (Premium SaaS Look) ---
const THEME = {
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
};

function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheets = ss.getSheets();
    const allApplications = [];
    const urlClaims = {};

    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      const employeeName = sheet.getName();
      
      if (employeeName === "Home" || employeeName === "Dashboard") continue;
      
      const data = sheet.getDataRange().getValues();
      if (data.length === 0) continue;
      
      const firstRow = data[0];
      const hasHeader = (firstRow[0] && firstRow[0].toString().toLowerCase().indexOf("date") !== -1);
      
      let colIndices = { timestamp: 0, jobRole: 1, clientName: 2, url: 3 };
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
        if (!row[colIndices.jobRole] && !row[colIndices.clientName]) continue;
        
        const rawUrl = row[colIndices.url] || "";
        const urlKey = rawUrl.toString().trim().toLowerCase();
        
        if (urlKey) {
          if (!urlClaims[urlKey]) {
            urlClaims[urlKey] = [];
          }
          if (urlClaims[urlKey].indexOf(employeeName) === -1) {
            urlClaims[urlKey].push(employeeName);
          }
        }

        allApplications.push({
          employeeName: employeeName,
          timestamp: row[colIndices.timestamp] ? new Date(row[colIndices.timestamp]) : new Date(),
          jobRole: row[colIndices.jobRole] || "",
          clientName: row[colIndices.clientName] || "",
          url: rawUrl
        });
      }
    }

    // Deduplicate and group by URL
    const uniqueApplications = [];
    const seenUrls = {};
    for (let k = 0; k < allApplications.length; k++) {
      const app = allApplications[k];
      const urlKey = app.url.toString().trim().toLowerCase();
      if (!urlKey) {
        uniqueApplications.push(app);
        continue;
      }
      if (!seenUrls[urlKey]) {
        seenUrls[urlKey] = app;
        uniqueApplications.push(app);
      } else {
        // Keep the latest timestamp application details
        if (app.timestamp > seenUrls[urlKey].timestamp) {
          seenUrls[urlKey].timestamp = app.timestamp;
          seenUrls[urlKey].employeeName = app.employeeName;
          seenUrls[urlKey].jobRole = app.jobRole;
          seenUrls[urlKey].clientName = app.clientName;
        }
      }
    }

    // Map claimedBy lookup text
    for (let k = 0; k < uniqueApplications.length; k++) {
      const app = uniqueApplications[k];
      const urlKey = app.url.toString().trim().toLowerCase();
      app.claimedBy = urlClaims[urlKey] ? urlClaims[urlKey].join(", ") : app.employeeName;
    }

    // Sort unique applications descending by timestamp
    uniqueApplications.sort((a, b) => b.timestamp - a.timestamp);

    return ContentService.createTextOutput(JSON.stringify({ success: true, data: uniqueApplications }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    let employeeName = data.employeeName || "General";
    
    if (employeeName === "Home" || employeeName === "Dashboard") {
      employeeName = "General";
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(employeeName);
    
    if (!sheet) {
      sheet = ss.insertSheet(employeeName);
      sheet.appendRow(["Date/Month", "Job Role", "Client Name", "Application URL"]);
    }
    
    sheet.appendRow([
      new Date(),
      data.jobRole || "",
      data.clientName || "",
      data.applicationUrl || ""
    ]);

    formatSheetTheme(sheet);
    refreshHomeTab(ss);
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function formatSheetTheme(sheet) {
  if (!sheet) return;
  sheet.setHiddenGridlines(false); // Gridlines visible on employee sheets
  
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow === 0 || lastColumn === 0) return;

  // Premium Header Row
  const headerRange = sheet.getRange(1, 1, 1, lastColumn);
  headerRange.setBackground(THEME.primaryDark)
    .setFontColor(THEME.surface)
    .setFontWeight("bold")
    .setFontFamily(THEME.font)
    .setFontSize(10)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 36);

  // Format Data Rows
  if (lastRow > 1) {
    const dataRange = sheet.getRange(2, 1, lastRow - 1, lastColumn);
    dataRange.setFontFamily(THEME.font)
      .setFontSize(10)
      .setVerticalAlignment("middle")
      .setFontColor(THEME.textMain);
      
    for (let r = 2; r <= lastRow; r++) {
      const rowRange = sheet.getRange(r, 1, 1, lastColumn);
      rowRange.setBackground(r % 2 === 0 ? THEME.rowAlt : THEME.surface);
      sheet.setRowHeight(r, 28);
    }
    
    // Date/Month column formatting (dd-mmm)
    const timeRange = sheet.getRange(2, 1, lastRow - 1, 1);
    timeRange.setNumberFormat("dd-mmm").setHorizontalAlignment("center");
    
    const urlRange = sheet.getRange(2, 4, lastRow - 1, 1);
    urlRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setFontColor(THEME.primary);
  }

  sheet.setColumnWidth(1, 120); // Date/Month
  sheet.setColumnWidth(2, 180); // Job Role
  sheet.setColumnWidth(3, 180); // Client Name
  sheet.setColumnWidth(4, 300); // Application URL
}

function onEdit(e) {
  if (!e) return;
  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== "Home") return;
  
  const row = range.getRow();
  const col = range.getColumn();
  const value = e.value;
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. If filters in Row 6 are edited, refresh grid
  if (row === 6 && (col === 2 || col === 4 || col === 6 || col === 8)) {
    refreshHomeTab(ss);
    return;
  }

  // 2. Claim Logic (Row 9 onwards, Col H is Column 8)
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

      // Reset Claim dropdown cell immediately
      range.setValue("Claim Job ➕");
      
      // Update dashboard
      refreshHomeTab(ss);
      
      ss.toast(`🎉 Successfully claimed by ${claimEmployee}!`, "Success");
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
  
  const sheets = ss.getSheets();
  const employees = ["Select Employee"];
  const allApplications = [];
  const urlClaims = {};

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    const name = sheet.getName();
    if (name === "Home" || name === "Dashboard") continue;
    
    employees.push(name);
    const data = sheet.getDataRange().getValues();
    
    if (data.length > 0) {
      const firstRow = data[0];
      const hasHeader = (firstRow[0] && firstRow[0].toString().toLowerCase().indexOf("date") !== -1);
      
      let colIndices = { timestamp: 0, jobRole: 1, clientName: 2, url: 3 };
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
        if (!row[colIndices.jobRole] && !row[colIndices.clientName]) continue;
        
        const rawUrl = row[colIndices.url] || "";
        const urlKey = rawUrl.toString().trim().toLowerCase();
        
        if (urlKey) {
          if (!urlClaims[urlKey]) {
            urlClaims[urlKey] = [];
          }
          if (urlClaims[urlKey].indexOf(name) === -1) {
            urlClaims[urlKey].push(name);
          }
        }

        allApplications.push({
          employeeName: name,
          timestamp: row[colIndices.timestamp] ? new Date(row[colIndices.timestamp]) : new Date(),
          jobRole: row[colIndices.jobRole] || "",
          clientName: row[colIndices.clientName] || "",
          url: rawUrl
        });
      }
    }
  }

  // Deduplicate and group by URL
  const uniqueApplications = [];
  const seenUrls = {};
  for (let k = 0; k < allApplications.length; k++) {
    const app = allApplications[k];
    const urlKey = app.url.toString().trim().toLowerCase();
    if (!urlKey) {
      uniqueApplications.push(app);
      continue;
    }
    if (!seenUrls[urlKey]) {
      seenUrls[urlKey] = app;
      uniqueApplications.push(app);
    } else {
      // Keep the latest timestamp application details
      if (app.timestamp > seenUrls[urlKey].timestamp) {
        seenUrls[urlKey].timestamp = app.timestamp;
        seenUrls[urlKey].employeeName = app.employeeName;
        seenUrls[urlKey].jobRole = app.jobRole;
        seenUrls[urlKey].clientName = app.clientName;
      }
    }
  }

  // Map claimedBy lookup text
  for (let k = 0; k < uniqueApplications.length; k++) {
    const app = uniqueApplications[k];
    const urlKey = app.url.toString().trim().toLowerCase();
    app.claimedBy = urlClaims[urlKey] ? urlClaims[urlKey].join(", ") : app.employeeName;
  }

  // Sort unique applications descending by timestamp
  uniqueApplications.sort((a, b) => b.timestamp - a.timestamp);

  setupHomeLayout(home, employees, ss);

  const filterSearch = (home.getRange("B6").getValue() || "").toString().toLowerCase().trim();
  const filterRole = (home.getRange("D6").getValue() || "All Roles").toString().toLowerCase().trim();
  const filterSubmitter = (home.getRange("F6").getValue() || "All Employees").toString().trim();
  const filterDate = (home.getRange("H6").getValue() || "All Time").toString().trim();

  const lastRow = home.getLastRow();
  if (lastRow >= 9) {
    home.getRange(9, 1, lastRow - 8, 8).clearDataValidations().clearContent().clearFormat().setBackground(null);
  }

  const filteredApps = [];
  const now = new Date();
  
  for (let k = 0; k < uniqueApplications.length; k++) {
    const app = uniqueApplications[k];
    if (filterSubmitter !== "All Employees" && app.claimedBy.indexOf(filterSubmitter) === -1) continue;
    
    if (filterSearch !== "") {
      const matchText = (app.jobRole + " " + app.clientName + " " + app.claimedBy).toLowerCase();
      if (matchText.indexOf(filterSearch) === -1) continue;
    }
    
    if (filterRole !== "all roles" && app.jobRole.toLowerCase().indexOf(filterRole) === -1) continue;
    
    if (filterDate !== "All Time" && app.timestamp) {
      const appDate = new Date(app.timestamp);
      const diffDays = Math.ceil(Math.abs(now - appDate) / (1000 * 60 * 60 * 24));
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
      .setFontFamily(THEME.font)
      .setFontSize(10)
      .setVerticalAlignment("middle")
      .setHorizontalAlignment("center")
      .setFontColor(THEME.textMain);

    // Apply number format to Date column (Col B)
    home.getRange(9, 2, filteredApps.length, 1).setNumberFormat("dd-mmm");

    // Build the dropdown validation including active employees + "Claim Job ➕" placeholder
    const claimDropdownList = ["Claim Job ➕"].concat(employees.slice(1));
    const empRule = SpreadsheetApp.newDataValidation().requireValueInList(claimDropdownList, false).build();
    
    for (let r = 0; r < filteredApps.length; r++) {
      const currentRowNum = 9 + r;
      home.setRowHeight(currentRowNum, 32);
      
      const rowRange = home.getRange(currentRowNum, 1, 1, 8);
      rowRange.setBackground(currentRowNum % 2 === 0 ? THEME.rowAlt : THEME.surface);
      
      home.getRange(currentRowNum, 3).setFontWeight("bold").setHorizontalAlignment("left"); // Job Role
      home.getRange(currentRowNum, 4).setFontColor(THEME.textMuted).setHorizontalAlignment("left"); // Client Name
      home.getRange(currentRowNum, 5).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setFontColor(THEME.primary); // Application URL
      
      // Action hyperlink style
      home.getRange(currentRowNum, 6).setFontWeight("bold").setFontColor(THEME.primary);
      
      // Claimed By list styling
      home.getRange(currentRowNum, 7).setBackground("#ECFDF5").setFontColor("#047857").setFontWeight("bold");

      // Claim Job dropdown
      home.getRange(currentRowNum, 8).setDataValidation(empRule).setBackground(THEME.surface).setFontWeight("bold");
    }

    // Set filter on table headers (Row 8) downwards
    if (home.getFilter()) {
      home.getFilter().remove();
    }
    home.getRange(8, 1, filteredApps.length + 1, 8).createFilter();
  }
}

function setupHomeLayout(home, employees, ss) {
  home.setHiddenGridlines(true);
  home.setColumnWidth(1, 50);  // S.No
  home.setColumnWidth(2, 120); // Date
  home.setColumnWidth(3, 180); // Job Role
  home.setColumnWidth(4, 180); // Client Name
  home.setColumnWidth(5, 200); // Application URL
  home.setColumnWidth(6, 120); // Action (Apply Link)
  home.setColumnWidth(7, 180); // Claimed By
  home.setColumnWidth(8, 150); // Claim Job

  // 1. Premium Title Bar
  home.getRange("A1:H2").merge()
    .setValue("⚡ Primetek Global Solutions Dashboard")
    .setBackground(THEME.primaryDark)
    .setFontColor(THEME.surface)
    .setFontWeight("bold")
    .setFontFamily(THEME.font)
    .setFontSize(16)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  
  // 2. KPI Dashboard Cards (Row 4) using Native Formulas
  home.getRange("A4:B4").merge().setValue("📊 Total Leads").setBackground(THEME.headerBg).setFontColor(THEME.textMuted).setFontSize(9).setHorizontalAlignment("center");
  home.getRange("C4:D4").merge().setValue("🏢 Active Clients").setBackground(THEME.headerBg).setFontColor(THEME.textMuted).setFontSize(9).setHorizontalAlignment("center");
  home.getRange("E4:F4").merge().setValue("💼 Unique Roles").setBackground(THEME.headerBg).setFontColor(THEME.textMuted).setFontSize(9).setHorizontalAlignment("center");
  home.getRange("G4:H4").merge().setValue("📅 Added Today").setBackground(THEME.headerBg).setFontColor(THEME.textMuted).setFontSize(9).setHorizontalAlignment("center");
  
  // Formulas for KPIs
  home.getRange("A5:B5").merge().setFormula('=IF(COUNTA(E9:E)=0, 0, COUNTA(E9:E))').setFontSize(18).setFontWeight("bold").setHorizontalAlignment("center").setFontColor(THEME.primary);
  home.getRange("C5:D5").merge().setFormula('=IF(COUNTA(D9:D)=0, 0, COUNTUNIQUE(D9:D))').setFontSize(18).setFontWeight("bold").setHorizontalAlignment("center").setFontColor(THEME.successText);
  home.getRange("E5:F5").merge().setFormula('=IF(COUNTA(C9:C)=0, 0, COUNTUNIQUE(C9:C))').setFontSize(18).setFontWeight("bold").setHorizontalAlignment("center").setFontColor(THEME.textMain);
  home.getRange("G5:H5").merge().setFormula('=IF(COUNTA(B9:B)=0, 0, COUNTIF(B9:B, TEXT(TODAY(),"dd-mmm")))').setFontSize(18).setFontWeight("bold").setHorizontalAlignment("center").setFontColor("#B45309"); // Amber
  
  // 3. Filter Control Panel (Row 6)
  const filterStyle = (range, label) => {
    range.setValue(label).setFontFamily(THEME.font).setFontSize(9).setFontColor(THEME.textMuted).setFontWeight("bold").setHorizontalAlignment("right").setVerticalAlignment("middle");
  };
  
  filterStyle(home.getRange("A6"), "🔍 Search:");
  filterStyle(home.getRange("C6"), "💼 Role:");
  filterStyle(home.getRange("E6"), "👤 Submitter:");
  filterStyle(home.getRange("G6"), "📅 Date:");

  const inputStyle = (range) => {
    range.setBackground(THEME.surface).setFontColor(THEME.textMain).setBorder(true, true, true, true, false, false, THEME.border, SpreadsheetApp.BorderStyle.SOLID);
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

  // 4. Table Headers (Row 8)
  const headers = [["S.No", "Date/Month", "Job Role", "Client Name", "Application URL", "Action", "Claimed By", "Claim Job"]];
  home.getRange("A8:H8").setValues(headers)
    .setBackground(THEME.headerBg)
    .setFontColor(THEME.textMuted)
    .setFontWeight("bold")
    .setFontSize(9)
    .setFontFamily(THEME.font)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  home.setRowHeight(8, 32);
}

function runInitialSetupAndFormatting() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const name = sheets[i].getName();
    if (name === "Home" || name === "Dashboard") continue;
    formatSheetTheme(sheets[i]);
  }
  refreshHomeTab(ss);
  SpreadsheetApp.getActiveSpreadsheet().toast("Premium Dashboard Initialized!", "Success");
}

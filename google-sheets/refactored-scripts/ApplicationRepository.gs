/**
 * ApplicationRepository.gs
 * Repository layer handling sheet data accesses, parsing, updates, and deletes.
 */

const ApplicationRepository = {
  /**
   * Scans all sheet tabs (except Home and Dashboard) and consolidates application records.
   * Deduplicates applications by URL and aggregates claimer names.
   * @return {Array<Object>} Consolidation list.
   */
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
      if (data.length <= 1) continue; // Headers only
      
      const firstRow = data[0];
      const indices = parseColumnIndices(firstRow);
      
      for (let r = 1; r < data.length; r++) {
        const row = data[r];
        const jobRole = (row[indices.role] || "").toString().trim();
        const clientName = (row[indices.client] || "").toString().trim();
        const rawUrl = (row[indices.url] || "").toString().trim();
        const status = (row[indices.status] || "New").toString().trim();
        const priority = (row[indices.priority] || "Medium").toString().trim();
        
        if (!jobRole && !clientName) continue; // Empty row
        
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
          notes: indices.notes !== -1 ? (row[indices.notes] || "").toString().trim() : "",
          interviewDate: indices.interviewDate !== -1 && row[indices.interviewDate] ? new Date(row[indices.interviewDate]).getTime() : "",
          salaryRange: indices.salaryRange !== -1 ? (row[indices.salaryRange] || "").toString().trim() : "",
          recruiterName: indices.recruiterName !== -1 ? (row[indices.recruiterName] || "").toString().trim() : "",
          recruiterEmail: indices.recruiterEmail !== -1 ? (row[indices.recruiterEmail] || "").toString().trim() : "",
          location: indices.location !== -1 ? (row[indices.location] || "").toString().trim() : "",
          source: indices.source !== -1 ? (row[indices.source] || "").toString().trim() : ""
        });
      }
    }

    // Deduplicate entries by URL, keeping the latest details
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

    // Assign joint claimedBy string representation
    for (let k = 0; k < uniqueApplications.length; k++) {
      const app = uniqueApplications[k];
      const urlKey = app.url.toLowerCase();
      app.claimedBy = urlClaims[urlKey] ? urlClaims[urlKey].join(", ") : app.employeeName;
    }

    uniqueApplications.sort((a, b) => b.timestamp - a.timestamp);
    return uniqueApplications;
  },

  /**
   * Appends a new application record directly onto an employee sheet.
   * @param {string} employeeName Submitter employee.
   * @param {Object} record Inputs payload.
   */
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
      new Date().toISOString() // Last Updated
    ]);
    
    EmployeeService.formatSheet(sheet);
  }
};

/**
 * FilterService.gs
 * Manages search keywords, status types, employee claims, and date range filtering.
 */

/**
 * Filters applications list using a multiple criteria lookup.
 * @param {Array<Object>} applications Original applications array.
 * @param {Object} filters Dictionary containing filter values.
 * @return {Array<Object>} Filtered applications.
 */
function applyFilters(applications, filters) {
  if (!applications || applications.length === 0) return [];
  if (!filters) return applications;

  let filtered = applications;

  // 1. Text Search Filter
  if (filters.search && filters.search.trim() !== "") {
    filtered = filterBySearch(filtered, filters.search);
  }

  // 2. Role Filter
  if (filters.role && filters.role !== "All Roles") {
    filtered = filtered.filter(app => 
      app.jobRole && app.jobRole.toLowerCase().includes(filters.role.toLowerCase())
    );
  }

  // 3. Status Filter
  if (filters.status && filters.status !== "All Statuses") {
    filtered = filterByStatus(filtered, filters.status);
  }

  // 4. Submitter / Employee Filter
  if (filters.employee && filters.employee !== "All Employees") {
    filtered = filtered.filter(app => 
      app.claimedBy && app.claimedBy.includes(filters.employee)
    );
  }

  // 5. Date Range Preset Filter
  if (filters.dateRange && filters.dateRange !== "All Time") {
    filtered = filterByDateRange(filtered, filters.dateRange);
  }

  return filtered;
}

/**
 * Filters applications matching keyword search.
 * @param {Array<Object>} apps Input items.
 * @param {string} searchTerm Query word.
 * @return {Array<Object>} Matches.
 */
function filterBySearch(apps, searchTerm) {
  const query = searchTerm.toLowerCase().trim();
  return apps.filter(app => {
    const jobMatch = app.jobRole && app.jobRole.toLowerCase().includes(query);
    const clientMatch = app.clientName && app.clientName.toLowerCase().includes(query);
    const ownerMatch = app.claimedBy && app.claimedBy.toLowerCase().includes(query);
    return jobMatch || clientMatch || ownerMatch;
  });
}

/**
 * Filters applications matching a specific Status type.
 * @param {Array<Object>} apps Input items.
 * @param {string} status Status string value.
 * @return {Array<Object>} Matches.
 */
function filterByStatus(apps, status) {
  const target = status.trim().toLowerCase();
  return apps.filter(app => 
    app.status && app.status.trim().toLowerCase() === target
  );
}

/**
 * Filters items using date preset ranges.
 * @param {Array<Object>} apps Input items.
 * @param {string} range Preset date range (Today, Past 7 Days, Past 30 Days).
 * @return {Array<Object>} Matches.
 */
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

/**
 * Test function for FilterService.gs.
 */
function testFilterService() {
  Logger.log("--- Testing FilterService.gs ---");
  
  const mockApps = [
    { jobRole: "Software Engineer", clientName: "Google", claimedBy: "John", timestamp: new Date().getTime(), status: "New" },
    { jobRole: "Data Analyst", clientName: "Meta", claimedBy: "Alice", timestamp: new Date().getTime() - (10 * 24 * 60 * 60 * 1000), status: "Interview" }
  ];
  
  // Test search filter
  const searchResults = filterBySearch(mockApps, "Google");
  assert(searchResults.length === 1, "Keyword filter failed");
  
  // Test status filter
  const statusResults = filterByStatus(mockApps, "Interview");
  assert(statusResults.length === 1, "Status filter failed");
  
  // Test date range filter
  const dateResults = filterByDateRange(mockApps, "Today");
  assert(dateResults.length === 1, "Date filter failed");
  
  Logger.log("✓ FilterService test passed successfully.");
}

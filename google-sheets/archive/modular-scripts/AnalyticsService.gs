/**
 * AnalyticsService.gs
 * Performs aggregations and metrics calculations for the dashboard cards.
 */

/**
 * Calculates high-level KPIs based on the unique applications.
 * @param {Array<Object>} applications Deduplicated applications list.
 * @return {Object} KPIs dictionary mapping key metric labels to counts.
 */
function calculateKPIs(applications) {
  if (!applications) return { totalLeads: 0, activeClients: 0, uniqueRoles: 0, addedToday: 0 };
  
  const now = new Date();
  const todayStr = now.toDateString();
  const clients = {};
  const roles = {};
  let addedToday = 0;
  
  applications.forEach(app => {
    if (app.clientName) clients[app.clientName.toLowerCase()] = true;
    if (app.jobRole) roles[app.jobRole.toLowerCase()] = true;
    if (app.timestamp) {
      const appDate = new Date(app.timestamp);
      if (appDate.toDateString() === todayStr) {
        addedToday++;
      }
    }
  });

  return {
    totalLeads: applications.length,
    activeClients: Object.keys(clients).length,
    uniqueRoles: Object.keys(roles).length,
    addedToday: addedToday
  };
}

/**
 * Evaluates success rate of hires (e.g. status === "Accepted" or "Offer").
 * @param {Array<Object>} applications Full applications list.
 * @return {number} Percentage success rate.
 */
function getSuccessRate(applications) {
  if (!applications || applications.length === 0) return 0;
  let successful = 0;
  
  applications.forEach(app => {
    const status = (app.status || "").toLowerCase();
    if (status === "accepted" || status === "offer") {
      successful++;
    }
  });
  
  return parseFloat(((successful / applications.length) * 100).toFixed(1));
}

/**
 * Lists top clients and their application counts.
 * @param {Array<Object>} applications Full applications.
 * @param {number} limit Maximum return results limit.
 * @return {Array<Object>} Top client array of objects.
 */
function getTopClients(applications, limit = 5) {
  if (!applications || applications.length === 0) return [];
  const clientCounts = {};
  
  applications.forEach(app => {
    if (app.clientName) {
      const client = app.clientName.trim();
      clientCounts[client] = (clientCounts[client] || 0) + 1;
    }
  });
  
  const sorted = Object.keys(clientCounts).map(client => {
    return { client: client, count: clientCounts[client] };
  }).sort((a, b) => b.count - a.count);
  
  return sorted.slice(0, limit);
}

/**
 * Filters metrics to focus on a single employee.
 * @param {Array<Object>} applications Full list.
 * @param {string} employeeName Submitter name.
 * @return {Object} Statistics report.
 */
function getEmployeeStats(applications, employeeName) {
  if (!applications || !employeeName) return { count: 0, successRate: 0 };
  
  const employeeApps = applications.filter(app => 
    app.claimedBy && app.claimedBy.includes(employeeName)
  );
  
  return {
    count: employeeApps.length,
    successRate: getSuccessRate(employeeApps)
  };
}

/**
 * Test function for AnalyticsService.gs.
 */
function testAnalyticsService() {
  Logger.log("--- Testing AnalyticsService.gs ---");
  
  const mockApps = [
    { jobRole: "Software Engineer", clientName: "Google", timestamp: new Date().getTime(), status: "Accepted" },
    { jobRole: "Software Engineer", clientName: "Google", timestamp: new Date().getTime(), status: "New" },
    { jobRole: "Product Manager", clientName: "Meta", timestamp: new Date().getTime() - (24 * 60 * 60 * 1000), status: "Rejected" }
  ];
  
  const kpis = calculateKPIs(mockApps);
  assert(kpis.totalLeads === 3, "KPI leads calculation failed");
  assert(kpis.activeClients === 2, "KPI clients calculation failed");
  
  const successRate = getSuccessRate(mockApps);
  assert(successRate === 33.3, "Success rate calculation failed: got " + successRate);
  
  const topClients = getTopClients(mockApps, 2);
  assert(topClients[0].client === "Google" && topClients[0].count === 2, "Top clients ranking failed");
  
  Logger.log("✓ AnalyticsService test passed successfully.");
}

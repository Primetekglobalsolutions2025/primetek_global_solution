/**
 * AnalyticsService.gs
 * Calculates advanced recruitment statistics, conversion rates, and metrics.
 */

const AnalyticsService = {
  /**
   * Calculates dashboard KPI values.
   * @param {Array<Object>} applications Deduplicated applications list.
   * @return {Object} Computed KPI metrics.
   */
  calculateKPIs(applications) {
    if (!applications) return { total: 0, clients: 0, roles: 0, today: 0, applied: 0, interview: 0, offer: 0, acceptanceRate: 0 };
    
    const now = new Date();
    const todayStr = now.toDateString();
    
    const clients = {};
    const roles = {};
    let addedToday = 0;
    let applied = 0;
    let interview = 0;
    let offer = 0;
    let accepted = 0;

    applications.forEach(app => {
      if (app.clientName) clients[app.clientName.toLowerCase()] = true;
      if (app.jobRole) roles[app.jobRole.toLowerCase()] = true;
      
      const status = (app.status || "").toLowerCase().trim();
      if (status === "applied") applied++;
      else if (status.includes("interview")) interview++;
      else if (status === "offer") offer++;
      else if (status === "accepted") accepted++;

      if (app.timestamp) {
        const appDate = new Date(app.timestamp);
        if (appDate.toDateString() === todayStr) {
          addedToday++;
        }
      }
    });

    const totalCount = applications.length;
    const acceptanceRateVal = totalCount > 0 ? (accepted / totalCount) : 0;

    return {
      totalLeads: totalCount,
      activeClients: Object.keys(clients).length,
      uniqueRoles: Object.keys(roles).length,
      addedToday: addedToday,
      applied: applied,
      interview: interview,
      offer: offer,
      acceptanceRate: acceptanceRateVal
    };
  },

  /**
   * Calculates conversion rates along the interview funnel.
   * @param {Array<Object>} applications Consolidated unique list.
   * @return {Object} Conversion rate values.
   */
  getConversionRates(applications) {
    if (!applications || applications.length === 0) {
      return { interviewRate: 0, offerRate: 0, acceptanceRate: 0 };
    }
    
    let total = applications.length;
    let interviews = 0;
    let offers = 0;
    let acceptances = 0;
    
    applications.forEach(app => {
      const status = (app.status || "").toLowerCase().trim();
      if (status.includes("interview")) interviews++;
      if (status === "offer") offers++;
      if (status === "accepted") acceptances++;
    });
    
    return {
      interviewRate: parseFloat(((interviews / total) * 100).toFixed(1)),
      offerRate: parseFloat(((offers / total) * 100).toFixed(1)),
      acceptanceRate: parseFloat(((acceptances / total) * 100).toFixed(1))
    };
  },

  /**
   * Calculates average elapsed time from application to interview.
   * @param {Array<Object>} applications Raw records.
   * @return {number} Average days elapsed.
   */
  getAverageTimeToInterview(applications) {
    if (!applications) return 0;
    
    let totalDays = 0;
    let count = 0;
    
    applications.forEach(app => {
      if (app.timestamp && app.interviewDate) {
        const appliedTime = new Date(app.timestamp).getTime();
        const interviewTime = new Date(app.interviewDate).getTime();
        const diff = interviewTime - appliedTime;
        if (diff > 0) {
          totalDays += diff / (1000 * 60 * 60 * 24);
          count++;
        }
      }
    });
    
    return count > 0 ? parseFloat((totalDays / count).toFixed(1)) : 0;
  }
};

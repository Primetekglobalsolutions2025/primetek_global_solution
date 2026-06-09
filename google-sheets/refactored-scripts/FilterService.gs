/**
 * FilterService.gs
 * Advanced filtering services for sorting and parsing consolidated records.
 */

const FilterService = {
  /**
   * Evaluates filter criteria against applications.
   * @param {Array<Object>} applications Raw list.
   * @param {Object} filters Configured filter states.
   * @return {Array<Object>} Clean matches.
   */
  applyFilters(applications, filters) {
    if (!applications || applications.length === 0) return [];
    if (!filters) return applications;

    let filtered = applications;

    // 1. Text Search Filter
    if (filters.search && filters.search.trim() !== "") {
      filtered = this.filterBySearch(filtered, filters.search);
    }

    // 2. Job Role Dropdown filter
    if (filters.role && filters.role !== "All Roles") {
      filtered = filtered.filter(app => 
        app.jobRole && app.jobRole.toLowerCase().includes(filters.role.toLowerCase())
      );
    }

    // 3. Employee Submitter filter
    if (filters.employee && filters.employee !== "All Employees") {
      filtered = filtered.filter(app => 
        app.claimedBy && app.claimedBy.includes(filters.employee)
      );
    }

    // 4. Date Preset Range filter
    if (filters.dateRange && filters.dateRange !== "All Time") {
      filtered = this.filterByDateRange(filtered, filters.dateRange);
    }

    return filtered;
  },

  /**
   * Global text search.
   * @param {Array<Object>} apps Input applications.
   * @param {string} searchTerm Term value.
   * @return {Array<Object>} Matches.
   */
  filterBySearch(apps, searchTerm) {
    const query = searchTerm.toLowerCase().trim();
    return apps.filter(app => {
      const roleMatch = app.jobRole && app.jobRole.toLowerCase().includes(query);
      const clientMatch = app.clientName && app.clientName.toLowerCase().includes(query);
      const ownerMatch = app.claimedBy && app.claimedBy.toLowerCase().includes(query);
      const notesMatch = app.notes && app.notes.toLowerCase().includes(query);
      const statusMatch = app.status && app.status.toLowerCase().includes(query);
      return roleMatch || clientMatch || ownerMatch || notesMatch || statusMatch;
    });
  },

  /**
   * Filter items matching date presets.
   * @param {Array<Object>} apps Input list.
   * @param {string} range Preset date range description.
   * @return {Array<Object>} Matches.
   */
  filterByDateRange(apps, range) {
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
};

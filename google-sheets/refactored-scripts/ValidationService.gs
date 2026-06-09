/**
 * ValidationService.gs
 * Implements regex check validations and duplication detection.
 */

const ValidationService = {
  /**
   * Validates full application data payload.
   * @param {Object} data Input parameters payload.
   * @return {string|null} Error message if invalid, or null if valid.
   */
  validateApplication(data) {
    if (!data) return "Payload payload is empty or invalid.";
    
    if (!data.jobRole || sanitizeInput(data.jobRole) === "") {
      return "Missing or empty required field: jobRole";
    }
    
    if (!data.clientName || sanitizeInput(data.clientName) === "") {
      return "Missing or empty required field: clientName";
    }
    
    if (!data.applicationUrl || sanitizeInput(data.applicationUrl) === "") {
      return "Missing or empty required field: applicationUrl";
    }
    
    if (!this.validateUrl(data.applicationUrl)) {
      return "Invalid applicationUrl format: URL must begin with http:// or https://";
    }

    if (data.recruiterEmail && sanitizeInput(data.recruiterEmail) !== "") {
      if (!this.validateEmail(data.recruiterEmail)) {
        return "Invalid Recruiter Email format.";
      }
    }

    return null;
  },

  /**
   * Validates website URLs.
   * @param {string} url The URL.
   * @return {boolean} Valid or not.
   */
  validateUrl(url) {
    if (!url) return false;
    const cleanUrl = url.trim().toLowerCase();
    return cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://");
  },

  /**
   * Validates email addresses.
   * @param {string} email Email string.
   * @return {boolean} Valid or not.
   */
  validateEmail(email) {
    if (!email) return false;
    return CONFIG.REGEX.EMAIL.test(email.trim());
  },

  /**
   * Checks if a string is a valid sheet/employee name.
   * @param {string} name Employee tab name.
   * @return {boolean} Valid or not.
   */
  validateEmployee(name) {
    if (!name) return false;
    const cleanName = this.sanitizeEmployeeName(name);
    if (cleanName === "" || cleanName === "Home" || cleanName === "Dashboard") {
      return false;
    }
    return true;
  },

  /**
   * Sanitizes strings for use as Google Sheet tab names.
   * @param {string} name Employee name.
   * @return {string} Sanitized name.
   */
  sanitizeEmployeeName(name) {
    if (!name) return "General";
    return name.toString().trim()
      .replace(/[\\\/\?\*\:\[\]]/g, '') // Remove Sheets disallowed chars
      .substring(0, 31); // Max tab length
  },

  /**
   * Checks if a new job application is a duplicate.
   * Detects duplicate URL strings, or matching Company + Job Role combinations.
   * @param {Array<Object>} existingApps Consolidated unique applications.
   * @param {Object} newApp App payload parameters.
   * @return {string|null} Description of duplicate, or null if unique.
   */
  detectDuplicates(existingApps, newApp) {
    if (!existingApps || existingApps.length === 0) return null;
    
    const newUrl = (newApp.applicationUrl || "").toLowerCase().trim();
    const newRole = (newApp.jobRole || "").toLowerCase().trim();
    const newClient = (newApp.clientName || "").toLowerCase().trim();
    
    for (let i = 0; i < existingApps.length; i++) {
      const app = existingApps[i];
      
      // Match URL
      if (newUrl && app.url && app.url.toLowerCase().trim() === newUrl) {
        return `Job URL is already claimed by: ${app.claimedBy}`;
      }
      
      // Match Client + Role combination
      if (app.jobRole && app.clientName && 
          app.jobRole.toLowerCase().trim() === newRole && 
          app.clientName.toLowerCase().trim() === newClient) {
        return `Similar Job (same Role + Client) is already logged by: ${app.claimedBy}`;
      }
    }
    
    return null;
  }
};

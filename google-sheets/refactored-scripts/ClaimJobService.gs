/**
 * ClaimJobService.gs
 * Manages employee job claims with duplicate checks and Concurrency locks.
 */

const ClaimJobService = {
  /**
   * Assigns an application from the dashboard into an employee sheet tab.
   * Uses LockService to prevent concurrent write overrides.
   * @param {string} employeeName Employee sheet target.
   * @param {string} jobRole Position role.
   * @param {string} clientName Client company name.
   * @param {string} url Application posting URL.
   * @return {boolean} True if successfully claimed.
   */
  claim(employeeName, jobRole, clientName, url) {
    const lock = LockService.getScriptLock();
    try {
      // 1. Obtain script concurrency lock
      lock.waitLock(CONFIG.LOCK_TIMEOUT);
      
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let targetSheet = ss.getSheetByName(employeeName);
      
      if (!targetSheet) {
        targetSheet = EmployeeService.createSheet(employeeName);
      }
      
      // 2. Validate for duplicates (on the employee's sheet specifically)
      const lastRow = targetSheet.getLastRow();
      let alreadyClaimed = false;
      
      if (lastRow > 1) {
        const urlIdx = CONFIG.EMPLOYEE_COLS.URL + 1;
        const existingUrls = targetSheet.getRange(2, urlIdx, lastRow - 1, 1).getValues();
        for (let i = 0; i < existingUrls.length; i++) {
          if (existingUrls[i][0] && existingUrls[i][0].toString().toLowerCase().trim() === url.toLowerCase().trim()) {
            alreadyClaimed = true;
            break;
          }
        }
      }
      
      if (alreadyClaimed) {
        ss.toast(`⚠️ This job URL is already logged in ${employeeName}'s tab!`, "Claim Error");
        return false;
      }
      
      // 3. Append the new row matching the 16 column structure
      const timestamp = new Date();
      const emptyCells = Array(9).fill(""); // Stage, Follow-up, Notes, etc.
      
      targetSheet.appendRow([
        timestamp,
        jobRole,
        clientName,
        url,
        CONFIG.STATUS.NEW.label,
        CONFIG.PRIORITY.MEDIUM.label,
        ...emptyCells, // cols G to O
        timestamp.toISOString() // P: Last Updated
      ]);
      
      EmployeeService.formatSheet(targetSheet);
      
      // 4. Invalidate Cache
      AppCacheService.clear();
      
      // 5. Update Home Grid
      refreshHomeTab(ss);
      
      ss.toast(`🎉 Job claimed by ${employeeName}!`, "Success");
      return true;
    } catch (e) {
      console.error("Lock service exception in ClaimJobService.claim:", e);
      SpreadsheetApp.getActiveSpreadsheet().toast("❌ Server Busy. Please try again.", "Error");
      return false;
    } finally {
      lock.releaseLock();
    }
  }
};

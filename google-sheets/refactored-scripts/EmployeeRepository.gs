/**
 * EmployeeRepository.gs
 * Repository layer managing employee collections and active sheet names.
 */

const EmployeeRepository = {
  /**
   * Scans workbook and returns list of sheet names representing employees.
   * Includes a default filter placeholder "Select Employee".
   * @return {Array<string>} Names list.
   */
  getAllNames() {
    const ss = getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const employees = ["Select Employee"];
    
    for (let i = 0; i < sheets.length; i++) {
      const name = sheets[i].getName();
      if (name !== "Home" && name !== "Dashboard") {
        employees.push(name);
      }
    }
    
    return employees;
  }
};

/**
 * ThemeService.gs
 * Theme renderer applying badge color-coding and design guidelines.
 */

const ThemeService = {
  /**
   * Colors status cell badges.
   * @param {Range} cell Target cell.
   * @param {string} status Status value.
   */
  applyStatusBadge(cell, status) {
    if (!cell || !status) return;
    
    // Find status match key
    const normalized = status.toUpperCase().replace(/\s+/g, '_');
    const badge = CONFIG.STATUS[normalized] || CONFIG.STATUS.NEW;
    
    cell.setBackground(badge.bg)
      .setFontColor(badge.text)
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
  },

  /**
   * Colors priority cell badges.
   * @param {Range} cell Target cell.
   * @param {string} priority Priority value.
   */
  applyPriorityBadge(cell, priority) {
    if (!cell || !priority) return;
    
    const normalized = priority.toUpperCase();
    const badge = CONFIG.PRIORITY[normalized] || CONFIG.PRIORITY.MEDIUM;
    
    cell.setBackground(badge.bg)
      .setFontColor(badge.text)
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
  }
};

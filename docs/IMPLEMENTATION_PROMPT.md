# Step-by-Step Implementation Prompt

## 🎯 Purpose
Use this prompt with Kiro or Claude to generate the complete redesigned system code.

---

## 📝 MASTER IMPLEMENTATION PROMPT

Copy and paste this entire section to your AI assistant:

```
I need you to implement a complete redesigned Google Apps Script job application tracking system based on these specifications:

## CONTEXT
I have an existing Google Sheets-based job tracker that needs a complete overhaul. The current system has:
- Multiple employee sheets tracking applications
- A "Home" dashboard with basic KPIs and filtering
- doGet/doPost API endpoints
- Basic claim functionality

## REQUIREMENTS

### 1. ARCHITECTURE
Create these separate .gs files with modular code:

**Config.gs** - All configuration and constants
- SPREADSHEET_ID
- Theme colors (gradient: #667eea → #764ba2)
- Feature flags
- Default values
- Status/priority enums

**Utils.gs** - Reusable helper functions
- parseColumnIndices(headerRow)
- sanitizeInput(text)
- formatDate(date)
- generateId()
- isValidUrl(url)
- arrayUnique(array)

**DataLayer.gs** - Data access with caching
- collectAllApplications(useCache)
- processApplications(rawData)
- getApplicationById(id)
- updateApplication(id, data)
- deleteApplication(id)
- clearCache()

**ValidationService.gs** - Input validation
- validateApplication(data)
- validateUrl(url)
- validateEmail(email)
- validateEmployee(name)
- sanitizeEmployeeName(name)

**FilterService.gs** - Advanced filtering
- applyFilters(applications, filters)
- filterBySearch(apps, searchTerm)
- filterByDateRange(apps, range)
- filterByStatus(apps, status)
- filterByMultipleCriteria(apps, criteria)

**UIRenderer.gs** - Dashboard rendering
- setupHomeLayout(sheet, employees)
- setupKPICards(sheet)
- setupFilterControls(sheet, employees)
- renderApplicationTable(sheet, applications, employees)
- applyStatusBadge(cell, status)

**AnalyticsService.gs** - Metrics calculation
- calculateKPIs(applications)
- getTimelineStat(applications, days)
- getSuccessRate(applications)
- getTopClients(applications, limit)
- getEmployeeStats(applications, employeeName)

**ApiService.gs** - REST endpoints
- doGet(e) - Return all applications with metadata
- doPost(e) - Add/update applications with validation
- handleGetRequest(params)
- handlePostRequest(payload)
- sendJsonResponse(data, success)

**Main.gs** - Entry points and triggers
- onOpen() - Custom menu
- onEdit(e) - Handle filter changes and claims
- refreshHomeTab(ss)
- formatSheetTheme(sheet)
- runInitialSetupAndFormatting()

### 2. UI SPECIFICATIONS

#### Home Dashboard Layout:
```
Row 1-2: Gradient header (#667eea → #764ba2)
  "⚡ PRIMETEK GLOBAL SOLUTIONS"
  "Job Application Dashboard"
  
Row 4-5: KPI Cards (8 total, 2 cols each)
  📊 Total Leads | 🏢 Active Clients | 💼 Unique Roles | 📅 Added Today
  
Row 7-8: Filter Bar
  🔍 Search | 💼 Role | 📊 Status | 📅 Date | 👤 Employee
  
Row 11: Table Header (frozen)
  ☐ | # | Status | Date | Job Role | Client | Owner | Actions
  
Row 12+: Data rows
  Alternating colors (#f8fafc / #ffffff)
  Status badges with colored backgrounds
  Action buttons (View, Claim)
```

#### Status Badge System:
- 🟢 New: #dcfce7 bg, #166534 text
- 🟡 Applied: #fef3c7 bg, #92400e text
- 🔵 Interview: #dbeafe bg, #1e40af text
- 🟣 Offer: #ede9fe bg, #5b21b6 text
- ✅ Accepted: #d1fae5 bg, #065f46 text
- ❌ Rejected: #fee2e2 bg, #991b1b text

#### Column Widths:
A: 40px (checkbox) | B: 50px (#) | C: 100px (status) | D: 100px (date)
E: 180px (role) | F: 180px (client) | G: 150px (owner) | H: 120px (actions)

### 3. FEATURES TO IMPLEMENT

**Caching**:
- 5-minute cache for API responses
- Automatic cache invalidation on write
- Manual cache clear function

**Validation**:
- URL format checking
- Required field validation
- Duplicate URL detection
- Input sanitization

**Advanced Filtering**:
- Full-text search across role, client, owner
- Multi-select status filter
- Date range filter (Today, 7 days, 30 days)
- Employee filter
- Combined filters

**Enhanced Data Model**:
Add these columns to employee sheets:
- Status (dropdown)
- Priority (High/Medium/Low)
- Stage (current interview stage)
- Follow-up Date
- Notes

**Analytics**:
- Total applications count
- Unique clients count
- Success rate calculation
- Weekly trends
- Employee performance metrics

**Error Handling**:
- Try-catch blocks on all public functions
- Logging to Logger.log()
- User-friendly toast notifications
- Graceful degradation

### 4. CODE QUALITY REQUIREMENTS

- **Naming**: camelCase functions, UPPER_CASE constants
- **Comments**: JSDoc for all public functions
- **DRY**: No code duplication
- **Error handling**: Comprehensive try-catch
- **Performance**: Batch operations, minimize sheet reads
- **Validation**: Sanitize all inputs
- **Security**: Protect against injection

### 5. IMPLEMENTATION ORDER

Generate files in this sequence:

1. Config.gs - Foundation
2. Utils.gs - Helper functions
3. ValidationService.gs - Input checking
4. DataLayer.gs - Data access
5. FilterService.gs - Filtering logic
6. AnalyticsService.gs - Metrics
7. UIRenderer.gs - Dashboard rendering
8. ApiService.gs - REST endpoints
9. Main.gs - Glue code and triggers

### 6. TESTING REQUIREMENTS

Include test functions in each file:
```javascript
// Example
function testDataLayer() {
  const data = DataLayer.collectAllApplications(false);
  Logger.log(`✓ Collected ${data.applications.length} applications`);
  assert(data.applications.length > 0, "Should have applications");
}
```

## OUTPUT FORMAT

For each file:
1. Provide complete, production-ready code
2. Include JSDoc comments
3. Add inline comments for complex logic
4. Include error handling
5. Add test function at the end

Start with Config.gs and work through all 9 files.

After all files, provide:
- Setup instructions
- How to test
- How to deploy
- Migration steps from old system

Ready? Start with Config.gs now.
```

---

## 🔧 CUSTOMIZATION PARAMETERS

Before running the prompt, customize these:

### Your Spreadsheet Details:
```javascript
SPREADSHEET_ID: "YOUR_ACTUAL_SPREADSHEET_ID"
COMPANY_NAME: "Your Company Name"
```

### Your Job Roles (add/remove as needed):
```javascript
DEFAULT_ROLES: [
  "Software Engineer",
  "Data Engineer",
  "Control Engineer",
  "Data Analyst",
  "Product Manager",
  // Add your roles here
]
```

### Your Color Scheme (optional):
```javascript
// Default: Purple gradient
PRIMARY: "#667eea"
PRIMARY_DARK: "#764ba2"

// Or try:
// Blue: #3b82f6 → #1e40af
// Green: #10b981 → #059669
// Orange: #f59e0b → #ea580c
```

---

## ✅ VERIFICATION CHECKLIST

After AI generates all code:

### File Completeness:
- [ ] Config.gs (50-100 lines)
- [ ] Utils.gs (100-150 lines)
- [ ] DataLayer.gs (150-200 lines)
- [ ] ValidationService.gs (100-150 lines)
- [ ] FilterService.gs (100-150 lines)
- [ ] AnalyticsService.gs (100-150 lines)
- [ ] UIRenderer.gs (200-300 lines)
- [ ] ApiService.gs (100-150 lines)
- [ ] Main.gs (150-200 lines)

### Code Quality:
- [ ] All functions have JSDoc comments
- [ ] No TODO or FIXME comments
- [ ] Error handling on all public functions
- [ ] Input validation on all user inputs
- [ ] No hardcoded values (use CONFIG)
- [ ] Consistent code style

### Functionality:
- [ ] Test functions included
- [ ] Setup instructions provided
- [ ] Migration steps documented
- [ ] API documentation included

---

## 🚀 QUICK START AFTER GENERATION

1. **Create Project**:
   - Open your spreadsheet
   - Extensions → Apps Script
   - Create 9 files as listed above

2. **Copy Code**:
   - Paste generated code into each file
   - Update SPREADSHEET_ID in Config.gs

3. **Run Setup**:
   ```javascript
   runInitialSetupAndFormatting()
   ```

4. **Test**:
   ```javascript
   // Test data collection
   testDataLayer()
   
   // Test filtering
   testFilterService()
   
   // Test UI rendering
   refreshHomeTab(SpreadsheetApp.getActiveSpreadsheet())
   ```

5. **Deploy API**:
   - Deploy → New deployment
   - Type: Web app
   - Execute as: Me
   - Who has access: Anyone
   - Copy web app URL

6. **Verify**:
   - Check Home dashboard appearance
   - Test filters
   - Try claiming a job
   - Test API endpoints

---

## 💡 TIPS FOR BEST RESULTS

### When Using AI:
1. **Run the full prompt** - Don't break it up
2. **Ask for complete files** - Not snippets
3. **Request tests** - Always include test functions
4. **Verify logic** - Review critical sections
5. **Test incrementally** - Test each file as generated

### If AI Stops Mid-Generation:
```
"Continue generating the next file: [FileName].gs
Follow the same pattern as previous files with:
- JSDoc comments
- Error handling  
- Test function at end
Start now."
```

### If Code Has Errors:
```
"There's an error in [FileName].gs at line X:
[paste error message]

Fix this error and provide the corrected function.
Ensure it follows the same patterns as other files."
```

---

## 🎯 EXPECTED OUTCOMES

### Performance:
- Dashboard load: < 2 seconds
- Filter application: < 0.5 seconds
- API response: < 1 second

### Code Metrics:
- Total lines: ~1,500-2,000
- Files: 9
- Functions: ~50-60
- Test coverage: Basic tests for each service

### UI Quality:
- Modern gradient header
- Professional KPI cards
- Smooth filtering
- Color-coded status badges
- Responsive layout

---

## 📖 RELATED DOCUMENTS

After implementation, refer to:
- **MIGRATION_GUIDE.md** - How to migrate data
- **API_DOCUMENTATION.md** - API reference
- **USER_GUIDE.md** - End-user instructions
- **TROUBLESHOOTING.md** - Common issues

---

**Ready to generate? Copy the MASTER IMPLEMENTATION PROMPT above and paste it to your AI assistant!**

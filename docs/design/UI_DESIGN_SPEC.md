# UI Design Specification - Job Application Dashboard

## 🎨 Visual Design System

### Color Palette

```
PRIMARY GRADIENT
┌─────────────────────────────────────┐
│  #667eea → #764ba2 (Purple Gradient)│
└─────────────────────────────────────┘

STATUS COLORS
🟢 New/Active       : #10b981 (Green)
🟡 In Progress      : #f59e0b (Amber)
🔵 Interview        : #3b82f6 (Blue)
🟣 Offer            : #8b5cf6 (Purple)
✅ Accepted         : #059669 (Dark Green)
❌ Rejected         : #ef4444 (Red)
⚪ Archived         : #94a3b8 (Slate)

SEMANTIC COLORS
Success    : #10b981
Warning    : #f59e0b
Error      : #ef4444
Info       : #06b6d4

NEUTRAL SCALE
50  : #f8fafc (Background)
100 : #f1f5f9 (Hover)
200 : #e2e8f0 (Border)
300 : #cbd5e1 (Disabled)
500 : #64748b (Text Muted)
700 : #334155 (Text Secondary)
900 : #0f172a (Text Main)
```

### Typography Scale

```
DISPLAY (Title Bar)
Font: Google Sans Bold
Size: 18-24px
Color: #ffffff (on dark) or #0f172a (on light)

HEADINGS
H1: 16px Bold      - Section headers
H2: 14px Semibold  - Card titles
H3: 12px Semibold  - Table headers

BODY
Regular: 10-11px   - Table cells, labels
Small: 9px         - Meta information, timestamps

METRICS
Large: 32-48px Bold - KPI numbers
Medium: 18-24px Bold - Secondary metrics
```

### Spacing System

```
Base Unit: 8px

Micro:   4px   - Icon padding, tight spacing
Small:   8px   - Cell padding
Medium:  16px  - Card padding
Large:   24px  - Section gaps
XLarge:  32px  - Major section spacing

Row Heights:
Header:  40-48px
Data:    32-36px
Compact: 28px
```

### Component Styles

```css
/* Card Style */
Background: #ffffff
Border: 1px solid #e2e8f0
Border-radius: 8px
Shadow: 0 1px 3px rgba(0,0,0,0.1)
Padding: 16px

/* Button Styles */
Primary:
  Background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
  Color: #ffffff
  Padding: 8px 16px
  Border-radius: 6px
  Font-weight: 600

Secondary:
  Background: #ffffff
  Border: 1px solid #e2e8f0
  Color: #334155
  Padding: 8px 16px
  Border-radius: 6px

/* Badge Styles */
Status Badge:
  Padding: 4px 12px
  Border-radius: 12px
  Font-size: 9px
  Font-weight: 600
  Text-transform: uppercase
```

---

## 📐 Dashboard Layout (Home Sheet)

### Complete Layout Grid

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ROW 1-2: HEADER                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ [Logo] ⚡ PRIMETEK GLOBAL SOLUTIONS                   Last: 10:30 AM    │ │
│ │        Job Application Dashboard                      [Refresh 🔄]      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│   Merge A1:H2 | Gradient: #667eea→#764ba2 | Text: #fff | Bold 18px         │
├─────────────────────────────────────────────────────────────────────────────┤
│ ROW 3: Spacer (Height: 16px)                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ ROW 4-5: KPI CARDS (8 Metrics)                                              │
│ ┌───────────┬───────────┬───────────┬───────────┬───────────┬──────────┐   │
│ │ 📊 TOTAL  │ 🏢 ACTIVE │ 💼 UNIQUE │ 📅 TODAY  │ 📈 WEEK   │ ✅ SUCCESS│  │
│ │   LEADS   │  CLIENTS  │   ROLES   │  ADDED    │  ADDED    │   RATE   │   │
│ │    152    │    28     │    12     │     8     │    35     │   45%    │   │
│ └───────────┴───────────┴───────────┴───────────┴───────────┴──────────┘   │
│   Each: 2 cols wide | Bg: #fff | Border: #e2e8f0 | Shadow                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ ROW 6: Spacer (Height: 16px)                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ ROW 7-8: FILTER BAR & ACTIONS                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 🔍 [Search jobs, clients...] [Role ▾] [Status ▾] [Date ▾] [Owner ▾]   │ │
│ │                                                                          │ │
│ │ [+ Add Application] [↓ Export] [↑ Import] [⚙️ Settings] [🔄 Refresh]   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│   Row 7: Labels (9px, #64748b, Right-aligned)                               │
│   Row 8: Inputs (Bg: #fff, Border: #e2e8f0, 32px height)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ ROW 9: STATUS BAR                                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Showing 1-50 of 152 results  │ [Select All] [Bulk Actions ▾]           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│   Bg: #f8fafc | Text: #64748b | 9px                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ ROW 10: Spacer (Height: 8px)                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ ROW 11: TABLE HEADER                                                         │
│ ┌──┬────┬────────┬────────────┬────────────┬─────────┬─────────┬─────────┐│
│ │☐ │ #  │ Status │ Date       │ Job Role   │ Client  │ Owner   │ Actions ││
│ └──┴────┴────────┴────────────┴────────────┴─────────┴─────────┴─────────┘│
│   Bg: #f1f5f9 | Text: #334155 | Bold 9px | 36px height | Centered          │
├─────────────────────────────────────────────────────────────────────────────┤
│ ROW 12+: TABLE DATA                                                          │
│ ┌──┬────┬────────┬────────────┬────────────┬─────────┬─────────┬─────────┐│
│ │☐ │ 1  │ 🟢 New │ 10-Jun     │ Software   │ Google  │ John D  │ [V][C] ││
│ │☐ │ 2  │ 🟡 App │ 09-Jun     │ Data Eng   │ Meta    │ Jane S  │ [V][C] ││
│ │☐ │ 3  │ 🔵 Int │ 08-Jun     │ PM         │ Amazon  │ Bob M   │ [V][C] ││
│ └──┴────┴────────┴────────────┴────────────┴─────────┴─────────┴─────────┘│
│   Alt rows: #f8fafc / #ffffff | 32px height | Hover: #f1f5f9               │
│   Actions: [V]iew, [C]laim                                                  │
└─────────────────────────────────────────────────────────────────────────────┘

Column Widths:
A (☐):      40px   - Checkbox
B (#):      50px   - Serial number
C (Status): 100px  - Status badge
D (Date):   100px  - Date (dd-mmm format)
E (Role):   180px  - Job role (bold, left-aligned)
F (Client): 180px  - Client name (left-aligned)
G (Owner):  150px  - Employee name
H (Actions): 120px - Action buttons
```

### Row-by-Row Specifications

#### Rows 1-2: Header
```
Merge: A1:H2
Background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)
Font: Google Sans, 18px, Bold
Color: #ffffff
Alignment: Center/Middle
Height: 48px total (24px each)
Content: "⚡ PRIMETEK GLOBAL SOLUTIONS"
         "Job Application Dashboard"
Corner: Show last refresh time in small text (9px, opacity 0.8)
```

#### Rows 4-5: KPI Cards (8 cards total)
```
Card 1 (A4:B5) - Total Leads
  Label: "📊 Total Leads" (9px, #64748b)
  Value: =COUNTA(E12:E) (32px, Bold, #667eea)
  
Card 2 (C4:D5) - Active Clients
  Label: "🏢 Active Clients" (9px, #64748b)
  Value: =COUNTUNIQUE(F12:F) (32px, Bold, #10b981)
  
Card 3 (E4:F5) - Unique Roles
  Label: "💼 Unique Roles" (9px, #64748b)
  Value: =COUNTUNIQUE(E12:E) (32px, Bold, #3b82f6)
  
Card 4 (G4:H5) - Added Today
  Label: "📅 Added Today" (9px, #64748b)
  Value: =COUNTIF(D12:D, TODAY()) (32px, Bold, #f59e0b)

Card 5 (A6:B7) - Week Added
  Label: "📈 This Week" (9px, #64748b)
  Value: Custom formula (32px, Bold, #8b5cf6)
  
Card 6 (C6:D7) - Success Rate
  Label: "✅ Success Rate" (9px, #64748b)
  Value: =(COUNTIF(C12:C,"Accepted")/COUNTA(C12:C))*100&"%" (32px, Bold, #059669)
  
Card 7 (E6:F7) - In Progress
  Label: "⏳ In Progress" (9px, #64748b)
  Value: =COUNTIF(C12:C,"Applied")+COUNTIF(C12:C,"Interview") (32px, Bold, #06b6d4)
  
Card 8 (G6:H7) - Avg Response Time
  Label: "⚡ Avg Response" (9px, #64748b)
  Value: "3.2 days" (32px, Bold, #64748b)

Styling:
  Background: #ffffff
  Border: 1px solid #e2e8f0
  Border-radius: 8px (simulated with formatting)
  Padding: 12px (via row/col sizing)
  Alignment: Center/Middle
```

#### Row 7-8: Filter Bar
```
A7: "🔍 Search:"
B8: [Text input] - placeholder: "Search jobs, clients, owners..."

C7: "💼 Role:"
D8: [Dropdown] - Options: All Roles, Software Engineer, Data Engineer, etc.

E7: "📊 Status:"
F8: [Dropdown] - Options: All Status, New, Applied, Interview, Offer, etc.

G7: "📅 Date:"
H8: [Dropdown] - Options: All Time, Today, Past 7 Days, Past 30 Days

Styling:
  Labels (Row 7): 9px, #64748b, Right-aligned, Semibold
  Inputs (Row 8): Bg #fff, Border #e2e8f0, 10px font, Left-aligned
  Height: 36px (Row 8)
```

#### Row 11: Table Header
```
Cells: A11, B11, C11, D11, E11, F11, G11, H11
Content: ["☐", "#", "Status", "Date", "Job Role", "Client", "Owner", "Actions"]
Background: #f1f5f9
Font: 9px, Semibold, #334155
Alignment: Center/Middle
Border: Bottom 2px solid #cbd5e1
Height: 36px
Freeze: setFrozenRows(11) - Keep header visible on scroll
```

#### Row 12+: Data Rows
```
Pattern:
  Even rows (12, 14, 16...): Background #f8fafc
  Odd rows (13, 15, 17...): Background #ffffff
  
Height: 32px per row

Columns:
  A: Checkbox (centered)
  B: Serial # (centered, 10px)
  C: Status badge with colored circle + text
     Format: "🟢 New" or "🟡 Applied" etc.
     Font: 9px, Semibold
  D: Date (dd-mmm format, centered, 10px)
  E: Job role (Bold, 10px, left-aligned, #0f172a)
  F: Client name (10px, left-aligned, #64748b)
  G: Owner (10px, centered, #334155)
  H: Action buttons
     "View 👁" hyperlink to details
     "Claim ➕" dropdown for claiming

Hover Effect:
  onEdit: Temporary background change to #f1f5f9
  (Simulated via conditional formatting if possible)
  
Borders:
  Bottom: 1px solid #e2e8f0
```

---

## 📱 Employee Sheet Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ROW 1-2: PERSONAL HEADER                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 👤 JOHN DOE's Applications                              My Stats         │ │
│ │    Software Engineer                       Total: 28 | Active: 12        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│   Gradient: #667eea→#764ba2 | White text | Bold                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ ROW 4: QUICK ACTIONS                                                         │
│ [+ Add Application] [↓ Export My Data] [📊 My Analytics]                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ ROW 6: COLUMN HEADERS                                                        │
│ Date | Job Role | Client | URL | Status | Priority | Stage | Follow-Up      │
├─────────────────────────────────────────────────────────────────────────────┤
│ ROW 7+: DATA WITH ENHANCED TRACKING                                          │
│ 10-Jun | Software Eng | Google | [Apply🔗] | 🟢Applied | 🔴High | Phone...  │
└─────────────────────────────────────────────────────────────────────────────┘

Column Details:
A: Date (100px, dd-mmm format)
B: Job Role (180px, bold)
C: Client (150px)
D: URL (200px, hyperlink style)
E: Status (120px, dropdown with colors)
F: Priority (100px, dropdown: High🔴/Medium🟡/Low🟢)
G: Stage (150px, current interview stage)
H: Follow-Up Date (120px, date format, highlight if overdue)
I: Notes (200px, wrapped text)
```

---

## 🎯 Status Badge Styles

### Implementation in Google Sheets

```javascript
function applyStatusBadge(cell, status) {
  const statusConfig = {
    'New': { icon: '🟢', bg: '#dcfce7', text: '#166534' },
    'Applied': { icon: '🟡', bg: '#fef3c7', text: '#92400e' },
    'Phone Screen': { icon: '🔵', bg: '#dbeafe', text: '#1e40af' },
    'Technical': { icon: '🔵', bg: '#dbeafe', text: '#1e40af' },
    'Final Interview': { icon: '🟣', bg: '#ede9fe', text: '#5b21b6' },
    'Offer': { icon: '🟣', bg: '#ede9fe', text: '#5b21b6' },
    'Accepted': { icon: '✅', bg: '#d1fae5', text: '#065f46' },
    'Rejected': { icon: '❌', bg: '#fee2e2', text: '#991b1b' },
    'Archived': { icon: '⚪', bg: '#f1f5f9', text: '#64748b' }
  };
  
  const config = statusConfig[status] || statusConfig['New'];
  
  cell.setValue(`${config.icon} ${status}`)
      .setBackground(config.bg)
      .setFontColor(config.text)
      .setFontWeight('bold')
      .setFontSize(9)
      .setHorizontalAlignment('center');
}
```

---

## 🎨 Interactive Elements

### Hover Effects (Simulated)
```javascript
// Use conditional formatting for hover-like effects
function setupConditionalFormatting(sheet) {
  const range = sheet.getRange('A12:H1000');
  
  // Highlight rows with overdue follow-ups
  const rule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaThatIs('=AND($H12<TODAY(), $H12<>"")')
    .setBackground('#fee2e2')
    .setRanges([range])
    .build();
    
  sheet.setConditionalFormatRules([rule]);
}
```

### Button Styles
```javascript
function styleActionButton(cell, text, type = 'primary') {
  const styles = {
    primary: { bg: '#667eea', text: '#ffffff' },
    secondary: { bg: '#ffffff', text: '#667eea' },
    success: { bg: '#10b981', text: '#ffffff' },
    danger: { bg: '#ef4444', text: '#ffffff' }
  };
  
  const style = styles[type];
  
  cell.setValue(text)
      .setBackground(style.bg)
      .setFontColor(style.text)
      .setFontWeight('bold')
      .setFontSize(9)
      .setBorder(true, true, true, true, false, false, style.bg, SpreadsheetApp.BorderStyle.SOLID)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
}
```

---

## 📊 Chart Specifications (Analytics Sheet)

### Application Timeline Chart
```
Type: Line Chart
Range: Last 30 days
X-Axis: Date
Y-Axis: Number of applications
Colors: #667eea (gradient)
Title: "📈 Application Activity (Last 30 Days)"
Position: A5:D15
```

### Status Distribution Chart  
```
Type: Donut Chart
Data: Count of each status
Colors: Match status badge colors
Title: "📊 Application Status Breakdown"
Position: E5:H15
Show: Percentages + absolute numbers
```

### Success Rate by Role Chart
```
Type: Horizontal Bar Chart
Data: Acceptance rate per job role
Color: Green gradient (#dcfce7 → #059669)
Title: "✅ Success Rate by Job Role"
Position: A17:D27
Sort: Highest to lowest
```

---

## 🎭 Animation & Transitions

While Google Sheets doesn't support CSS animations, simulate with:

### Loading States
```javascript
function showLoadingState() {
  const cell = sheet.getRange('A1');
  cell.setValue('⏳ Loading...')
      .setFontColor('#64748b')
      .setHorizontalAlignment('center');
  
  SpreadsheetApp.flush(); // Force update
}

function hideLoadingState() {
  // Restore normal header
  setupHeader();
  SpreadsheetApp.flush();
}
```

### Success Feedback
```javascript
function flashSuccess(range) {
  const original = range.getBackground();
  
  range.setBackground('#dcfce7'); // Green flash
  SpreadsheetApp.flush();
  
  Utilities.sleep(500);
  
  range.setBackground(original); // Restore
  SpreadsheetApp.flush();
}
```

---

## ✅ Implementation Checklist

### Phase 1: Core Styling
- [ ] Apply color palette to all sheets
- [ ] Set up typography scale (fonts, sizes, weights)
- [ ] Implement spacing system (row heights, column widths)
- [ ] Create gradient header
- [ ] Style KPI cards with borders and backgrounds

### Phase 2: Interactive Elements
- [ ] Add status badges with colored backgrounds
- [ ] Implement priority indicators
- [ ] Create action button styles
- [ ] Add data validation dropdowns
- [ ] Set up conditional formatting for overdue items

### Phase 3: Layout & Composition
- [ ] Freeze header rows
- [ ] Set alternating row colors
- [ ] Align text (center/left/right per spec)
- [ ] Add borders and dividers
- [ ] Optimize for mobile viewing

### Phase 4: Polish
- [ ] Add icons to all labels
- [ ] Create visual hierarchy
- [ ] Test color contrast (WCAG AA)
- [ ] Add empty states ("No results found")
- [ ] Implement loading states

---

**This design system ensures a modern, professional, and consistent user interface across all sheets.**

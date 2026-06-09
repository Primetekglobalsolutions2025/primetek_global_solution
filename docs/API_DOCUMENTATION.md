# API Documentation - Job Application Tracker

## 📡 Overview

The Job Application Tracker exposes RESTful API endpoints via Google Apps Script Web App for external integrations.

**Base URL**: `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`

---

## 🔐 Authentication

### Current Implementation
- No authentication (public access)
- Rate limits apply per Google Apps Script quotas

### Recommended for Production
Add API key validation in doGet/doPost:

```javascript
function validateApiKey(e) {
  const apiKey = e.parameter.apiKey || e.headers?.['X-API-Key'];
  const validKeys = PropertiesService.getScriptProperties()
    .getProperty('VALID_API_KEYS')?.split(',') || [];
  
  if (!validKeys.includes(apiKey)) {
    throw new Error('Invalid API key');
  }
}
```

---

## 📥 GET ENDPOINTS

### 1. Get All Applications

**Endpoint**: `GET {BASE_URL}`

**Description**: Retrieve all job applications with optional filtering

#### Request Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `search` | string | No | Search term for role/client/owner | `engineer` |
| `status` | string | No | Filter by status | `Applied` |
| `employee` | string | No | Filter by employee name | `John Doe` |
| `dateFrom` | string | No | Start date (YYYY-MM-DD) | `2026-06-01` |
| `dateTo` | string | No | End date (YYYY-MM-DD) | `2026-06-10` |
| `limit` | number | No | Max results (default: 100) | `50` |
| `offset` | number | No | Pagination offset | `0` |

#### Example Requests

```bash
# Get all applications
curl "https://script.google.com/macros/s/{ID}/exec"

# Search for "engineer" roles
curl "https://script.google.com/macros/s/{ID}/exec?search=engineer"

# Filter by status
curl "https://script.google.com/macros/s/{ID}/exec?status=Applied"

# Get John's applications
curl "https://script.google.com/macros/s/{ID}/exec?employee=John%20Doe"

# Pagination
curl "https://script.google.com/macros/s/{ID}/exec?limit=50&offset=100"

# Combined filters
curl "https://script.google.com/macros/s/{ID}/exec?search=software&status=Interview&dateFrom=2026-06-01"
```

#### Response Format

```json
{
  "success": true,
  "data": [
    {
      "employeeName": "John Doe",
      "timestamp": "2026-06-10T10:30:00.000Z",
      "jobRole": "Software Engineer",
      "clientName": "Google",
      "url": "https://careers.google.com/jobs/123",
      "status": "Applied",
      "priority": "High",
      "stage": "Phone Screen",
      "followUpDate": "2026-06-15",
      "notes": "Referred by Jane",
      "claimedBy": "John Doe, Jane Smith"
    },
    {
      "employeeName": "Jane Smith",
      "timestamp": "2026-06-09T14:20:00.000Z",
      "jobRole": "Data Engineer",
      "clientName": "Meta",
      "url": "https://metacareers.com/jobs/456",
      "status": "Interview",
      "priority": "Medium",
      "stage": "Technical Round",
      "followUpDate": "2026-06-12",
      "notes": "",
      "claimedBy": "Jane Smith"
    }
  ],
  "metadata": {
    "total": 152,
    "returned": 2,
    "limit": 100,
    "offset": 0,
    "cached": true,
    "timestamp": "2026-06-10T15:45:00.000Z"
  }
}
```

#### Error Response

```json
{
  "success": false,
  "error": "Error message here",
  "code": "ERROR_CODE",
  "timestamp": "2026-06-10T15:45:00.000Z"
}
```

### 2. Get KPIs/Statistics

**Endpoint**: `GET {BASE_URL}?action=stats`

**Description**: Get dashboard statistics

#### Example Request

```bash
curl "https://script.google.com/macros/s/{ID}/exec?action=stats"
```

#### Response

```json
{
  "success": true,
  "data": {
    "totalApplications": 152,
    "activeClients": 28,
    "uniqueRoles": 12,
    "addedToday": 8,
    "addedThisWeek": 35,
    "successRate": 45.5,
    "inProgress": 67,
    "avgResponseTime": "3.2 days",
    "byStatus": {
      "New": 12,
      "Applied": 45,
      "Interview": 22,
      "Offer": 8,
      "Accepted": 35,
      "Rejected": 30
    },
    "byPriority": {
      "High": 25,
      "Medium": 78,
      "Low": 49
    },
    "topClients": [
      { "name": "Google", "count": 15 },
      { "name": "Meta", "count": 12 },
      { "name": "Amazon", "count": 10 }
    ]
  },
  "timestamp": "2026-06-10T15:45:00.000Z"
}
```

### 3. Get Single Application

**Endpoint**: `GET {BASE_URL}?action=get&id={ID}`

**Description**: Get details of a specific application

#### Example Request

```bash
curl "https://script.google.com/macros/s/{ID}/exec?action=get&id=APP-2026-001"
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "APP-2026-001",
    "employeeName": "John Doe",
    "timestamp": "2026-06-10T10:30:00.000Z",
    "lastModified": "2026-06-10T14:20:00.000Z",
    "jobRole": "Software Engineer",
    "clientName": "Google",
    "url": "https://careers.google.com/jobs/123",
    "status": "Applied",
    "priority": "High",
    "stage": "Phone Screen",
    "followUpDate": "2026-06-15",
    "notes": "Referred by Jane",
    "claimedBy": ["John Doe", "Jane Smith"]
  }
}
```

---

## 📤 POST ENDPOINTS

### 1. Add New Application

**Endpoint**: `POST {BASE_URL}`

**Description**: Create a new job application

#### Request Body

```json
{
  "employeeName": "John Doe",
  "jobRole": "Software Engineer",
  "clientName": "Google",
  "applicationUrl": "https://careers.google.com/jobs/123",
  "status": "New",
  "priority": "High",
  "stage": "Application",
  "followUpDate": "2026-06-15",
  "notes": "Referred by Jane"
}
```

#### Required Fields

- `jobRole` (string, 2-100 chars)
- `clientName` (string, 2-100 chars)
- `applicationUrl` (string, valid HTTPS URL)

#### Optional Fields

- `employeeName` (string, defaults to "General")
- `status` (enum, defaults to "New")
- `priority` (enum, defaults to "Medium")
- `stage` (string)
- `followUpDate` (date, YYYY-MM-DD)
- `notes` (string)

#### Example Request

```bash
curl -X POST "https://script.google.com/macros/s/{ID}/exec" \
  -H "Content-Type: application/json" \
  -d '{
    "employeeName": "John Doe",
    "jobRole": "Software Engineer",
    "clientName": "Google",
    "applicationUrl": "https://careers.google.com/jobs/123",
    "status": "New",
    "priority": "High"
  }'
```

#### Success Response

```json
{
  "success": true,
  "message": "Application added successfully",
  "data": {
    "id": "APP-2026-152",
    "employeeName": "John Doe",
    "jobRole": "Software Engineer",
    "clientName": "Google",
    "timestamp": "2026-06-10T16:00:00.000Z"
  }
}
```

#### Validation Errors

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "applicationUrl",
      "message": "Invalid URL format"
    },
    {
      "field": "jobRole",
      "message": "Job role is required"
    }
  ]
}
```

#### Duplicate Error

```json
{
  "success": false,
  "error": "Application URL already exists in this sheet",
  "duplicate": true,
  "existingId": "APP-2026-100"
}
```

### 2. Update Application

**Endpoint**: `POST {BASE_URL}?action=update&id={ID}`

**Description**: Update an existing application

#### Request Body

```json
{
  "status": "Interview",
  "stage": "Technical Round",
  "followUpDate": "2026-06-15",
  "notes": "Scheduled for technical interview"
}
```

#### Example Request

```bash
curl -X POST "https://script.google.com/macros/s/{ID}/exec?action=update&id=APP-2026-001" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "Interview",
    "stage": "Technical Round"
  }'
```

#### Response

```json
{
  "success": true,
  "message": "Application updated successfully",
  "data": {
    "id": "APP-2026-001",
    "lastModified": "2026-06-10T16:05:00.000Z"
  }
}
```

### 3. Delete Application

**Endpoint**: `POST {BASE_URL}?action=delete&id={ID}`

**Description**: Delete an application (soft delete recommended)

#### Example Request

```bash
curl -X POST "https://script.google.com/macros/s/{ID}/exec?action=delete&id=APP-2026-001"
```

#### Response

```json
{
  "success": true,
  "message": "Application deleted successfully"
}
```

### 4. Bulk Operations

**Endpoint**: `POST {BASE_URL}?action=bulk`

**Description**: Create multiple applications at once

#### Request Body

```json
{
  "applications": [
    {
      "employeeName": "John Doe",
      "jobRole": "Software Engineer",
      "clientName": "Google",
      "applicationUrl": "https://careers.google.com/jobs/123"
    },
    {
      "employeeName": "Jane Smith",
      "jobRole": "Data Engineer",
      "clientName": "Meta",
      "applicationUrl": "https://metacareers.com/jobs/456"
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "message": "Bulk operation completed",
  "data": {
    "total": 2,
    "created": 2,
    "failed": 0,
    "errors": []
  }
}
```

---

## 🔍 Query Operators

### Filtering

```
?search=term              # Full-text search
?status=Applied           # Exact match
?priority=High,Medium     # Multiple values (OR)
?dateFrom=2026-06-01      # Greater than or equal
?dateTo=2026-06-30        # Less than or equal
```

### Sorting

```
?sort=timestamp           # Sort by field
?order=desc               # Order: asc or desc
?sort=timestamp&order=desc # Combined
```

### Pagination

```
?limit=50                 # Results per page
?offset=100               # Skip first N results
?page=3&limit=50          # Page-based (alternative)
```

---

## 📊 Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad Request (validation error) |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 500 | Internal Server Error |

Note: Google Apps Script always returns HTTP 200; check `success` field in JSON.

---

## 🚀 Integration Examples

### JavaScript (Fetch API)

```javascript
// Get all applications
async function getApplications() {
  const response = await fetch(
    'https://script.google.com/macros/s/{ID}/exec'
  );
  const data = await response.json();
  
  if (data.success) {
    console.log(`Found ${data.data.length} applications`);
    return data.data;
  } else {
    console.error(data.error);
  }
}

// Add application
async function addApplication(app) {
  const response = await fetch(
    'https://script.google.com/macros/s/{ID}/exec',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(app)
    }
  );
  
  const data = await response.json();
  return data;
}

// Usage
const newApp = {
  employeeName: "John Doe",
  jobRole: "Software Engineer",
  clientName: "Google",
  applicationUrl: "https://careers.google.com/jobs/123"
};

addApplication(newApp).then(result => {
  if (result.success) {
    console.log('✅ Application added:', result.data.id);
  } else {
    console.error('❌ Error:', result.error);
  }
});
```

### Python (requests)

```python
import requests
import json

BASE_URL = "https://script.google.com/macros/s/{ID}/exec"

# Get applications
def get_applications(search=None, status=None):
    params = {}
    if search:
        params['search'] = search
    if status:
        params['status'] = status
    
    response = requests.get(BASE_URL, params=params)
    return response.json()

# Add application
def add_application(app_data):
    response = requests.post(
        BASE_URL,
        json=app_data,
        headers={'Content-Type': 'application/json'}
    )
    return response.json()

# Usage
apps = get_applications(search="engineer", status="Applied")
print(f"Found {len(apps['data'])} applications")

new_app = {
    "employeeName": "John Doe",
    "jobRole": "Software Engineer",
    "clientName": "Google",
    "applicationUrl": "https://careers.google.com/jobs/123"
}

result = add_application(new_app)
if result['success']:
    print(f"✅ Added: {result['data']['id']}")
else:
    print(f"❌ Error: {result['error']}")
```

### Node.js (axios)

```javascript
const axios = require('axios');

const BASE_URL = 'https://script.google.com/macros/s/{ID}/exec';

// Get applications
async function getApplications(filters = {}) {
  try {
    const response = await axios.get(BASE_URL, { params: filters });
    return response.data;
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

// Add application
async function addApplication(appData) {
  try {
    const response = await axios.post(BASE_URL, appData);
    return response.data;
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

// Usage
(async () => {
  // Get filtered applications
  const apps = await getApplications({ 
    search: 'engineer',
    status: 'Applied' 
  });
  console.log(`Found ${apps.data.length} applications`);
  
  // Add new application
  const result = await addApplication({
    employeeName: "John Doe",
    jobRole: "Software Engineer",
    clientName: "Google",
    applicationUrl: "https://careers.google.com/jobs/123"
  });
  
  if (result.success) {
    console.log(`✅ Added: ${result.data.id}`);
  }
})();
```

### Chrome Extension Integration

```javascript
// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'trackJob') {
    const jobData = {
      employeeName: "Current User", // Get from Chrome storage
      jobRole: request.title,
      clientName: request.company,
      applicationUrl: request.url
    };
    
    fetch('https://script.google.com/macros/s/{ID}/exec', {
      method: 'POST',
      body: JSON.stringify(jobData)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: 'Job Tracked!',
          message: `${jobData.jobRole} at ${jobData.clientName}`
        });
      }
      sendResponse(data);
    });
    
    return true; // Async response
  }
});

// content.js - Inject on job sites
chrome.runtime.sendMessage({
  action: 'trackJob',
  title: document.querySelector('.job-title').textContent,
  company: document.querySelector('.company-name').textContent,
  url: window.location.href
});
```

---

## 🔒 Security Best Practices

### 1. Add Rate Limiting

```javascript
function checkRateLimit(userIdentifier) {
  const cache = CacheService.getUserCache();
  const key = `ratelimit_${userIdentifier}`;
  const count = parseInt(cache.get(key) || '0');
  
  if (count > 100) { // 100 requests per hour
    throw new Error('Rate limit exceeded');
  }
  
  cache.put(key, (count + 1).toString(), 3600);
}
```

### 2. Validate Input

```javascript
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .slice(0, 1000); // Limit length
}
```

### 3. Log API Usage

```javascript
function logApiCall(endpoint, params, userIp) {
  const logSheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    .getSheetByName('API_LOG');
  
  logSheet.appendRow([
    new Date(),
    endpoint,
    JSON.stringify(params),
    userIp || 'unknown'
  ]);
}
```

---

## 📈 Performance Tips

1. **Use Caching**: Always use cached responses for GET requests
2. **Pagination**: Request only what you need with `limit` parameter
3. **Specific Filters**: Use filters to reduce dataset size
4. **Batch Operations**: Use bulk endpoints for multiple records
5. **Off-Peak Hours**: Schedule heavy operations during low-usage times

---

## 🐛 Troubleshooting

### Common Issues

**Issue**: "Script function not found: doGet"
**Solution**: Ensure web app is deployed properly. Redeploy if needed.

**Issue**: CORS errors in browser
**Solution**: Google Apps Script handles CORS automatically. Ensure you're making requests to the correct deployment URL.

**Issue**: Slow response times
**Solution**: Enable caching in DataLayer, reduce data volume with filters.

**Issue**: "Authorization required"
**Solution**: Update web app deployment settings. Execute as: Me, Who has access: Anyone.

---

## 📞 Support

For API issues:
1. Check Apps Script execution logs
2. Verify deployment URL
3. Test with curl/Postman first
4. Check request/response format
5. Contact system administrator

---

**API Version**: 2.0  
**Last Updated**: June 10, 2026

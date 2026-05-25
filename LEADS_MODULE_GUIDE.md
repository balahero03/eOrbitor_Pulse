# Leads Module - Implementation Guide

## Overview

The Leads Module is fully functional with complete CRUD operations, filtering, search, and pagination. This guide covers all features and how to use/extend them.

---

## Features Implemented

### 1. Leads List Page (`/leads`)

**URL:** `http://localhost:3000/leads`

#### Features:
- **Table View** with 8 columns:
  - Name
  - Company
  - Email
  - Status (color-coded badge)
  - Source (color-coded badge)
  - Lead Score (with progress bar)
  - Assigned To
  - Actions (View, Delete)

#### Filters & Search:
```
Status Filter:  NEW, CONTACTED, QUALIFIED, REJECTED
Source Filter:  WEBSITE, REFERRAL, WALKIN, CALL, EMAIL, ADVERTISEMENT
Search:         By name, email, or company (simultaneous search)
```

#### Pagination:
- 20 items per page
- Previous/Next buttons
- Shows "X to Y of Z" results

#### Actions:
- **View:** Click to go to lead detail page
- **Delete:** Soft delete with confirmation
- **New Lead Button:** Top right to create new lead

### 2. Create Lead Form (`/leads/new`)

**URL:** `http://localhost:3000/leads/new`

#### Form Fields:
```
Basic Information:
  - Full Name * (required)
  - Email * (required)
  - Phone (optional)

Company Information:
  - Company Name * (required)

Lead Source:
  - Dropdown with 6 options:
    * Website
    * Referral
    * Walk-in
    * Phone Call
    * Email
    * Advertisement
```

#### Features:
- Form validation (required fields)
- Error messages
- Loading state during submission
- After creation: auto-redirect to detail page
- Cancel button to go back

### 3. Lead Detail Page (`/leads/:id`)

**URL:** `http://localhost:3000/leads/[id]`

#### Main Section (2/3 width):

**Lead Information:**
- Name (title)
- Email
- Phone
- Company
- Source

**Status & Qualification:**
- Current status badge
- Edit button (toggles inline editor)
- When editing:
  - Status dropdown (4 options)
  - BANT qualification notes textarea
  - Save/Cancel buttons
- Shows BANT notes if available

**Recent Follow-ups:**
- Shows last 5 follow-ups
- Type, date, and outcome
- Empty state if none exist

#### Sidebar (1/3 width):

**Lead Score:**
- Progress bar (0-100%)
- Numeric display

**Assigned To:**
- User avatar (initials)
- User name

**Created Date:**
- Original creation date

**Action Buttons:**
- "+ Add Follow-up" (placeholder for future)
- "Convert to Customer" (placeholder for future)

---

## API Endpoints

### GET /api/leads

**List leads with filtering and pagination**

```typescript
// Request
GET /api/leads?page=1&limit=20&status=NEW&source=WEBSITE&search=john

// Query Parameters:
page: number (default: 1)
limit: number (default: 20, max: 100)
status: string (NEW|CONTACTED|QUALIFIED|REJECTED)
source: string (WEBSITE|REFERRAL|WALKIN|CALL|EMAIL|ADVERTISEMENT)
search: string (searches name, email, company)

// Response:
{
  "leads": [
    {
      "id": "cuid",
      "name": "John Doe",
      "email": "john@company.com",
      "phone": "...",
      "company": "ABC Corp",
      "source": "WEBSITE",
      "status": "NEW",
      "leadScore": 45,
      "assignedTo": { "firstName": "...", "lastName": "..." },
      "createdAt": "2026-05-25T..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

### POST /api/leads

**Create new lead**

```typescript
// Request
POST /api/leads
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "John Doe",
  "email": "john@company.com",
  "phone": "+91 98765 43210",
  "company": "ABC Corp",
  "source": "WEBSITE"
}

// Response:
{
  "id": "cuid",
  "name": "John Doe",
  "email": "john@company.com",
  "phone": "+91 98765 43210",
  "company": "ABC Corp",
  "source": "WEBSITE",
  "status": "NEW",
  "leadScore": 0,
  "assignedTo": { "firstName": "...", "lastName": "..." },
  "createdAt": "2026-05-25T..."
}
```

### GET /api/leads/:id

**Get lead detail**

```typescript
// Request
GET /api/leads/cuid123
Authorization: Bearer {token}

// Response:
{
  "id": "cuid123",
  "name": "John Doe",
  "email": "john@company.com",
  "phone": "...",
  "company": "ABC Corp",
  "source": "WEBSITE",
  "status": "NEW",
  "leadScore": 45,
  "qualificationNotes": "Budget confirmed, need approval",
  "assignedTo": { 
    "id": "...",
    "firstName": "Admin",
    "lastName": "User"
  },
  "linkedCustomer": null,
  "followUps": [
    {
      "id": "...",
      "type": "CALL",
      "scheduledDate": "2026-05-26T...",
      "outcome": "Interested"
    }
  ],
  "createdAt": "2026-05-25T..."
}
```

### PATCH /api/leads/:id

**Update lead**

```typescript
// Request
PATCH /api/leads/cuid123
Content-Type: application/json
Authorization: Bearer {token}

{
  "status": "QUALIFIED",
  "qualificationNotes": "Budget: ₹500K, Authority: CFO, Need: CRM",
  "leadScore": 75
}

// Response: Updated lead object
```

### DELETE /api/leads/:id

**Delete lead (soft delete)**

```typescript
// Request
DELETE /api/leads/cuid123
Authorization: Bearer {token}

// Response:
{
  "message": "Lead deleted successfully"
}
```

---

## Color Coding

### Status Badges:
```
NEW:        Blue (#0066CC)
CONTACTED:  Yellow (#FF9900)
QUALIFIED:  Green (#00AA44)
REJECTED:   Red (#CC0000)
```

### Source Badges:
```
WEBSITE:       Purple
REFERRAL:      Indigo
WALKIN:        Pink
CALL:          Orange
EMAIL:         Default Gray
ADVERTISEMENT: Default Gray
```

---

## Usage Examples

### Example 1: Filter by Status
1. Go to `/leads`
2. Select "Qualified" from Status dropdown
3. Click "Search"
4. Shows only QUALIFIED leads

### Example 2: Search by Email
1. Go to `/leads`
2. Type in search box: "john@"
3. Click "Search"
4. Shows all leads with email containing "john@"

### Example 3: Create New Lead
1. Go to `/leads`
2. Click "+ New Lead" button
3. Fill form:
   - Name: "John Doe"
   - Email: "john@company.com"
   - Company: "ABC Corp"
   - Source: "Referral"
4. Click "Create Lead"
5. Redirect to lead detail page

### Example 4: Update Lead Status
1. Go to `/leads/[id]`
2. Click "Edit" in Status section
3. Change status to "QUALIFIED"
4. Add notes: "Budget confirmed, ready to proceed"
5. Click "Save Changes"
6. Status updated immediately

---

## Database Schema

### Leads Table:
```prisma
model Lead {
  id                  String    @id @default(cuid())
  name                String
  email               String
  phone               String?
  company             String
  source              LeadSource
  status              LeadStatus @default(NEW)
  leadScore           Int @default(0)
  qualificationNotes  String?
  assignedToId        String
  assignedTo          User @relation(fields: [assignedToId], references: [id])
  nextFollowUp        DateTime?
  linkedCustomerId    String?
  linkedCustomer      Customer? @relation(fields: [linkedCustomerId], references: [id])
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  deletedAt           DateTime?
  
  followUps           FollowUp[]
  activityLogs        ActivityLog[]
}

enum LeadSource {
  WEBSITE
  REFERRAL
  WALKIN
  CALL
  EMAIL
  ADVERTISEMENT
}

enum LeadStatus {
  NEW
  CONTACTED
  QUALIFIED
  REJECTED
  CONVERTED
}
```

---

## Testing Checklist

- [ ] Create a new lead
- [ ] View lead list (all leads)
- [ ] Filter by status (NEW, CONTACTED, etc.)
- [ ] Filter by source (WEBSITE, REFERRAL, etc.)
- [ ] Search by name
- [ ] Search by email
- [ ] Search by company
- [ ] Pagination (go to page 2, 3, etc.)
- [ ] View lead detail
- [ ] Edit lead status
- [ ] Add qualification notes
- [ ] Delete lead (soft delete)
- [ ] Verify lead appears in table after creation
- [ ] Verify deleted lead is removed from list

---

## Future Enhancements

1. **Lead Scoring Algorithm:**
   - Auto-calculate score based on criteria
   - Increase score on interactions
   - Show scoring breakdown

2. **Bulk Operations:**
   - Multi-select leads
   - Bulk status update
   - Bulk delete with confirmation

3. **Lead Timeline:**
   - Show all activities chronologically
   - Comments and notes
   - Activity audit trail

4. **CSV Import/Export:**
   - Upload CSV to bulk create leads
   - Export filtered leads as CSV

5. **Lead Conversion:**
   - "Convert to Customer" button
   - Auto-create customer from lead
   - Move to Customers module

6. **Advanced Filtering:**
   - By score range
   - By assigned user
   - By created date range

7. **Follow-up Integration:**
   - Create follow-up from detail page
   - Schedule reminders
   - Track outcomes

8. **Email Integration:**
   - Send email to lead
   - Track email opens
   - Auto-create follow-up on reply

---

## Code Structure

```
app/(dashboard)/leads/
├── page.tsx           # List view with filters
├── new/
│   └── page.tsx       # Create lead form
└── [id]/
    └── page.tsx       # Lead detail page

app/api/leads/
├── route.ts           # GET (list), POST (create)
└── [id]/
    └── route.ts       # GET, PATCH, DELETE
```

---

## Notes for Developers

1. **Error Handling:** All endpoints return appropriate HTTP status codes
2. **Authentication:** All endpoints require JWT token in Authorization header
3. **Pagination:** Default 20 items, max 100 per request
4. **Soft Delete:** Deleted leads have `deletedAt` set but remain in database
5. **Lead Score:** Currently manual (can implement algorithm later)
6. **Assignment:** Defaults to current user if not specified

---

**Last Updated:** 2026-05-25  
**Status:** Phase 1 Complete ✅  
**Next Phase:** Customers Module

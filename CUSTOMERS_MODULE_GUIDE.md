# Customers Module - Implementation Guide

## Overview

The Customers Module is fully functional with complete CRUD operations, contact management, KPIs, and deal integration. This guide covers all features and how to use/extend them.

---

## Features Implemented

### 1. Customers List Page (`/customers`)

**URL:** `http://localhost:3000/customers`

#### Features:
- **Table View** with 7 columns:
  - Company Name
  - Industry (color-coded badge)
  - Annual Revenue (INR formatted)
  - Employee Count
  - Contacts Count (green badge)
  - Active Deals (orange badge if >0)
  - Actions (View, Delete)

#### Filters & Search:
```
Industry Filter: Technology, Healthcare, Finance, Manufacturing, Retail, Other
Search:         By company name or industry
```

#### Pagination:
- 20 items per page
- Previous/Next buttons
- Shows "X to Y of Z" results

#### Actions:
- **View:** Click to go to customer detail page
- **Delete:** Soft delete with confirmation
- **New Customer Button:** Top right to create new customer

### 2. Create Customer Form (`/customers/new`)

**URL:** `http://localhost:3000/customers/new`

#### Form Fields:
```
Company Information:
  - Company Name * (required)
  - Industry (dropdown with 6 options)
  - Website (optional, URL format)

Business Details:
  - Annual Revenue (optional, number)
  - Employee Count (optional, number)
```

#### Features:
- Form validation (required fields)
- Error messages
- Loading state during submission
- Auto-redirect to detail page on success
- Cancel button to go back

### 3. Customer Detail Page (`/customers/:id`)

**URL:** `http://localhost:3000/customers/[id]`

#### Main Section (2/3 width):

**Company Details:**
- Company name (title)
- Industry
- Website (clickable link)
- Annual Revenue (INR formatted)
- Employee Count

**Contact Management:**
- List all contacts with:
  - Name, Email, Phone
  - Role
  - Decision Maker indicator
- Add Contact button (toggles inline form)
- Edit contact (inline form)
- Delete contact with confirmation
- Form fields: First Name, Last Name, Email, Phone, Role dropdown, Decision Maker checkbox

**Recent Activity:**
- Activity logs (last 20)
- Action type and date
- Empty state if none exist

#### Sidebar (1/3 width):

**Active Deals:**
- Deal count badge
- Total deal value (INR formatted)
- List of active deals with stage

**Created Date:**
- Customer creation date

**Action Buttons:**
- "Edit Customer" (placeholder for future)
- "+ New Deal" (placeholder for future)

---

## API Endpoints

### GET /api/customers

**List customers with filtering and pagination**

```typescript
// Request
GET /api/customers?page=1&limit=20&industry=Technology&search=abc

// Query Parameters:
page: number (default: 1)
limit: number (default: 20, max: 100)
industry: string (Technology|Healthcare|Finance|Manufacturing|Retail|Other)
search: string (searches companyName, industry, contact emails)

// Response:
{
  "customers": [
    {
      "id": "cuid",
      "companyName": "ABC Corp",
      "industry": "Technology",
      "website": "https://abc.com",
      "annualRevenue": 1000000,
      "employeeCount": 50,
      "activeDealCount": 3,
      "contactCount": 5,
      "createdAt": "2026-05-25T..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

### POST /api/customers

**Create new customer**

```typescript
// Request
POST /api/customers
Content-Type: application/json
Authorization: Bearer {token}

{
  "companyName": "ABC Corp",
  "industry": "Technology",
  "website": "https://abc.com",
  "annualRevenue": 1000000,
  "employeeCount": 50
}

// Response:
{
  "id": "cuid",
  "companyName": "ABC Corp",
  "industry": "Technology",
  "website": "https://abc.com",
  "annualRevenue": 1000000,
  "employeeCount": 50,
  "createdAt": "2026-05-25T..."
}
```

### GET /api/customers/:id

**Get customer detail**

```typescript
// Request
GET /api/customers/cuid123
Authorization: Bearer {token}

// Response:
{
  "id": "cuid123",
  "companyName": "ABC Corp",
  "industry": "Technology",
  "website": "https://abc.com",
  "annualRevenue": 1000000,
  "employeeCount": 50,
  "contacts": [
    {
      "id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@abc.com",
      "phone": "+91 98765 43210",
      "role": "Manager",
      "isDecisionMaker": true,
      "createdAt": "2026-05-25T..."
    }
  ],
  "deals": [
    {
      "id": "...",
      "name": "Enterprise License",
      "stage": "NEGOTIATION",
      "value": 500000,
      "probability": 75
    }
  ],
  "activityLogs": [...],
  "createdAt": "2026-05-25T..."
}
```

### PATCH /api/customers/:id

**Update customer**

```typescript
// Request
PATCH /api/customers/cuid123
Content-Type: application/json
Authorization: Bearer {token}

{
  "companyName": "ABC Corp Updated",
  "industry": "Technology",
  "website": "https://new-abc.com",
  "annualRevenue": 1500000,
  "employeeCount": 75
}

// Response: Updated customer object
```

### DELETE /api/customers/:id

**Delete customer (soft delete)**

```typescript
// Request
DELETE /api/customers/cuid123
Authorization: Bearer {token}

// Response:
{
  "message": "Customer deleted successfully"
}
```

### GET /api/customers/:id/contacts

**List all contacts for customer**

```typescript
// Request
GET /api/customers/cuid123/contacts
Authorization: Bearer {token}

// Response:
{
  "contacts": [...]
}
```

### POST /api/customers/:id/contacts

**Add contact to customer**

```typescript
// Request
POST /api/customers/cuid123/contacts
Content-Type: application/json
Authorization: Bearer {token}

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@abc.com",
  "phone": "+91 98765 43210",
  "role": "Manager",
  "isDecisionMaker": true
}

// Response:
{
  "id": "contactId",
  "customerId": "cuid123",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@abc.com",
  "phone": "+91 98765 43210",
  "role": "Manager",
  "isDecisionMaker": true,
  "createdAt": "2026-05-25T..."
}
```

### PATCH /api/customers/:id/contacts/:contactId

**Update contact**

```typescript
// Request
PATCH /api/customers/cuid123/contacts/contactId
Content-Type: application/json
Authorization: Bearer {token}

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@newemail.com",
  "role": "Director",
  "isDecisionMaker": false
}

// Response: Updated contact object
```

### DELETE /api/customers/:id/contacts/:contactId

**Delete contact (soft delete)**

```typescript
// Request
DELETE /api/customers/cuid123/contacts/contactId
Authorization: Bearer {token}

// Response:
{
  "message": "Contact deleted successfully"
}
```

---

## Color Coding

### Industry Badges:
```
All Industries: Light Blue (#E0E7FF)
```

### Status Indicators:
```
Active Deals:     Orange (#FF9900)
No Deals:         Gray (#CCCCCC)
Contacts:         Green (#00AA44)
```

---

## Usage Examples

### Example 1: Create New Customer
1. Go to `/customers`
2. Click "+ New Customer" button
3. Fill form:
   - Company: "ABC Corp"
   - Industry: "Technology"
   - Website: "https://abc.com"
   - Annual Revenue: "1000000"
   - Employees: "50"
4. Click "Create Customer"
5. Redirect to customer detail page

### Example 2: Add Contact to Customer
1. Go to `/customers/[id]`
2. Click "+ Add Contact" button
3. Fill form:
   - First Name: "John"
   - Last Name: "Doe"
   - Email: "john@abc.com"
   - Role: "Manager"
   - Check "Is Decision Maker"
4. Click "Add Contact"
5. Contact added to list

### Example 3: Link Lead to Customer
When a lead is converted to customer:
1. Go to lead detail page
2. Click "Convert to Customer"
3. Select existing customer OR create new one
4. Lead status updates to CONVERTED
5. Lead linked to customer

### Example 4: View Customer KPIs
1. Go to `/customers/[id]`
2. Sidebar shows:
   - Active Deals count
   - Total deal value (INR)
   - Deal list with stages
3. Main section shows contacts and activity

---

## Database Schema

### Customers Table:
```prisma
model Customer {
  id              String    @id @default(cuid())
  companyName     String
  industry        String
  website         String?
  annualRevenue   Int?
  employeeCount   Int?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?
  
  // Relations
  contacts        Contact[]
  deals           Deal[]
  activityLogs    ActivityLog[]
}
```

### Contacts Table:
```prisma
model Contact {
  id              String    @id @default(cuid())
  customerId      String
  customer        Customer  @relation(fields: [customerId], references: [id])
  firstName       String
  lastName        String
  email           String
  phone           String?
  role            String
  isDecisionMaker Boolean   @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?
}
```

---

## Testing Checklist

- [ ] Create a new customer
- [ ] View customer list (all customers)
- [ ] Filter by industry
- [ ] Search by company name
- [ ] Search by industry
- [ ] Pagination (go to page 2, 3, etc.)
- [ ] View customer detail
- [ ] Add contact to customer
- [ ] Edit contact
- [ ] Delete contact
- [ ] View customer KPIs (deals, revenue)
- [ ] Delete customer (soft delete)
- [ ] Verify customer appears in list after creation
- [ ] Verify deleted customer is removed from list
- [ ] View linked deals on customer detail

---

## Future Enhancements

1. **Customer Timeline:**
   - Show all activities chronologically
   - Comments and notes
   - Activity audit trail

2. **Bulk Operations:**
   - Multi-select customers
   - Bulk tag assignment
   - Bulk email sending

3. **Customer Segmentation:**
   - By revenue range
   - By industry
   - By deal stage distribution
   - Custom segments

4. **Communication History:**
   - Email history per customer
   - Call logs
   - Meeting notes
   - Auto-sync from email integration

5. **Customer Health Score:**
   - Auto-calculated from deal activity
   - Interaction frequency
   - Payment history
   - NPS score

6. **Contact Hierarchy:**
   - Primary contact designation
   - Department mapping
   - Reporting structure visualization

7. **Document Management:**
   - Store agreements
   - SOWs and contracts
   - NDA tracking
   - Document versioning

8. **Integration with Leads:**
   - Bulk convert multiple leads to customer
   - Link existing leads to customer
   - Merge duplicate customers

---

## Code Structure

```
app/(dashboard)/customers/
├── page.tsx              # List view with filters
├── new/
│   └── page.tsx          # Create customer form
└── [id]/
    └── page.tsx          # Customer detail page

app/api/customers/
├── route.ts              # GET (list), POST (create)
└── [id]/
    ├── route.ts          # GET, PATCH, DELETE customer
    └── contacts/
        ├── route.ts      # GET, POST contacts
        └── [contactId]/
            └── route.ts  # PATCH, DELETE contact
```

---

## Notes for Developers

1. **Soft Delete:** Deleted customers/contacts have `deletedAt` set but remain in database
2. **Contact Management:** All CRUD operations for contacts happen within customer context
3. **Deal Integration:** Deals are shown on customer detail, synced from Deal model
4. **Activity Logs:** Auto-created when customers/contacts are modified
5. **Currency:** All currency displayed in INR with proper formatting
6. **Decision Makers:** Flag contacts as decision makers for sales targeting

---

**Last Updated:** 2026-05-25  
**Status:** Phase 2 Complete ✅  
**Next Phase:** Sales Pipeline Module

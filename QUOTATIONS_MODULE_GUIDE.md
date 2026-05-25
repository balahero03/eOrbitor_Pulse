# Quotations Module - Implementation Guide

## Overview

The Quotations Module is fully functional with quote creation, product selection, dynamic tax calculation, and approval workflow. This guide covers all features and how to use/extend them.

---

## Features Implemented

### 1. Quotations List Page (`/quotations`)

**URL:** `http://localhost:3000/quotations`

#### Features:
- **Table View** with 7 columns:
  - Quotation Number
  - Customer Company Name
  - Deal Name
  - Total Amount (INR formatted)
  - Status (color-coded badge)
  - Issue Date
  - Actions (View, Delete)

#### Filters & Search:
```
Status Filter:  DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED
Search:         By quotation number or customer company
```

#### Pagination:
- 20 items per page
- Previous/Next buttons
- Shows "X to Y of Z" results

#### Status Colors:
- DRAFT: Gray
- SENT: Blue
- ACCEPTED: Green
- REJECTED: Red
- EXPIRED: Orange

#### Actions:
- **View:** Click to go to quotation detail page
- **Delete:** Delete quotation with confirmation
- **New Quotation Button:** Top right to create new quotation

### 2. Create Quotation Form (`/quotations/new`)

**URL:** `http://localhost:3000/quotations/new`

#### Form Fields:
```
Deal Information:
  - Deal * (required, dropdown)
  - Customer (auto-filled from deal)

Products & Items:
  - Add Product button (opens search)
  - Product search (by name or SKU)
  - Items table showing:
    * Product name
    * Quantity (editable)
    * Unit Price (editable)
    * Tax % (from product)
    * Total (calculated)
    * Delete button

Notes:
  - Optional notes field
```

#### Features:
- Form validation (deal, customer, and items required)
- Dynamic product search
- Editable quantities and prices
- Automatic tax calculation per item
- Real-time total calculation
- Subtotal, tax, and grand total display
- Loading state during submission
- Auto-redirect to detail page on success
- Cancel button to go back

#### Summary Sidebar:
- Subtotal (sum of line items)
- Tax Amount (calculated from product tax rates)
- Total (subtotal + tax)
- Item count

### 3. Quotation Detail Page (`/quotations/:id`)

**URL:** `http://localhost:3000/quotations/[id]`

#### Main Section (2/3 width):

**Header Information:**
- Quotation number (title)
- Customer name
- Deal name
- Issue date
- Status badge (color-coded)

**Items Table:**
- Product name
- Quantity
- Unit price (INR formatted)
- Tax percentage
- Total amount per line (with tax)

**Totals Section:**
- Subtotal
- Tax amount
- Total amount (bold, large)

**Notes:**
- Display quotation notes if present

#### Sidebar (1/3 width):

**Actions:**
- "Send Quotation" (for DRAFT status)
- "Accept Quotation" (for SENT status)
- "Reject" (for SENT status)
- "Edit" (for DRAFT status)
- "Delete" button

**Details:**
- Sent at (if applicable)
- Expiry date (if set)
- Created by (user name)
- Created date

**Links:**
- "View Customer" (link to customer detail)
- "View Deal" (link to deal detail)

---

## API Endpoints

### GET /api/quotations

**List quotations with filtering and pagination**

```typescript
// Request
GET /api/quotations?page=1&limit=20&status=DRAFT&search=qt-

// Query Parameters:
page: number (default: 1)
limit: number (default: 20, max: 100)
status: string (DRAFT|SENT|ACCEPTED|REJECTED|EXPIRED)
search: string (searches quotationNumber, customer company)

// Response:
{
  "quotations": [
    {
      "id": "cuid",
      "quotationNumber": "QT-2026-00001",
      "status": "DRAFT",
      "customer": { "id": "...", "companyName": "ABC Corp" },
      "deal": { "dealName": "Enterprise License Q3" },
      "subtotal": "100000",
      "taxAmount": "18000",
      "totalAmount": "118000",
      "issueDate": "2026-05-25T...",
      "expiryDate": "2026-06-25T...",
      "createdBy": { "firstName": "John", "lastName": "Doe" },
      "createdAt": "2026-05-25T..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "pages": 1
  }
}
```

### POST /api/quotations

**Create new quotation**

```typescript
// Request
POST /api/quotations
Content-Type: application/json
Authorization: Bearer {token}

{
  "dealId": "cuid123",
  "customerId": "cuid456",
  "items": [
    {
      "productId": "prod001",
      "quantity": 2,
      "unitPrice": 50000
    },
    {
      "productId": "prod002",
      "quantity": 1,
      "unitPrice": 25000
    }
  ],
  "notes": "Terms: Net 30, Delivery in 2 weeks"
}

// Response:
{
  "id": "cuid",
  "quotationNumber": "QT-2026-00001",
  "status": "DRAFT",
  "dealId": "cuid123",
  "customerId": "cuid456",
  "items": [...],
  "subtotal": "125000",
  "taxAmount": "22500",
  "totalAmount": "147500",
  "issueDate": "2026-05-25T...",
  "notes": "Terms: Net 30, Delivery in 2 weeks",
  "revision": 1,
  "createdById": "userId",
  "customer": { "companyName": "ABC Corp" },
  "deal": { "dealName": "Enterprise License Q3" },
  "createdBy": { "firstName": "John", "lastName": "Doe" },
  "createdAt": "2026-05-25T..."
}
```

### GET /api/quotations/:id

**Get quotation detail**

```typescript
// Request
GET /api/quotations/cuid123
Authorization: Bearer {token}

// Response:
{
  "id": "cuid123",
  "quotationNumber": "QT-2026-00001",
  "status": "DRAFT",
  "customer": {
    "id": "...",
    "companyName": "ABC Corp"
  },
  "deal": {
    "id": "...",
    "dealName": "Enterprise License Q3"
  },
  "items": [
    {
      "productId": "prod001",
      "quantity": 2,
      "unitPrice": 50000
    }
  ],
  "subtotal": "100000",
  "taxAmount": "18000",
  "totalAmount": "118000",
  "notes": "...",
  "issueDate": "2026-05-25T...",
  "expiryDate": "2026-06-25T...",
  "sentAt": null,
  "approvedAt": null,
  "revision": 1,
  "createdBy": { "firstName": "John", "lastName": "Doe" },
  "orders": [],
  "createdAt": "2026-05-25T..."
}
```

### PATCH /api/quotations/:id

**Update quotation**

```typescript
// Request
PATCH /api/quotations/cuid123
Content-Type: application/json
Authorization: Bearer {token}

{
  "status": "DRAFT",
  "notes": "Updated terms",
  "items": [
    {
      "productId": "prod001",
      "quantity": 3,
      "unitPrice": 55000
    }
  ]
}

// Response: Updated quotation object (with incremented revision)
```

### DELETE /api/quotations/:id

**Delete quotation**

```typescript
// Request
DELETE /api/quotations/cuid123
Authorization: Bearer {token}

// Response:
{
  "message": "Quotation deleted successfully"
}
```

### POST /api/quotations/:id/send

**Send quotation to customer**

```typescript
// Request
POST /api/quotations/cuid123/send
Authorization: Bearer {token}

// Response:
{
  "id": "cuid123",
  "quotationNumber": "QT-2026-00001",
  "status": "SENT",
  "sentAt": "2026-05-25T...",
  ...
}
```

### POST /api/quotations/:id/approve

**Approve/accept quotation**

```typescript
// Request
POST /api/quotations/cuid123/approve
Authorization: Bearer {token}

// Response:
{
  "id": "cuid123",
  "quotationNumber": "QT-2026-00001",
  "status": "ACCEPTED",
  "approvedAt": "2026-05-25T...",
  "approvedById": "userId",
  ...
}
```

### GET /api/products

**Get available products for quotation**

```typescript
// Request
GET /api/products?search=license&category=software

// Query Parameters:
search: string (searches name, SKU)
category: string (product category)

// Response:
{
  "products": [
    {
      "id": "prod001",
      "sku": "LIC-001",
      "name": "Enterprise License",
      "category": "Software",
      "basePrice": "50000",
      "tax": "18",
      "inventory": { "quantity": 100 }
    }
  ]
}
```

---

## Quotation Status Workflow

```
DRAFT
  ↓
  ├→ SENT (send to customer)
  │   ├→ ACCEPTED (customer approves)
  │   ├→ REJECTED (customer rejects)
  │   └→ EXPIRED (expiry date passed)
  └→ DELETE (cancel before sending)
```

### Status Meanings:
- **DRAFT** - Quote being prepared, not sent to customer
- **SENT** - Quote sent to customer, awaiting response
- **ACCEPTED** - Customer accepted quote, ready to create order
- **REJECTED** - Customer rejected quote
- **EXPIRED** - Quote past expiry date, no longer valid

---

## Tax Calculation

### Formula:
```
Line Total = Quantity × Unit Price
Line Tax = Line Total × (Product Tax % ÷ 100)
Line Grand Total = Line Total + Line Tax

Quotation Subtotal = Sum of all Line Totals
Quotation Tax Amount = Sum of all Line Taxes
Quotation Grand Total = Subtotal + Tax Amount
```

### Example:
```
Product: Enterprise License
Tax Rate: 18% (GST)
Quantity: 2
Unit Price: ₹50,000

Line Total: 2 × ₹50,000 = ₹100,000
Line Tax: ₹100,000 × (18 ÷ 100) = ₹18,000
Line Grand Total: ₹100,000 + ₹18,000 = ₹118,000
```

---

## Usage Examples

### Example 1: Create Quotation
1. Go to `/quotations`
2. Click "+ New Quotation" button
3. Select deal (auto-fills customer)
4. Click "Add Product" button
5. Search and select product (e.g., "Enterprise License")
6. Set quantity and adjust price if needed
7. Add more products if needed
8. View summary on right sidebar
9. Add notes (optional)
10. Click "Create Quotation"
11. Redirect to quotation detail page

### Example 2: Send Quotation
1. Go to quotation detail page (status: DRAFT)
2. Click "Send Quotation" button
3. Status changes to SENT
4. sentAt timestamp is recorded
5. Email can be sent to customer (future enhancement)

### Example 3: Accept Quotation
1. On quotation detail page (status: SENT)
2. Click "Accept Quotation" button
3. Status changes to ACCEPTED
4. Quotation can now be converted to order

### Example 4: Edit & Update Quotation
1. Go to quotation detail page (status: DRAFT)
2. Click "Edit" button
3. Modify product quantities, prices, or add/remove items
4. Click "Save Changes"
5. Revision number increments
6. Changes saved to database

---

## Database Schema

### Quotation Model:
```prisma
model Quotation {
  id            String    @id @default(cuid())
  dealId        String
  deal          Deal      @relation(fields: [dealId], references: [id])
  quotationNumber String @unique
  customerId    String
  customer      Customer  @relation(fields: [customerId], references: [id])
  status        QuotationStatus @default(DRAFT)
  issueDate     DateTime
  expiryDate    DateTime?
  items         Json      // Array of items
  subtotal      Decimal   // Sum of line items
  taxAmount     Decimal   // Calculated tax
  discountAmount Decimal  // For future use
  totalAmount   Decimal   // Grand total
  notes         String?
  pdfUrl        String?   // For PDF generation
  sentAt        DateTime?
  approvedById  String?
  approvedAt    DateTime?
  createdById   String
  createdBy     User      @relation(fields: [createdById], references: [id])
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  revision      Int       @default(1) // Version tracking
  
  orders        Order[]
  activityLogs  ActivityLog[]
}

enum QuotationStatus {
  DRAFT
  SENT
  ACCEPTED
  REJECTED
  EXPIRED
}
```

---

## Key Features

### Dynamic Tax Calculation:
- Product tax rates fetched from Product model
- Tax calculated per line item
- Supports variable tax rates for different products (e.g., 5%, 12%, 18% GST)

### Revision Tracking:
- Each update increments revision number
- Allows version history without duplicating quotations
- Important for audit trail

### Quotation Numbering:
- Auto-generated format: `QT-YYYY-XXXXX`
- Example: `QT-2026-00001`, `QT-2026-00002`
- Unique constraint prevents duplicates

### Product Selection:
- Dynamic product search by name or SKU
- Fetches active products only
- Shows inventory levels
- Editable quantities and prices per quotation

---

## Testing Checklist

- [ ] Create a new quotation
- [ ] View quotations list (all quotations)
- [ ] Filter by status (DRAFT, SENT, etc.)
- [ ] Search by quotation number
- [ ] Search by customer company
- [ ] Pagination (go to page 2, etc.)
- [ ] Add single product to quotation
- [ ] Add multiple products
- [ ] Edit quantities and prices
- [ ] Verify tax calculation (18% GST test)
- [ ] Verify total calculation
- [ ] View quotation detail
- [ ] Send quotation (status changes to SENT)
- [ ] Accept quotation (status changes to ACCEPTED)
- [ ] Delete quotation (soft delete)
- [ ] Verify quotation removed from list
- [ ] Edit quotation and verify revision increments
- [ ] Check created by and creation date display

---

## Future Enhancements

1. **PDF Generation:**
   - Generate PDF quotation
   - Email PDF to customer
   - Store PDF URL

2. **Discount Management:**
   - Line item discounts
   - Quotation-level discount
   - Automatic discount rules

3. **Expiry Automation:**
   - Auto-expire quotations past expiry date
   - Send reminder emails before expiry
   - Automatic status update to EXPIRED

4. **Approval Workflow:**
   - Multi-level approval (manager, director)
   - Approval comments
   - Approval history

5. **Currency Support:**
   - Multi-currency quotations
   - Automatic currency conversion
   - Currency symbol display

6. **Template System:**
   - Save quotation templates
   - Auto-populate from templates
   - Reuse for similar deals

7. **Integration:**
   - Convert ACCEPTED quotation to Order
   - Sync with email (send via email)
   - Calendar integration (expiry reminders)

8. **Analytics:**
   - Quotation-to-order conversion rate
   - Average quotation value
   - Time to acceptance metrics

---

## Code Structure

```
app/(dashboard)/quotations/
├── page.tsx           # List view with filters
├── new/
│   └── page.tsx       # Create quotation form
└── [id]/
    └── page.tsx       # Quotation detail page

app/api/quotations/
├── route.ts           # GET (list), POST (create)
└── [id]/
    ├── route.ts       # GET, PATCH, DELETE
    ├── send/
    │   └── route.ts   # POST (send to customer)
    └── approve/
        └── route.ts   # POST (approve/accept)

app/api/products/
└── route.ts           # GET (list active products)
```

---

## Notes for Developers

1. **Auto-calculation:** Taxes and totals calculated on backend
2. **Product Tax:** Each product has tax percentage stored
3. **Dynamic Search:** Product search real-time with results
4. **Revision Control:** Updates increment revision, maintain history
5. **Status Workflow:** Status changes validated (only allowed transitions)
6. **Currency:** All amounts in INR, formatted with rupee symbol
7. **JSON Storage:** Items stored as JSON array for flexibility

---

**Last Updated:** 2026-05-25  
**Status:** Phase 4 Complete ✅  
**Next Phase:** Orders Module

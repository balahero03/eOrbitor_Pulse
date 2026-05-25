# Sales Pipeline Module - Implementation Guide

## Overview

The Sales Pipeline Module is fully functional with Kanban board visualization, drag-drop deal management, and SPANCO stage progression. This guide covers all features and how to use/extend them.

---

## Features Implemented

### 1. Sales Pipeline Kanban Board (`/pipeline`)

**URL:** `http://localhost:3000/pipeline`

#### Features:
- **Kanban Board** with 6 SPANCO stages (columns):
  - SUSPECT (Blue) - Lead generation
  - PROSPECT (Cyan) - Lead qualification
  - APPROACH (Indigo) - Initial contact
  - NEGOTIATION (Yellow) - Quotation & proposal
  - CLOSURE (Green) - Order & payment
  - ONGOING (Purple) - Post-sales support

#### Deal Cards:
Each deal card displays:
- Deal name (clickable link to detail)
- Customer company name
- Deal value (INR formatted)
- Win probability badge (color-coded: Red <25%, Orange 25-50%, Yellow 50-75%, Green >75%)
- Expected closure date (if set)
- Delete action

#### Stage Information:
Each column header shows:
- Number of deals in stage
- Total deal value for stage (INR formatted)
- Average win probability for stage

#### Drag-and-Drop:
- Drag any deal card between stages
- Real-time stage update
- Automatic API sync

#### Search:
- Search by deal name or customer company
- Real-time filtering

#### Actions:
- "+ New Deal" button to create new deal
- Delete button on each card

### 2. Create Deal Form (`/pipeline/new`)

**URL:** `http://localhost:3000/pipeline/new`

#### Form Fields:
```
Deal Information:
  - Deal Name * (required)
  - Customer * (required, dropdown)
  - Deal Value * (required, number)
  - Win Probability % (optional, 0-100)

Pipeline Stage:
  - Current Stage (default: SUSPECT)
  - Expected Closure Date (optional, date picker)
```

#### Features:
- Form validation (required fields)
- Customer dropdown (fetches all customers)
- Error messages
- Loading state during submission
- Auto-redirect to detail page on success
- Cancel button to go back

### 3. Deal Detail Page (`/pipeline/:id`)

**URL:** `http://localhost:3000/pipeline/[id]`

#### Main Section (2/3 width):

**Deal Details:**
- Deal name
- Customer company name
- Deal value (INR formatted)
- Win probability (color-coded badge)
- Expected closure date
- Edit button (toggles inline editor)
- When editing:
  - Deal name input
  - Win probability slider (0-100%)
  - Closure date picker
  - Notes textarea
  - Save/Cancel buttons
- Shows notes if available

**Recent Activity:**
- Activity logs (last 10 entries)
- Action type and date
- Empty state if none exist

#### Sidebar (1/3 width):

**Pipeline Stage:**
- Dropdown to change deal stage
- Real-time stage transition

**Deal Info:**
- Created by (user name)
- Created date
- Expected revenue (value × probability%)

**Action Buttons:**
- "View Customer" (link to customer detail)
- "Delete Deal" (soft delete with confirmation)

---

## API Endpoints

### GET /api/deals

**List deals with filtering and pagination**

```typescript
// Request
GET /api/deals?page=1&limit=20&stage=NEGOTIATION&search=enterprise

// Query Parameters:
page: number (default: 1)
limit: number (default: 20, max: 100)
stage: string (SUSPECT|PROSPECT|APPROACH|NEGOTIATION|CLOSURE|ONGOING)
search: string (searches name, customer company)

// Response:
{
  "deals": [
    {
      "id": "cuid",
      "name": "Enterprise License Q3",
      "stage": "NEGOTIATION",
      "value": 500000,
      "probability": 75,
      "customer": { "id": "...", "companyName": "ABC Corp" },
      "createdBy": { "firstName": "John", "lastName": "Doe" },
      "expectedClosureDate": "2026-08-31T...",
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

### POST /api/deals

**Create new deal**

```typescript
// Request
POST /api/deals
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Enterprise License Q3",
  "customerId": "cuid123",
  "value": 500000,
  "probability": 75,
  "stage": "SUSPECT",
  "expectedClosureDate": "2026-08-31"
}

// Response:
{
  "id": "cuid",
  "name": "Enterprise License Q3",
  "customerId": "cuid123",
  "value": 500000,
  "probability": 75,
  "stage": "SUSPECT",
  "expectedClosureDate": "2026-08-31T...",
  "createdById": "userId",
  "customer": { "companyName": "ABC Corp" },
  "createdBy": { "firstName": "John", "lastName": "Doe" },
  "createdAt": "2026-05-25T..."
}
```

### GET /api/deals/:id

**Get deal detail**

```typescript
// Request
GET /api/deals/cuid123
Authorization: Bearer {token}

// Response:
{
  "id": "cuid123",
  "name": "Enterprise License Q3",
  "stage": "NEGOTIATION",
  "value": 500000,
  "probability": 75,
  "notes": "Budget approved, awaiting sign-off",
  "customer": {
    "id": "...",
    "companyName": "ABC Corp",
    ...
  },
  "createdBy": { "firstName": "John", "lastName": "Doe" },
  "expectedClosureDate": "2026-08-31T...",
  "activityLogs": [...],
  "createdAt": "2026-05-25T..."
}
```

### PATCH /api/deals/:id

**Update deal**

```typescript
// Request
PATCH /api/deals/cuid123
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Enterprise License Q3 2026",
  "probability": 85,
  "notes": "Budget approved, awaiting sign-off",
  "expectedClosureDate": "2026-08-31"
}

// Response: Updated deal object
```

### DELETE /api/deals/:id

**Delete deal (soft delete)**

```typescript
// Request
DELETE /api/deals/cuid123
Authorization: Bearer {token}

// Response:
{
  "message": "Deal deleted successfully"
}
```

### POST /api/deals/:id/move

**Move deal to different stage**

```typescript
// Request
POST /api/deals/cuid123/move
Content-Type: application/json
Authorization: Bearer {token}

{
  "newStage": "NEGOTIATION"
}

// Response: Updated deal object with new stage
```

---

## SPANCO Stages

The pipeline follows 6 business phases:

1. **SUSPECT** - Lead generation
   - New leads just captured
   - No qualification yet
   - Initial interest exploration

2. **PROSPECT** - Lead qualification
   - BANT analysis complete
   - Decision makers identified
   - Budget confirmed

3. **APPROACH** - Initial contact
   - First meeting/call scheduled
   - Needs assessment underway
   - Solution being scoped

4. **NEGOTIATION** - Quotation & proposal
   - Proposal sent to customer
   - Price negotiation ongoing
   - Terms being finalized

5. **CLOSURE** - Order & payment
   - Deal won and agreed
   - Order in process
   - Payment terms set

6. **ONGOING** - Post-sales support
   - Customer implementation
   - Support and adoption
   - Renewal pipeline

---

## Color Coding

### Stage Colors:
```
SUSPECT:      Blue (#E3F2FD)
PROSPECT:     Cyan (#E0F7FA)
APPROACH:     Indigo (#EDE7F6)
NEGOTIATION:  Yellow (#FFFDE7)
CLOSURE:      Green (#E8F5E9)
ONGOING:      Purple (#F3E5F5)
```

### Probability Colors:
```
0-25%:    Red (#FEE)
25-50%:   Orange (#FFE8CC)
50-75%:   Yellow (#FFFACD)
75-100%:  Green (#E8F5E9)
```

---

## Usage Examples

### Example 1: Create New Deal
1. Go to `/pipeline`
2. Click "+ New Deal" button
3. Fill form:
   - Deal Name: "Enterprise License Q3 2026"
   - Customer: "ABC Corp"
   - Deal Value: "500000"
   - Win Probability: "75"
   - Stage: "SUSPECT"
   - Closure Date: "2026-08-31"
4. Click "Create Deal"
5. Redirect to deal detail page

### Example 2: Move Deal Between Stages
1. Go to `/pipeline`
2. Drag deal card from SUSPECT to PROSPECT
3. Card automatically updates stage
4. API call updates database

### Example 3: Update Deal Details
1. Go to `/pipeline/[id]`
2. Click "Edit" button
3. Change probability, closure date, or notes
4. Click "Save Changes"
5. Deal updated immediately

### Example 4: View Expected Revenue
On deal detail page sidebar:
- Expected Revenue = Deal Value × (Probability ÷ 100)
- Example: ₹500,000 × (75 ÷ 100) = ₹375,000

---

## Database Schema

### Deals Table:
```prisma
model Deal {
  id                  String    @id @default(cuid())
  name                String
  customerId          String
  customer            Customer  @relation(fields: [customerId], references: [id])
  value               Int
  probability         Int       @default(50)
  stage               String    @default("SUSPECT")
  notes               String?
  expectedClosureDate DateTime?
  createdById         String
  createdBy           User      @relation(fields: [createdById], references: [id])
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  deletedAt           DateTime?
  
  activityLogs        ActivityLog[]
}
```

---

## Kanban Board Statistics

### Per Stage (shown in column header):
- **Deals:** Count of deals in stage
- **Value:** Sum of all deal values in stage (INR)
- **Avg Prob:** Average probability of all deals in stage

### Overall Pipeline:
- Total pipeline value = Sum of all deal values
- Weighted forecast = Sum of (deal value × probability%)
- Average deal size = Total value ÷ number of deals

---

## Testing Checklist

- [ ] Create a new deal
- [ ] View pipeline Kanban board
- [ ] Drag deal from SUSPECT to PROSPECT
- [ ] Drag deal from PROSPECT to APPROACH
- [ ] Drag deal through all 6 stages
- [ ] Verify stage updates in real-time
- [ ] Search by deal name
- [ ] Search by customer company
- [ ] View deal detail page
- [ ] Edit deal (name, probability, notes)
- [ ] Change deal stage from detail page dropdown
- [ ] View expected revenue calculation
- [ ] Delete deal with confirmation
- [ ] Verify deal removed from Kanban
- [ ] Verify stage statistics update after move
- [ ] Test with multiple deals in one stage
- [ ] Test with empty stages
- [ ] Verify color coding on probability badges

---

## Future Enhancements

1. **Deal Timeline:**
   - Show deal progression through stages
   - Time spent in each stage
   - Stage velocity metrics

2. **Sales Forecasting:**
   - Month/quarter revenue forecast
   - Pipeline analysis by stage
   - Win rate trending

3. **Deal Notes & Collaboration:**
   - Add notes to deals
   - Comment on deals
   - @mention team members
   - Activity feed

4. **Deal Linked Items:**
   - Link quotations to deals
   - Link orders to deals
   - Link tasks/follow-ups to deals
   - Show related documents

5. **Bulk Operations:**
   - Multi-select deals
   - Bulk stage move
   - Bulk delete
   - Bulk probability update

6. **Deal Templates:**
   - Pre-set deal names/values
   - Auto-populate fields
   - Quick deal creation

7. **Advanced Filtering:**
   - Filter by probability range
   - Filter by value range
   - Filter by closure date
   - Filter by owner
   - Filter by customer

8. **Integration:**
   - Sync with email
   - Calendar integration
   - Slack notifications
   - Email notifications on stage change

---

## Code Structure

```
app/(dashboard)/pipeline/
├── page.tsx           # Kanban board view
├── new/
│   └── page.tsx       # Create deal form
└── [id]/
    └── page.tsx       # Deal detail page

app/api/deals/
├── route.ts           # GET (list), POST (create)
└── [id]/
    ├── route.ts       # GET, PATCH, DELETE
    └── move/
        └── route.ts   # POST (move to stage)
```

---

## Notes for Developers

1. **Drag-Drop:** Implemented with native HTML5 drag events (no external library)
2. **Real-time Updates:** Kanban updates immediately, syncs to database via API
3. **Soft Delete:** Deleted deals have `deletedAt` set but remain in database
4. **Stage Validation:** Only valid SPANCO stages allowed (6 stages)
5. **Probability:** Range 0-100%, affects expected revenue calculation
6. **Currency:** All values displayed in INR with proper formatting
7. **Expected Revenue:** Calculated as (value × probability%) for forecasting

---

**Last Updated:** 2026-05-25  
**Status:** Phase 3 Complete ✅  
**Next Phase:** Quotations Module

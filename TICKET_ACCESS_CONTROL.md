# Support Ticket Access Control

## Overview
Implemented role-based access control for support tickets. Only Admins and Support staff can view all tickets. Regular users can only create tickets and track their own ticket status.

## Role-Based Permissions

### SUPER_ADMIN & ADMIN
- ✅ View all support tickets (page: `/support`)
- ✅ Create tickets
- ✅ View ticket details
- ✅ Edit any ticket (status, priority, notes, etc.)
- ✅ Assign tickets to support staff
- ✅ Delete tickets
- ✅ Access full ticket listing with filters

### SUPPORT
- ✅ View support tickets page (`/support`)
  - Shows only tickets assigned to them
- ✅ Create tickets
- ✅ View assigned tickets and tickets they created
- ✅ Edit tickets assigned to them
- ✅ Resolve/close assigned tickets
- ❌ Cannot edit tickets not assigned to them

### SALES_EXEC, SALES_MANAGER, VIEWER
- ❌ Cannot access `/support` (main support page)
- ✅ Can access `/support/new` to create tickets
- ✅ Can access `/support/my-tickets` to view their own tickets
- ✅ Can see status of tickets they created
- ✅ Can update description/notes on their own tickets
- ❌ Cannot view other users' tickets
- ❌ Cannot edit ticket status, priority, assignment

## Implementation Details

### Navigation Changes
**File:** `app/(dashboard)/layout.tsx`

- Support users (SUPER_ADMIN, ADMIN, SUPPORT) see: "Support Tickets" → `/support`
- Regular users (SALES_EXEC, SALES_MANAGER, VIEWER) see: "My Tickets" → `/support/my-tickets`

### Frontend Pages

#### 1. Support Tickets Page (`/support`)
- **Access:** SUPER_ADMIN, ADMIN, SUPPORT only
- **Display:** Access denied message for unauthorized users
- **Features:**
  - View all tickets (admins) or assigned tickets (support)
  - Filter by status, priority
  - Search functionality
  - KPI cards (total, open, urgent, resolved)
  - Pagination

#### 2. My Tickets Page (`/support/my-tickets`)
- **Access:** All users (SALES_EXEC, SALES_MANAGER, VIEWER)
- **Features:**
  - View only tickets they created
  - Filter by status
  - See ticket assignments and progress
  - Create new tickets
  - Pagination

#### 3. Create Ticket (`/support/new`)
- **Access:** All users
- **Features:**
  - Create new support tickets
  - Select customer and related deal
  - Set priority and type
  - Admins can assign to specific support staff
  - Regular users tickets auto-assign to themselves

#### 4. Ticket Detail (`/support/[id]`)
- **Access:**
  - SUPER_ADMIN, ADMIN: view all
  - SUPPORT: view if assigned
  - Creators: view own tickets (read-only)
- **Edit capabilities:**
  - Admins: full edit access
  - Support: edit if assigned
  - Creators: read-only

### API Endpoints

#### GET `/api/tickets` (List)
- **Authorization:** SUPER_ADMIN, ADMIN, SUPPORT only
- **Returns:** 403 Forbidden if user lacks permission
- **Filtering:**
  - Admins: all tickets
  - Support: only assigned tickets

#### GET `/api/tickets/my-tickets` (My Tickets)
- **Authorization:** All authenticated users
- **Returns:** Tickets created by current user
- **Purpose:** Self-service ticket tracking

#### GET `/api/tickets/[id]` (Detail)
- **Authorization:** All users
- **Permission checks:**
  - Admins: can view all
  - Support: can view if assigned
  - User: can view if they created it
- **Returns:** 403 if unauthorized

#### PATCH `/api/tickets/[id]` (Update)
- **Authorization:** All users (permission dependent)
- **Edit access:**
  - Admins: can edit any ticket
  - Support: can edit if assigned
  - Users: cannot edit
- **Returns:** 403 if not permitted

#### DELETE `/api/tickets/[id]`
- **Authorization:** SUPER_ADMIN, ADMIN only
- **Returns:** 403 if not authorized

### POST `/api/tickets` (Create)
- **Authorization:** All authenticated users
- **Features:**
  - Admins can assign to specific support staff
  - Regular users: auto-assigned to themselves
  - Ticket auto-tracks creator

## User Experience Flow

### For Admin/Support Users
1. Log in
2. See "Support Tickets" in navigation
3. Click to access full ticket management interface
4. View all tickets, filters, analytics
5. Assign, update, resolve tickets

### For Regular Users
1. Log in
2. See "My Tickets" in navigation
3. Can:
   - Click "My Tickets" to see their created tickets
   - Click "+ New Ticket" to create a ticket
   - View status and updates
   - Not see other users' tickets
4. Cannot:
   - View all tickets
   - Access support dashboard
   - Assign tickets
   - Change ticket status/priority

## Test Cases

### Admin User
- [ ] Navigate to `/support` - shows all tickets
- [ ] Filter tickets by status
- [ ] Click on any ticket - can view details
- [ ] Edit any ticket - change status, priority
- [ ] Assign tickets to support staff

### Support User
- [ ] Navigate to `/support` - shows only assigned tickets
- [ ] Click on assigned ticket - can view and edit
- [ ] Try to edit unassigned ticket - permission denied
- [ ] Create new ticket - works
- [ ] View own created tickets - works

### Regular User (Sales Exec)
- [ ] Try to access `/support` - access denied page
- [ ] Navigate to `/support/my-tickets` - shows own tickets
- [ ] Click "+ New Ticket" - create ticket
- [ ] View own ticket details - read-only
- [ ] Cannot edit ticket status
- [ ] Cannot see other users' tickets

## Security Notes

1. **Server-side validation:** All permissions checked at API level, not just UI
2. **Token verification:** All API requests require valid JWT token
3. **Role-based checks:** User role always verified before granting access
4. **Ticket ownership:** Tickets linked to creator (createdById)
5. **Assignment tracking:** Support assignments tracked separately

## Future Enhancements

- [ ] Add ticket resolution SLA tracking
- [ ] Email notifications when status changes
- [ ] Ticket comments/replies
- [ ] Ticket reassignment workflow
- [ ] Rating/feedback after resolution
- [ ] Ticket category/subcategory system

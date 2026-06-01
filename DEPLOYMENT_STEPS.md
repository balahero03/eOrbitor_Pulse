# Deployment Steps - eOrbitor Company Profile Integration

## Pre-Deployment Verification

Before deploying to production, verify all changes are correct:

```bash
# 1. Verify TypeScript compilation
npm run build

# 2. Check git status
git status

# 3. Review changes
git diff
```

## Database Migration

Run the Prisma migration on the target database:

```bash
# 1. Set environment variables (adjust for your environment)
export DATABASE_URL="postgresql://user:password@host:5432/database_name"

# 2. Apply migration
npx prisma migrate deploy

# 3. Verify migration applied
npx prisma db execute --stdin < prisma/migrations/add_lead_extended_fields/migration.sql
```

Or if using Prisma in dev mode:

```bash
npx prisma migrate dev --name add_lead_extended_fields
```

## Post-Migration Testing

### 1. Test Lead Creation
- Open `/leads/new`
- Fill form with all new fields:
  - Address in Contact Details
  - Solution Areas (multi-select)
  - OEM Names (test both selection and custom add)
  - Presales Members
  - Expected Closure Date
- Submit and verify success

### 2. Test Lead Detail Display
- Open the newly created lead
- Verify all fields display correctly:
  - Address shows in detail view
  - Solution Profile sidebar shows colored badges
  - OEM names show as pills
  - Presales members listed in their panel
  - Expected Closure Date in footer (optional to add)

### 3. Test Lead Editing
- Click "Edit Details"
- Modify address and expected closure date
- Save and verify changes persisted

### 4. Test Products Page
- Open `/products` → Add Product
- Verify category dropdown shows Solution Areas instead of free text

### 5. Backward Compatibility Check
- Open any existing lead (created before this change)
- Verify it loads without errors
- New fields should be empty but not cause issues
- Confirm existing fields still display correctly

## Rollback Plan (if needed)

If issues occur, rollback is simple:

```bash
# Revert the schema change (removes the columns)
npx prisma migrate resolve --rolled-back add_lead_extended_fields

# Or manually via SQL:
# ALTER TABLE "Lead" DROP COLUMN address;
# ALTER TABLE "Lead" DROP COLUMN expectedClosureDate;
# ALTER TABLE "Lead" DROP COLUMN solutionAreas;
# ALTER TABLE "Lead" DROP COLUMN oemNames;
# ALTER TABLE "Lead" DROP COLUMN presalesIds;
```

## Files to Deploy

Copy these files to production:

### New Files
- `lib/eorbitor-constants.ts`
- `components/MultiSelectSearch.tsx`
- `prisma/migrations/add_lead_extended_fields/migration.sql`

### Modified Files
- `prisma/schema.prisma`
- `app/(dashboard)/leads/new/page.tsx`
- `app/(dashboard)/leads/[id]/page.tsx`
- `app/api/leads/route.ts`
- `app/api/leads/[id]/route.ts`
- `app/(dashboard)/products/page.tsx`

## Environment Considerations

### PostgreSQL
- Tested with PostgreSQL (uses TEXT[] for arrays)
- No special PostgreSQL extensions needed
- String arrays are native PostgreSQL type

### Performance
- Added 5 columns to Lead table
- 2 columns are timestamps/text (low impact)
- 3 columns are string arrays (minimal size impact)
- No new indexes needed
- No expected performance degradation

### Data Migration
If migrating existing leads to include new data:

```sql
-- Set default empty arrays for existing leads
UPDATE "Lead" SET solutionAreas = '{}' WHERE solutionAreas IS NULL;
UPDATE "Lead" SET oemNames = '{}' WHERE oemNames IS NULL;
UPDATE "Lead" SET presalesIds = '{}' WHERE presalesIds IS NULL;
```

## Monitoring Post-Deployment

Watch for:
1. Lead creation/update operations succeed
2. No errors in browser console when accessing lead pages
3. API requests to `/api/leads` and `/api/leads/[id]` complete successfully
4. Multi-select dropdowns load and function correctly
5. Data persists across page refreshes

## Known Limitations

1. **Presales Members Display**: Currently shows User IDs, not names. Can be enhanced to show names with API call.
2. **OEM Custom Add**: Stored immediately in database without validation. Consider adding OEM validation rules if needed.
3. **Solution Area Change in Products**: Existing products with free-text categories will still display old values. Can migrate with SQL if needed.

## Success Criteria

✓ Migration applies without errors  
✓ Lead creation form displays all new fields  
✓ Multi-select dropdowns function correctly  
✓ Data saves to database and displays in detail view  
✓ Existing leads still load and display correctly  
✓ Product category dropdown shows solution areas  
✓ No TypeScript errors in build  

## Questions?

Refer to `IMPLEMENTATION_SUMMARY.md` for technical details and file structure.

# Spec: Editorial Tags on iOS App

## Context

The web platform now has an editorial merchandising tool at `/admin/merchandise` that lets James tag listings with curated labels (Staff Picks, Rare Finds, etc.). These surface as horizontal rows on the web homepage and browse page.

The iOS app (React Native / Expo at `book-marketplace/SellYourShelf/`) already has a `CuratedRow` component and `useCuratedRow` hook, but these use a Supabase RPC (`get_curated_listings`) for hardcoded row types (`just_added`, `under_five`, category-based). The editorial tags system uses different tables (`editorial_tags`, `listing_editorial_tags`) that the app doesn't know about yet.

This spec covers:
1. Surfacing editorial tag rows in the app
2. Adding an "App Collections" section to the web admin dashboard for managing what shows in the app vs web
3. Sync/copy functionality between web and app collections

---

## 1. Database Changes

### Add `show_on` column to `editorial_tags`

```sql
ALTER TABLE editorial_tags ADD COLUMN IF NOT EXISTS show_on TEXT DEFAULT 'both';
```

Values: `'web'`, `'app'`, `'both'`

This lets the admin control where each tag appears. Default `'both'` means existing tags show everywhere.

### Add `app_display_order` column

```sql
ALTER TABLE editorial_tags ADD COLUMN IF NOT EXISTS app_display_order INT DEFAULT 0;
```

Separate display order for the app, since you may want different row ordering on mobile vs web.

---

## 2. Admin Dashboard Changes (`/admin/merchandise`)

### New: Platform tabs at the top of the left column

Replace the single "Tags" heading with two tabs:

```
[Web Collections]  [App Collections]
```

- **Web Collections** — existing behaviour, shows tags where `show_on` is `'web'` or `'both'`
- **App Collections** — shows tags where `show_on` is `'app'` or `'both'`, uses `app_display_order` for ordering

### Tag card changes

Each tag card gets a platform indicator / toggle:

- Three-way toggle: **Web only** | **App only** | **Both**
- Updates `show_on` column via existing PATCH endpoint
- When in "App Collections" tab, the display order number controls `app_display_order` instead of `display_order`

### Copy / Sync functionality

Add a button at the top of each tab:

- **Web tab**: "Copy all to App" — sets `show_on = 'both'` and copies `display_order` to `app_display_order` for all active tags
- **App tab**: "Sync from Web" — same effect, pulls web ordering into app ordering

These are convenience actions. You can still configure each tag individually.

### Tag preview per platform

When viewing App Collections tab, the tag preview (expanded view) should note:
- Total tagged listings
- How many have cover images (important for app cards)
- A note if fewer than 3 listings (won't show in app)

---

## 3. API Changes

### Update `PATCH /api/admin/tags`

Add `show_on` and `app_display_order` to allowed fields:

```typescript
if (typeof show_on === 'string') updates.show_on = show_on
if (typeof app_display_order === 'number') updates.app_display_order = app_display_order
```

### New endpoint: `GET /api/admin/tags/sync`

Bulk action endpoint:

```typescript
// POST /api/admin/tags/sync
// Body: { direction: 'web-to-app' | 'app-to-web' }
// Sets show_on = 'both' for all active tags
// Copies display_order <-> app_display_order based on direction
```

### New endpoint: `GET /api/editorial/rows`

Public JSON endpoint the app calls to get curated rows. No auth needed — it just reads public data.

```typescript
// GET /api/editorial/rows?platform=app
// Returns:
[
  {
    "tag_id": 1,
    "label": "Staff Picks",
    "slug": "staff-picks",
    "description": "Hand-picked by the Sell Your Shelf team",
    "listings": [
      {
        "group_key": "isbn-123-individual",
        "listing_id": 456,
        "title": "Atomic Habits",
        "author": "James Clear",
        "cover_url": "https://...",
        "price_from": 5.50,
        "price_to": 5.50,
        "copy_count": 1,
        "display_mode": "individual",
        "is_verified": true,
        "category": "Self-Help"
      }
    ]
  }
]
```

Key details:
- Filters to `show_on IN ('app', 'both')` and `active = true`
- Orders by `app_display_order`
- Only returns tags with 3+ active listings
- Maps listings to `BrowseListing` shape so the app can use existing card components directly
- Max 10 listings per tag
- Joins through `listing_editorial_tags` -> `listings` -> `books` and `users`

---

## 4. iOS App Changes

### New hook: `useEditorialRows`

**File**: `hooks/useBrowseData.ts` (add to existing file)

```typescript
export interface EditorialRow {
  tag_id: number;
  label: string;
  slug: string;
  description: string;
  listings: BrowseListing[];
}

export function useEditorialRows() {
  const [rows, setRows] = useState<EditorialRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRows = async () => {
      try {
        // Call the web API endpoint
        const res = await fetch(
          'https://sellyourshelf.com/api/editorial/rows?platform=app'
        );
        if (res.ok) {
          const data: EditorialRow[] = await res.json();
          setRows(data.filter(r => r.listings.length >= 3));
        }
      } catch (err) {
        console.error('Error fetching editorial rows:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRows();
  }, []);

  return { rows, loading };
}
```

Why call the web API instead of querying Supabase directly? Because:
- The web API already handles the complex join logic
- Returns data in `BrowseListing` shape
- Single source of truth — changes to the query only need updating in one place
- The app's Supabase client uses the anon key which may not have access to the join tables

### BrowseScreen changes

**File**: `screens/browse/BrowseScreen.tsx`

Add editorial rows after the existing curated rows (Just Added, Under 5, Recommended):

```typescript
// In imports
import { useEditorialRows } from '../../hooks/useBrowseData';

// In component
const { rows: editorialRows, loading: editorialLoading } = useEditorialRows();

// In ListHeader, after the existing CuratedRow blocks:
{showCuratedRows && editorialRows.map(row => (
  <CuratedRow
    key={row.tag_id}
    title={row.label}
    items={row.listings}
    onItemPress={handleItemPress}
    onSeeAll={row.listings.length >= 5 ? () => {
      // Navigate to a filtered view or web URL
      navigation.navigate('EditorialTag', {
        tagId: row.tag_id,
        label: row.label,
        slug: row.slug,
      });
    } : undefined}
    onWishlistToggle={userId ? handleWishlistToggle : undefined}
    isWishlisted={isWishlisted}
  />
))}
```

No new components needed — the existing `CuratedRow` + `CompactBookCard` handle everything.

### New screen: EditorialTagScreen (optional, for "See all")

**File**: `screens/browse/EditorialTagScreen.tsx`

Full grid of listings for a single editorial tag. Same layout as the main browse grid but filtered to tagged listings only. Fetches from the same API with a `?tag=staff-picks` param.

Register in `BrowseNavigator.tsx`:
```typescript
<Stack.Screen name="EditorialTag" component={EditorialTagScreen} />
```

Add to `navigation/types.ts`:
```typescript
EditorialTag: { tagId: number; label: string; slug: string };
```

---

## 5. Build Order

1. **Database**: Run ALTER TABLE statements for `show_on` and `app_display_order`
2. **Web API**: Build `GET /api/editorial/rows` endpoint, update PATCH handler
3. **Admin UI**: Add platform tabs, show_on toggle, sync buttons
4. **iOS hook**: Add `useEditorialRows` hook
5. **iOS screen**: Add editorial rows to BrowseScreen
6. **iOS screen**: Add EditorialTagScreen for "See all"

Steps 2-3 (web) and 4-6 (app) can be done in parallel.

---

## 6. What NOT to touch

- Existing `get_curated_listings` RPC — leave Just Added, Under 5, Recommended as-is
- Existing `CuratedRow` component — no modifications needed
- Existing `CompactBookCard` — no modifications needed
- Web homepage/browse curated rows — these already work, just need to filter by `show_on`

---

## 7. Rough Effort

| Task | Effort |
|------|--------|
| Database changes | 5 min |
| `GET /api/editorial/rows` endpoint | 30 min |
| Admin UI platform tabs + sync | 1-2 hours |
| iOS `useEditorialRows` hook | 20 min |
| iOS BrowseScreen integration | 20 min |
| iOS EditorialTagScreen | 30 min |
| Testing | 30 min |
| **Total** | **~3-4 hours** |

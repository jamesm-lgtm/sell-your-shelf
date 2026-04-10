# Brief: Editorial Curated Rows in iOS App

## What this is
The Sell Your Shelf web platform has an editorial merchandising system that lets James tag listings with curated labels (Staff Picks, Rare Finds, Hidden Gems, etc.). These show as horizontal scrollable rows on the website homepage and browse page.

The web admin dashboard and API are fully built. This brief covers **only the app-side work** to display these editorial rows in the React Native / Expo app.

---

## What's already done (DO NOT rebuild)

### Database tables (already exist in Supabase `vsnhrukqqmukkpqlyrhh`)
- `editorial_tags` — id, label, slug, description, active, display_order, app_display_order, show_on ('web'|'app'|'both')
- `listing_editorial_tags` — listing_id, tag_id (junction table)

### Web admin dashboard (already live at `/admin/merchandise`)
- Tag management with Web Collections / App Collections tabs
- `show_on` toggle per tag (Web / App / Both)
- Separate display ordering per platform
- Search + tag assignment UI

### API endpoint (already live, ready for the app to call)

```
GET https://www.sellyourshelf.com/api/editorial/rows?platform=app
```

Returns an array of editorial rows, each containing listings **pre-shaped to the app's `BrowseListing` interface**:

```json
[
  {
    "tag_id": 1,
    "label": "Staff Picks",
    "slug": "staff-picks",
    "description": "Hand-picked by the Sell Your Shelf team",
    "listings": [
      {
        "group_key": "editorial-456",
        "isbn_13": "9780735211292",
        "title": "Atomic Habits",
        "author": "James Clear",
        "category": "Self-Help",
        "price_from": 5.50,
        "price_to": 5.50,
        "copy_count": 1,
        "display_mode": "individual",
        "listing_id": 456,
        "cover_url": "https://...",
        "is_verified": true,
        "has_estimated_price": false,
        "last_listed": "",
        "seller_username": "bookworm42",
        "seller_id": null
      }
    ]
  }
]
```

Key behaviours:
- Only returns tags where `show_on` is `'app'` or `'both'` and `active = true`
- Ordered by `app_display_order`
- Only returns tags with **3 or more** active listings
- Max 10 listings per tag
- Listings are shaped exactly to match the app's existing `BrowseListing` type

You can also filter to a single tag:
```
GET https://www.sellyourshelf.com/api/editorial/rows?platform=app&tag=staff-picks
```

---

## App codebase location

```
/Users/jamesmumberson/Documents/book-marketplace/SellYourShelf/
```

React Native / Expo / TypeScript.

---

## Key existing files to read first

Before writing any code, read these files to understand existing patterns:

| File | What it does |
|------|-------------|
| `hooks/useBrowseData.ts` | All browse data hooks — `BrowseListing` type definition, `useCuratedRow`, `useWishlist`, `useFuzzySearch` |
| `components/browse/CuratedRow.tsx` | Horizontal scrollable row component — already handles title, items, "See all", wishlist |
| `components/browse/BrowseBookCards.tsx` | `CompactBookCard` (used in curated rows) and `GridBookCard` (used in grids) |
| `screens/browse/BrowseScreen.tsx` | Main browse screen — shows how curated rows are rendered in `ListHeader` |
| `navigation/BrowseNavigator.tsx` | Browse stack navigator — where to register new screens |
| `navigation/types.ts` | Navigation param types |
| `constants/theme.ts` | Colors, spacing, typography tokens |
| `lib/supabase.ts` | Supabase client setup |

---

## What to build

### 1. New hook: `useEditorialRows`

Add to `hooks/useBrowseData.ts`:

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
        const res = await fetch(
          'https://www.sellyourshelf.com/api/editorial/rows?platform=app'
        );
        if (res.ok) {
          const data: EditorialRow[] = await res.json();
          setRows(data);
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

**Why fetch from the web API instead of Supabase directly?**
- The API already handles the complex multi-table join
- Returns data pre-shaped to `BrowseListing` — no mapping needed
- Single source of truth for the query logic
- The app's Supabase anon key may not have access to all joined tables

### 2. Add editorial rows to BrowseScreen

In `screens/browse/BrowseScreen.tsx`:

**Import the hook:**
```typescript
import { useEditorialRows } from '../../hooks/useBrowseData';
```

**Call it in the component:**
```typescript
const { rows: editorialRows } = useEditorialRows();
```

**Render after existing curated rows** (Just Added, Under £5, Recommended) inside the `ListHeader` memo, before `{GridHeader}`:

```typescript
{showCuratedRows && editorialRows.map(row => (
  <CuratedRow
    key={row.tag_id}
    title={row.label}
    items={row.listings}
    onItemPress={handleItemPress}
    onSeeAll={row.listings.length >= 5 ? () => {
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

**Add `editorialRows` to the `ListHeader` useMemo dependency array.**

No new components needed — the existing `CuratedRow` + `CompactBookCard` handle everything since the API returns data in `BrowseListing` shape.

### 3. New screen: EditorialTagScreen

Create `screens/browse/EditorialTagScreen.tsx`.

This is the "See all" destination — a full grid of all listings for a single editorial tag.

**Behaviour:**
- Receives `tagId`, `label`, `slug` as route params
- Fetches from `https://www.sellyourshelf.com/api/editorial/rows?platform=app&tag={slug}`
- Displays the tag `label` as the screen title
- Shows listings in a 2-column grid using `GridBookCard` (same as the main browse grid)
- Supports wishlist toggle
- Pull-to-refresh

**Follow the same patterns as BrowseScreen** for the grid layout, but without search, category chips, or sort. It's just a title + grid.

### 4. Register the screen in navigation

In `navigation/types.ts`, add to `BrowseStackParamList`:
```typescript
EditorialTag: { tagId: number; label: string; slug: string };
```

In `navigation/BrowseNavigator.tsx`, add:
```typescript
<Stack.Screen
  name="EditorialTag"
  component={EditorialTagScreen}
  options={({ route }) => ({ title: route.params.label })}
/>
```

---

## Build order

1. Read the key files listed above to understand patterns
2. Add `useEditorialRows` hook to `hooks/useBrowseData.ts`
3. Add editorial rows to `BrowseScreen.tsx` ListHeader
4. Create `EditorialTagScreen.tsx`
5. Register screen in navigator and types
6. Test — tag some books via the web admin, confirm rows appear in app

---

## What NOT to touch

- Existing `get_curated_listings` RPC — leave Just Added, Under £5, Recommended as-is
- `CuratedRow` component — no modifications needed
- `CompactBookCard` / `GridBookCard` — no modifications needed
- Any web platform files (everything in `/Users/jamesmumberson/Documents/sell-your-shelf/`)
- The Supabase database — no schema changes needed, everything is already in place

---

## Testing

1. Go to `sellyourshelf.com/admin/merchandise`
2. Password: `sellyourshelf2024`
3. Switch to "App Collections" tab
4. Make sure some tags show as "Both" or "App"
5. Each tag needs 3+ tagged listings to appear
6. Run the app — editorial rows should appear below existing curated rows on the browse screen
7. Tap "See all" — should navigate to EditorialTagScreen with full grid

You can verify the API is returning data by hitting:
```
https://www.sellyourshelf.com/api/editorial/rows?platform=app
```

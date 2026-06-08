/**
 * Cover URL resolution utilities.
 *
 * Resolution precedence (highest priority first):
 *   1. Seller-uploaded primary gallery image (listing_images, sort_order = 0)
 *   2. Edition cover (hosted preferred, then non-hosted)
 *   3. Work cover (hosted preferred, then non-hosted)
 *   4. null  → caller renders a placeholder
 *
 * Hosted = Supabase Storage public URL, kept for Google Merchant Centre
 * compliance and to insulate against third-party hotlink rot.
 */

export type ListingImageRow = { url: string; sort_order: number };

/** Return the highest-sort_order primary URL from a gallery, if any. */
export function primaryGalleryUrl(
  images: ListingImageRow[] | null | undefined
): string | null {
  if (!images || images.length === 0) return null;
  // Defensive: don't assume callers pre-sorted.
  let best = images[0];
  for (const img of images) {
    if (img.sort_order < best.sort_order) best = img;
  }
  return best.url ?? null;
}

/**
 * For pages querying the `marketplace_listings` view which exposes:
 *   work_cover, work_cover_hosted, edition_cover, edition_cover_hosted
 *
 * Pass `listing_images` separately when the page also joined listing_images.
 */
export function resolveListingCover(listing: {
  work_cover_hosted?: string | null;
  work_cover?: string | null;
  edition_cover_hosted?: string | null;
  edition_cover?: string | null;
  listing_images?: ListingImageRow[] | null;
}): string | null {
  return (
    primaryGalleryUrl(listing.listing_images) ??
    listing.edition_cover_hosted ??
    listing.edition_cover ??
    listing.work_cover_hosted ??
    listing.work_cover ??
    null
  );
}

/**
 * For pages querying `listings` directly via `books(cover_url, cover_url_hosted)`.
 * Pass `listing_images` separately when the page also joined listing_images.
 */
export function resolveBookCover(
  book: {
    cover_url_hosted?: string | null;
    cover_url?: string | null;
  } | null,
  listing_images?: ListingImageRow[] | null
): string | null {
  return (
    primaryGalleryUrl(listing_images) ??
    book?.cover_url_hosted ??
    book?.cover_url ??
    null
  );
}

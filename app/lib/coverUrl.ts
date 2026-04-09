/**
 * Cover URL resolution utilities.
 *
 * Prefer hosted URLs (Supabase Storage) for Google Merchant Centre
 * compliance. Fall back to original third-party URLs gracefully.
 */

/**
 * For pages querying the `marketplace_listings` view which exposes:
 * work_cover, work_cover_hosted, edition_cover, edition_cover_hosted
 */
export function resolveListingCover(listing: {
  work_cover_hosted?: string | null
  work_cover?: string | null
  edition_cover_hosted?: string | null
  edition_cover?: string | null
}): string | null {
  return (
    listing.edition_cover_hosted ??
    listing.edition_cover ??
    listing.work_cover_hosted ??
    listing.work_cover ??
    null
  )
}

/**
 * For pages querying the `books` table directly via joins like `books(cover_url)`.
 * The hosted URL is in `books.cover_url_hosted`.
 */
export function resolveBookCover(book: {
  cover_url_hosted?: string | null
  cover_url?: string | null
} | null): string | null {
  if (!book) return null
  return book.cover_url_hosted ?? book.cover_url ?? null
}

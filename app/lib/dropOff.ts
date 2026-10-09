/**
 * Where a seller can actually drop a parcel.
 *
 * Our labels are shop-only: an InPost counter inside a shop, never an outdoor
 * locker. The locker network is a different one our labels cannot use, and it
 * is far larger — roughly 16,000 send-capable lockers against 3,795 operating
 * shops — so "any InPost point" reliably sends people to the wrong place
 * simply because the wrong place is nearer.
 *
 * On 28 September a seller took his QR code to a locker and got "code not
 * recognised". He lost an afternoon and only recovered because he could reach
 * the founder directly.
 *
 * This matters more than copy usually does. Of 41 sold orders, 19 reached a
 * label and only 10 were posted: nine sellers generated a QR code and never
 * completed the drop-off, one of them on a £20 payout. People who abandon
 * after doing the hard part have usually hit something that did not work, and
 * being sent to a locker is the one failure we know happens.
 *
 * Three pages said three different versions of the same wrong thing, which is
 * why this is one constant and not three strings. The mobile app has its own
 * copy of this at utils/dropOff.ts — a different repo, deliberately duplicated
 * rather than shared, but keep the wording in step.
 */

/** "not a locker" is the load-bearing half — InPost brands both identically. */
export const DROP_OFF_LINE =
  'Drop the parcel at an InPost shop — a counter inside a shop, not an outdoor locker. ' +
  'No printing required, just show the QR code.'

/** For step lists and other places with no room for the full sentence. */
export const DROP_OFF_LINE_SHORT =
  'Drop it at an InPost shop — a counter inside a shop, not a locker. No printer needed.'

/**
 * InPost's own finder, filtered to shops.
 *
 * pointTypes=shop is the whole point: without it the finder opens on lockers
 * and is titled "Find a locker", so linking there after telling someone
 * "shops only" undoes the warning. Verified against the live site on
 * 5 Oct 2026. InPost ignores a `search` param — the postcode cannot be
 * pre-filled, their search is a client-side autocomplete needing a selection
 * — so do not add one back.
 */
export const INPOST_SHOP_FINDER_URL = 'https://inpost.co.uk/lockers?pointTypes=shop'

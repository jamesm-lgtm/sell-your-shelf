// Server-side bot detection for the view-tracking API routes.
//
// Googlebot (and most modern crawlers) execute JavaScript, so the client
// trackers fire for them like any visitor — before this, ~90% of
// listing_views rows were crawlers with is_bot never set. Rows are kept
// (crawl activity is itself useful signal) but stamped is_bot so analytics
// can filter them.
// Note the Google family: several of Google's fetchers carry a normal
// Chrome UA with only a "(compatible; GoogleOther)"-style suffix and no
// "bot" substring, so they slip past the generic patterns. GoogleOther in
// particular fetches Merchant Center product landing pages — it arrived in
// volume the day after the Shopping feed was fixed and briefly looked like
// a traffic spike.
const BOT_UA =
  /bot|crawl|spider|slurp|bingpreview|headless|lighthouse|pingdom|pagespeed|vercel-screenshot|prerender|facebookexternalhit|whatsapp|telegram|discordbot|skypeuripreview|embedly|quora link preview|outbrain|vkshare|w3c_validator|dataminr|axios|python-requests|wget|curl\/|googleother|google-inspectiontool|google-read-aloud|google-site-verification|googleproducer|feedfetcher-google|apis-google|mediapartners-google|google favicon|storebot-google/i

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true // no UA at all → not a normal browser
  return BOT_UA.test(userAgent)
}

/**
 * Apple App Site Association — what makes a sellyourshelf.com link open the
 * iOS app instead of Safari.
 *
 * appID is <Team ID>.<bundle identifier>. Getting either half wrong fails the
 * association silently: the link just opens the website and nothing says why.
 * Both halves were wrong here, in different places:
 *
 *   this route      8T8DTZ5WLY.com.anonymous.SellYourShelf
 *                   right bundle, wrong team
 *   public/.well-known/apple-app-site-association
 *                   5HNY333MY4.com.sellyourshelf.app
 *                   right team, but com.sellyourshelf.app is the ANDROID
 *                   package name, not the iOS bundle id
 *
 * The app is signed by team 5HNY333MY4 (SELL YOUR SHELF LIMITED) and its
 * ios.bundleIdentifier is com.anonymous.SellYourShelf, so the correct value is
 * the combination below. The stale public/ copy is deleted in this commit so
 * there is one source of truth.
 *
 * Paths mirror what the app can actually route (see App.tsx handleDeepLink):
 * a listing, a bundle, an auth callback, and a bare /:username shelf. The
 * previous '/*' claimed every URL on the site including /books/*, which the
 * app cannot open — so those links opened the app and dropped the person on
 * Browse. Better to leave them on the website.
 *
 * Served with Content-Type: application/json via the header rule in
 * vercel.json. Apple does not follow redirects for this file, so it must
 * return 200 on every host listed in the app's associatedDomains.
 */
export async function GET() {
  return Response.json({
    applinks: {
      apps: [],
      details: [
        {
          appID: '5HNY333MY4.com.anonymous.SellYourShelf',
          paths: [
            '/listing/*',
            '/bundle/*',
            '/auth/*',
            // Everything the website owns. A bare /:username is a seller's
            // shelf and the app can open it, so the catch-all stays — but it
            // must not swallow the site's own pages, or those links open the
            // app and land the person on Browse with nothing to show.
            // /scan comes off this list the moment a build carrying its
            // deep-link routing is live. Until then the welcome email's button
            // should land on the website, not open the app onto Browse.
            'NOT /scan',
            'NOT /about', 'NOT /admin/*', 'NOT /api/*', 'NOT /basket',
            'NOT /blog/*', 'NOT /books/*', 'NOT /browse', 'NOT /bundles',
            'NOT /category/*', 'NOT /checkout', 'NOT /contact',
            'NOT /delete-account', 'NOT /feed', 'NOT /new', 'NOT /order/*',
            'NOT /orders', 'NOT /privacy', 'NOT /returns', 'NOT /search',
            'NOT /stripe/*', 'NOT /support', 'NOT /terms',
            '/*',
          ],
        },
      ],
    },
  })
}

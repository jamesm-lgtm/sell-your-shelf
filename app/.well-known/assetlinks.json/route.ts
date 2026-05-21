// Android App Links verification — served from /.well-known/assetlinks.json
//
// The sha256_cert_fingerprints value is the production App signing key
// certificate fingerprint from Google Play Console (Test and release →
// App integrity → App signing → App signing key certificate). This is the
// key Google holds and uses to sign every released APK/AAB — not the
// upload key.
//
// Once this file is live, Android App Links for sellyourshelf.com will
// verify against the installed app and deep links open in-app without
// the disambiguation dialog.

export async function GET() {
  return Response.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.sellyourshelf.app',
        sha256_cert_fingerprints: [
          'C9:02:0B:36:95:8E:F2:02:8D:EF:74:24:89:32:DD:95:8B:63:F4:02:89:EB:41:A3:C7:85:DB:DE:4B:90:A6:D9',
        ],
      },
    },
  ])
}

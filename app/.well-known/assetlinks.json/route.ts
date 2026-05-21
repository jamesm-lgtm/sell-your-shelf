// Android App Links verification — served from /.well-known/assetlinks.json
//
// IMPORTANT: the sha256_cert_fingerprints value below is a placeholder. James
// needs to fetch the production signing key fingerprint from Google Play
// Console (App signing → App signing key certificate, "SHA-256 certificate
// fingerprint") and replace TBD_REPLACE_WITH_PRODUCTION_SHA256.
//
// Until this is replaced, Android App Links will not verify and the listing
// deep link will fall through to the Play Store fallback (which is fine — just
// not the optimal handoff).

export async function GET() {
  return Response.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.sellyourshelf.app',
        sha256_cert_fingerprints: ['TBD_REPLACE_WITH_PRODUCTION_SHA256'],
      },
    },
  ])
}

export const APP_STORE_URL = 'https://apps.apple.com/gb/app/id6755662456'
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.sellyourshelf.app&hl=en_GB'

export const ANDROID_PACKAGE = 'com.sellyourshelf.app'
export const APP_SCHEME = 'sellyourshelf'

export type AppLinkUtm = {
  source: string
  medium: string
  campaign: string
}

export function appStoreLink(utm: AppLinkUtm): string {
  const params = new URLSearchParams({
    utm_source: utm.source,
    utm_medium: utm.medium,
    utm_campaign: utm.campaign,
  })
  return `${APP_STORE_URL}?${params.toString()}`
}

export function playStoreLink(utm: AppLinkUtm): string {
  const params = new URLSearchParams({
    utm_source: utm.source,
    utm_medium: utm.medium,
    utm_campaign: utm.campaign,
  })
  return `${PLAY_STORE_URL}&${params.toString()}`
}

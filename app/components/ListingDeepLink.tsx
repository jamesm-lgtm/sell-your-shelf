'use client'

import { useEffect } from 'react'
import { APP_SCHEME, ANDROID_PACKAGE, appStoreLink, playStoreLink } from '@/app/lib/appLinks'

type Props = {
  listingId: string | number
}

export default function ListingDeepLink({ listingId }: Props) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const ua = window.navigator.userAgent || ''
    const isIOS = /iPhone|iPad|iPod/.test(ua)
    const isAndroid = /Android/.test(ua)

    if (!isIOS && !isAndroid) return

    const utm = {
      source: 'listing',
      medium: 'deep_link_fallback',
      campaign: `listing_${listingId}`,
    }

    if (isIOS) {
      const appStoreFallback = appStoreLink(utm)
      window.location.href = `${APP_SCHEME}://listing/${listingId}`
      const t = window.setTimeout(() => {
        window.location.href = appStoreFallback
      }, 2000)
      const onHide = () => window.clearTimeout(t)
      window.addEventListener('pagehide', onHide, { once: true })
      return () => {
        window.clearTimeout(t)
        window.removeEventListener('pagehide', onHide)
      }
    }

    if (isAndroid) {
      const playFallback = encodeURIComponent(playStoreLink(utm))
      const intent =
        `intent://listing/${listingId}#Intent` +
        `;scheme=${APP_SCHEME}` +
        `;package=${ANDROID_PACKAGE}` +
        `;S.browser_fallback_url=${playFallback}` +
        `;end`
      window.location.href = intent
    }
  }, [listingId])

  return null
}

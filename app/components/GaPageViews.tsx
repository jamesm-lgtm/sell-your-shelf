'use client'

// Sends GA4 page_view on App Router navigations. The gtag config is set
// with send_page_view: false, so this component is the only page_view
// source — which lets us exclude /admin entirely.
//
// Must be rendered inside <Suspense> (useSearchParams).

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { GA_ID, gaEvent } from '@/app/lib/ga'
import { isDebugSuppressed } from '@/app/lib/analytics'

export default function GaPageViews() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return
    if (isDebugSuppressed()) return
    const query = searchParams.toString()
    gaEvent('page_view', {
      page_path: query ? `${pathname}?${query}` : pathname,
      page_location: window.location.href,
      page_title: document.title,
      send_to: GA_ID,
    })
  }, [pathname, searchParams])

  return null
}

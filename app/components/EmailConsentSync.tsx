'use client'

import { useEffect } from 'react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Reads email consent from localStorage (set during checkout) and:
 * 1. Upserts communication_preferences for the buyer
 * 2. Calls sync-to-loops if they opted in
 *
 * Fire-and-forget — errors are silently logged. This component renders nothing.
 */
export default function EmailConsentSync({ buyerId }: { buyerId: string }) {
  useEffect(() => {
    const raw = localStorage.getItem('sys_email_opt_in')
    if (raw === null) return // no consent data stored — user didn't go through checkout form
    const emailOptIn = raw === 'true'

    // Clean up so we don't re-fire on page reload
    localStorage.removeItem('sys_email_opt_in')

    // Upsert communication_preferences
    fetch(`${SUPABASE_URL}/rest/v1/communication_preferences`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        user_id: buyerId,
        channel: 'email',
        opted_in: emailOptIn,
        opted_in_at: emailOptIn ? new Date().toISOString() : null,
        opted_out_at: emailOptIn ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    })
      .then(() => {
        // If opted in, also trigger a Loops sync
        if (emailOptIn) {
          return fetch(`${SUPABASE_URL}/functions/v1/sync-to-loops`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: buyerId,
              properties: { hasPurchased: true, emailOptIn: true },
            }),
          })
        }
      })
      .catch((err) => console.log('Email consent sync error:', err))
  }, [buyerId])

  return null
}

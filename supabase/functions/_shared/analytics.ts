// Server-side analytics emission for edge functions.
//
// Mirrors the client-side `track()` helper in `app/lib/analytics.ts`, but
// inserts directly into the `events` table (no batching, no sendBeacon —
// we're already inside an edge function).
//
// `session_id` is required NOT NULL on the events table. Server-emitted
// events use the literal "server" — analyses correlating client +
// server events for the same order/buyer key on `properties.order_id`
// or `seller_id` instead of session_id.

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type ServerEventArgs = {
  supabase: SupabaseClient
  eventName: string
  properties?: Record<string, unknown>
  sellerId?: string | null
  listingId?: number | null
  userId?: string | null
}

export async function trackServerEvent(args: ServerEventArgs): Promise<void> {
  try {
    const { error } = await args.supabase.from('events').insert({
      event_name: args.eventName,
      session_id: 'server',
      user_id: args.userId ?? null,
      seller_id: args.sellerId ?? null,
      listing_id: args.listingId ?? null,
      source: 'server',
      platform: 'web',
      properties: args.properties ?? {},
      is_bot: false,
    })
    if (error) console.error('trackServerEvent insert failed:', error)
  } catch (err) {
    console.error('trackServerEvent threw:', err)
  }
}

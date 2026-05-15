// Expo push helpers used by the multi-item flow.
//
// All purchase-flow pushes go through Expo (not OneSignal) — `push_tokens`
// stores `expo_push_token` per user.
//
// The badge count must mirror the iOS app's `useUnreadCounts` logic so the
// app icon badge stays coherent when the user opens the app after a push:
//   unread chat messages addressed to them
//   + paid orders/transactions they're the seller of that haven't shipped

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type ExpoPushPayload = {
  to: string
  title: string
  body: string
  badge?: number
  sound?: 'default'
  channelId?: string
  data?: Record<string, unknown>
}

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send'

export async function sendExpoPush(notifications: ExpoPushPayload[]): Promise<void> {
  if (notifications.length === 0) return
  try {
    const res = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notifications),
    })
    if (!res.ok) {
      console.error('Expo push HTTP', res.status, await res.text())
    }
  } catch (err) {
    console.error('Expo push request failed:', err)
  }
}

// Mirror of `useUnreadCounts` on iOS so push-delivered badges line up with
// what the app shows on open. Considers both the legacy `transactions` and
// the new `orders` table for seller-side pending shipments.
export async function computeBadgeTotal(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  try {
    const [convoRes, txSalesRes, orderSalesRes] = await Promise.all([
      supabase
        .from('conversations')
        .select('id')
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`),
      supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', userId)
        .eq('status', 'paid')
        .is('shipped_at', null),
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', userId)
        .eq('status', 'paid')
        .is('shipped_at', null),
    ])

    const convoIds = (convoRes.data ?? []).map((c: { id: number }) => c.id)
    let unreadMessages = 0
    if (convoIds.length > 0) {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convoIds)
        .eq('is_read', false)
        .neq('sender_id', userId)
      unreadMessages = count ?? 0
    }

    return unreadMessages + (txSalesRes.count ?? 0) + (orderSalesRes.count ?? 0)
  } catch (err) {
    console.error('computeBadgeTotal failed:', err)
    return 1
  }
}

// Fetch all push tokens for a user.
export async function getPushTokens(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('push_tokens')
    .select('expo_push_token')
    .eq('user_id', userId)
  return (data ?? []).map((r: { expo_push_token: string }) => r.expo_push_token)
}

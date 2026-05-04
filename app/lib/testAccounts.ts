import type { SupabaseClient } from '@supabase/supabase-js'

// Usernames whose activity should not be recorded as analytics. Includes
// internal/dev accounts and known test seeds.
export const TEST_USERNAMES: ReadonlySet<string> = new Set([
  'jmumberson',
  'igor',
  'tahleel',
  'shojin',
  'sapling',
])

export function isTestUsername(username: string | null | undefined): boolean {
  return !!username && TEST_USERNAMES.has(username.toLowerCase())
}

let cache: { ids: Set<string>; loadedAt: number } | null = null
const CACHE_TTL_MS = 60_000

// Fetched once per process and cached for a minute. The set is small and
// rarely changes, but a cold module reload will refetch.
export async function getTestAccountUserIds(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const now = Date.now()
  if (cache && now - cache.loadedAt < CACHE_TTL_MS) return cache.ids

  const { data } = await supabase
    .from('users')
    .select('id')
    .in('username', Array.from(TEST_USERNAMES))

  const ids = new Set<string>((data ?? []).map((u: { id: string }) => u.id))
  cache = { ids, loadedAt: now }
  return ids
}

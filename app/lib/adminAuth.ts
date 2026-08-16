'use client'

// Shared admin session across /admin/*.
//
// There were two schemes: merchandise kept a localStorage `admin_token`,
// while orders and analytics kept the password in sessionStorage under a
// different key — so moving between them always re-prompted, and a tab
// reload lost the session entirely.
//
// One key, in localStorage, read by all three. The password itself is
// stored because the orders/analytics APIs verify it per request (there
// is no server-side session); the previous `admin_token` was only ever
// checked client-side, so this is not a step down. Anyone with access to
// the browser can reach these pages either way — the gate exists to stop
// casual URL discovery, not to withstand a local attacker.

const KEY = 'sys_admin_pw'
const LEGACY_TOKEN_KEY = 'admin_token'

export function getAdminPassword(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const fromLocal = localStorage.getItem(KEY)
    if (fromLocal) return fromLocal

    // Migrate a session started under the old sessionStorage scheme.
    const fromSession = sessionStorage.getItem(KEY)
    if (fromSession) {
      localStorage.setItem(KEY, fromSession)
      return fromSession
    }
  } catch {
    // storage unavailable (private mode, blocked cookies)
  }
  return null
}

export function setAdminPassword(password: string): void {
  try {
    localStorage.setItem(KEY, password)
    // Keep the legacy flag so merchandise's own check still passes.
    localStorage.setItem(LEGACY_TOKEN_KEY, 'authed')
  } catch {}
}

export function clearAdminPassword(): void {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(LEGACY_TOKEN_KEY)
    sessionStorage.removeItem(KEY)
  } catch {}
}

'use client'

import { useEffect } from 'react'

export default function AuthCallback() {
  useEffect(() => {
    // Get full URL including hash fragment
    const fullUrl = window.location.href
    
    // Remove www if present and replace with app scheme
    const appUrl = fullUrl
      .replace('https://www.sellyourshelf.com', 'sellyourshelf://')
      .replace('https://sellyourshelf.com', 'sellyourshelf://')
    
    console.log('Redirecting to:', appUrl)
    
    // Small delay to ensure page renders
    setTimeout(() => {
      window.location.href = appUrl
    }, 100)
  }, [])

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      fontFamily: 'system-ui',
      gap: '16px'
    }}>
      <p>Opening Sell Your Shelf...</p>
      <p style={{ fontSize: '14px', color: 'var(--color-ink-soft)' }}>
        If the app doesn&apos;t open, <a href="sellyourshelf://auth/callback" style={{ color: 'var(--color-cond-like-new)' }}>tap here</a>
      </p>
    </div>
  )
}
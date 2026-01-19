'use client'

import { useEffect } from 'react'

export default function AuthCallback() {
  useEffect(() => {
    const url = window.location.href
    const appUrl = url.replace('https://sellyourshelf.com', 'sellyourshelf:/')
    window.location.href = appUrl
  }, [])

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      fontFamily: 'system-ui'
    }}>
      <p>Opening Sell Your Shelf...</p>
    </div>
  )
}
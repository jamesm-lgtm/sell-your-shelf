'use client';

import { useEffect } from 'react';

export default function StripeRefresh() {
  useEffect(() => {
    window.location.href = 'sellyourshelf://stripe-refresh';
  }, []);

  return (
    <div style={{ 
      fontFamily: 'system-ui', 
      textAlign: 'center', 
      padding: '50px',
      backgroundColor: '#FAF8F5',
      minHeight: '100vh'
    }}>
      <h1 style={{ color: '#2D4A3E' }}>Continue Setup</h1>
      <p>Redirecting to app...</p>
      <a href="sellyourshelf://stripe-refresh" style={{ color: '#2D4A3E' }}>
        Tap here if not redirected
      </a>
    </div>
  );
}
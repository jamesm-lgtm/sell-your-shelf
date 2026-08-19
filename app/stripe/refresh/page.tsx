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
      backgroundColor: 'var(--color-paper)',
      minHeight: '100vh'
    }}>
      <h1 style={{ color: 'var(--color-action)' }}>Continue Setup</h1>
      <p>Redirecting to app...</p>
      <a href="sellyourshelf://stripe-refresh" style={{ color: 'var(--color-action)' }}>
        Tap here if not redirected
      </a>
    </div>
  );
}
'use client';

import { useEffect } from 'react';

export default function StripeComplete() {
  useEffect(() => {
    window.location.href = 'sellyourshelf://stripe-complete';
  }, []);

  return (
    <div style={{ 
      fontFamily: 'system-ui', 
      textAlign: 'center', 
      padding: '50px',
      backgroundColor: '#FAF8F5',
      minHeight: '100vh'
    }}>
      <h1 style={{ color: '#2D4A3E' }}>Setup Complete!</h1>
      <p>Redirecting to app...</p>
      <a href="sellyourshelf://stripe-complete" style={{ color: '#2D4A3E' }}>
        Tap here if not redirected
      </a>
    </div>
  );
}
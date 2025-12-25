export default function StripeComplete() {
  return (
    <html>
      <head>
        <meta httpEquiv="refresh" content="0;url=sellyourshelf://stripe-complete" />
        <script dangerouslySetInnerHTML={{ __html: `window.location.href = 'sellyourshelf://stripe-complete';` }} />
      </head>
      <body style={{ fontFamily: 'system-ui', textAlign: 'center', padding: '50px' }}>
        <h1>Setup Complete!</h1>
        <p>Redirecting to app...</p>
        <a href="sellyourshelf://stripe-complete">Tap here if not redirected</a>
      </body>
    </html>
  );
}

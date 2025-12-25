export default function StripeRefresh() {
  return (
    <html>
      <head>
        <meta httpEquiv="refresh" content="0;url=sellyourshelf://stripe-refresh" />
        <script dangerouslySetInnerHTML={{ __html: `window.location.href = 'sellyourshelf://stripe-refresh';` }} />
      </head>
      <body style={{ fontFamily: 'system-ui', textAlign: 'center', padding: '50px' }}>
        <h1>Continue Setup</h1>
        <p>Redirecting to app...</p>
        <a href="sellyourshelf://stripe-refresh">Tap here if not redirected</a>
      </body>
    </html>
  );
}
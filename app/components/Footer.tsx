import Link from 'next/link';

// Brand "book spine" mark — three rounded bars of varying height, the
// middle one dimmed. Reproduced inline (no image asset) per the homepage
// redesign so the footer lockup matches the nav.
function SpineMark() {
  return (
    <span style={{ display: 'flex', alignItems: 'flex-end', gap: 2.5, height: 20 }} aria-hidden>
      <i style={{ display: 'block', width: 4, height: 16, borderRadius: 2, background: '#fff' }} />
      <i style={{ display: 'block', width: 4, height: 12, borderRadius: 2, background: '#fff', opacity: 0.7 }} />
      <i style={{ display: 'block', width: 4, height: 20, borderRadius: 2, background: '#fff' }} />
    </span>
  );
}

const linkStyle: React.CSSProperties = {
  color: 'rgba(250,248,245,0.62)',
  fontSize: 13.5,
  textDecoration: 'none',
};

export default function Footer() {
  return (
    <footer style={{ background: '#15211C', color: 'rgba(250,248,245,0.62)', padding: '52px 40px 32px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 40 }}>
          <div style={{ maxWidth: 280 }}>
            <Link
              href="/"
              style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 600, fontSize: 16, color: '#fff', marginBottom: 14, textDecoration: 'none' }}
            >
              <SpineMark /> Sell Your Shelf
            </Link>
            <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>
              Sell Your Shelf Limited · Company No. 16895246<br />
              Registered in England &amp; Wales. Giving secondhand books a second life.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 56, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link href="/about" style={linkStyle}>About</Link>
              <Link href="/new" style={linkStyle}>Browse books</Link>
              <Link href="/bundles" style={linkStyle}>Bundles</Link>
              <Link href="/support" style={linkStyle}>Support</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link href="/terms" style={linkStyle}>Terms</Link>
              <Link href="/privacy" style={linkStyle}>Privacy</Link>
              <Link href="/returns" style={linkStyle}>Returns</Link>
              <Link href="/contact" style={linkStyle}>Contact</Link>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 40,
            paddingTop: 22,
            borderTop: '1px solid rgba(255,255,255,0.1)',
            fontSize: 12.5,
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <span>© 2026 Sell Your Shelf Limited. All rights reserved.</span>
          <span>Made for readers in the UK 🇬🇧</span>
        </div>
      </div>
    </footer>
  );
}

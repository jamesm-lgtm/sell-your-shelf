import Link from 'next/link';
import BrandMark from './BrandMark';

const linkStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.80)',
  fontSize: 14,
  textDecoration: 'none',
  lineHeight: 1.5,
};

// Every zone carries its plain literal name. Wayfinding is reading.
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="sy-mark"
      style={{ color: 'rgba(255,255,255,0.52)', display: 'block', marginBottom: 14 }}
    >
      {children}
    </span>
  );
}

export default function Footer() {
  return (
    <footer
      style={{
        background: 'var(--color-ground-deep)',
        color: 'rgba(255,255,255,0.80)',
        padding: '64px 40px 36px',
        borderTop: '1px solid var(--color-rule-dim)',
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 48 }}>
          <div style={{ maxWidth: 300 }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12,
                color: '#fff',
                marginBottom: 18,
                textDecoration: 'none',
              }}
            >
              <BrandMark size={30} color="#fff" />
              <span className="sy-wordmark" style={{ fontSize: 18 }}>
                Sell Your Shelf
              </span>
            </Link>
            <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0, color: 'rgba(255,255,255,0.70)' }}>
              Sell Your Shelf Limited · Company No. 16895246
              <br />
              Registered in England &amp; Wales.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap' }}>
            <div>
              <FieldLabel>Marketplace</FieldLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Link href="/new" style={linkStyle}>Browse books</Link>
                <Link href="/bundles" style={linkStyle}>Bundles</Link>
                <Link href="/about" style={linkStyle}>About</Link>
                <Link href="/support" style={linkStyle}>Support</Link>
              </div>
            </div>
            <div>
              <FieldLabel>Legal</FieldLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Link href="/terms" style={linkStyle}>Terms</Link>
                <Link href="/privacy" style={linkStyle}>Privacy</Link>
                <Link href="/returns" style={linkStyle}>Returns</Link>
                <Link href="/contact" style={linkStyle}>Contact</Link>
              </div>
            </div>
            <div>
              <FieldLabel>Fees</FieldLabel>
              <div
                className="sy-figure"
                style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, color: 'rgba(255,255,255,0.80)' }}
              >
                <span>20% platform fee</span>
                <span>£0.60 minimum per book</span>
                <span>£2.50 shipping, paid by buyer</span>
                <span style={{ color: 'rgba(255,255,255,0.60)' }}>Free to list. No hidden charges.</span>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 48,
            paddingTop: 24,
            borderTop: '1px solid rgba(255,255,255,0.22)',
            fontSize: 13,
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            color: 'rgba(255,255,255,0.70)',
          }}
        >
          <span>© 2026 Sell Your Shelf Limited. All rights reserved.</span>
          <span>Made for readers in the UK</span>
        </div>
      </div>
    </footer>
  );
}

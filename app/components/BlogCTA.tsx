import AppBadges from './AppBadges'

type Props = {
  slug?: string
}

export default function BlogCTA({ slug }: Props) {
  const campaign = slug ? `blog_${slug}` : 'get_the_app'

  return (
    <div
      style={{
        background: 'var(--color-ground)',
        color: 'var(--color-on-ground)',
        borderRadius: 'var(--radius-md)',
        padding: '36px 32px',
        marginTop: 48,
        textAlign: 'center',
      }}
    >
      <h3 className="sy-h3" style={{ color: 'var(--color-on-ground)', marginBottom: 8 }}>
        Ready to clear your shelf?
      </h3>
      {/* £4–6 was the old figure. The real seller take after the 20% fee and
          the £0.60 minimum is £2–4 — a public page can't overstate it. */}
      <p style={{ fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.82)', margin: '0 auto 26px', maxWidth: 420 }}>
        Scan your books in 90 seconds. Free to list, and you keep £2–4 per sale.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <AppBadges
          utm={{ source: 'blog', medium: 'cta', campaign }}
          size="md"
          layout="auto"
          align="center"
        />
      </div>
    </div>
  );
}

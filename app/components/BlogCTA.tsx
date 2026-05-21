import AppBadges from './AppBadges'

type Props = {
  slug?: string
}

export default function BlogCTA({ slug }: Props) {
  const campaign = slug ? `blog_${slug}` : 'get_the_app'

  return (
    <div className="rounded-2xl p-8 mt-12 text-white text-center" style={{ backgroundColor: '#2D4A3E' }}>
      <h3 className="text-2xl font-semibold mb-2" style={{ fontFamily: 'Georgia, serif' }}>
        Ready to clear your shelf?
      </h3>
      <p className="text-white/80 mb-6">
        Scan your books in 90 seconds. Free to list, and you keep £4–6 per sale.
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

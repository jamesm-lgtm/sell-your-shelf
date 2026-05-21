import { appStoreLink, playStoreLink, type AppLinkUtm } from '@/app/lib/appLinks'

type Size = 'sm' | 'md' | 'lg'
type Layout = 'row' | 'stack' | 'auto'
type Align = 'start' | 'center'

type Props = {
  utm: AppLinkUtm
  size?: Size
  layout?: Layout
  align?: Align
  className?: string
}

const HEIGHT_PX: Record<Size, number> = {
  sm: 36,
  md: 44,
  lg: 52,
}

const APPLE_ASPECT = 120 / 40
const GOOGLE_ASPECT = 135 / 40

export default function AppBadges({
  utm,
  size = 'md',
  layout = 'auto',
  align = 'start',
  className,
}: Props) {
  const height = HEIGHT_PX[size]
  const appleWidth = Math.round(height * APPLE_ASPECT)
  const googleWidth = Math.round(height * GOOGLE_ASPECT)

  const appleHref = appStoreLink(utm)
  const googleHref = playStoreLink(utm)

  const justify = align === 'center' ? 'center' : 'flex-start'

  // We avoid `flexDirection: 'column'` for `auto` by letting Tailwind-ish
  // responsive CSS handle it via a scoped <style>. Each instance gets a
  // unique data attribute so layouts don't collide.
  const id = `app-badges-${utm.source}-${utm.medium}-${utm.campaign}`
    .replace(/[^a-z0-9_-]/gi, '_')
    .toLowerCase()

  const flexDirection: 'row' | 'column' =
    layout === 'stack' ? 'column' : 'row'

  return (
    <div
      data-app-badges={id}
      className={className}
      style={{
        display: 'flex',
        flexDirection,
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: justify,
        gap: 12,
      }}
    >
      <a
        href={appleHref}
        aria-label="Download on the App Store"
        style={{ display: 'inline-block', lineHeight: 0 }}
      >
        <img
          src="/badges/app-store.svg"
          alt="Download on the App Store"
          width={appleWidth}
          height={height}
          style={{ height, width: 'auto', display: 'block' }}
        />
      </a>
      <a
        href={googleHref}
        aria-label="Get it on Google Play"
        style={{ display: 'inline-block', lineHeight: 0 }}
      >
        <img
          src="/badges/google-play.svg"
          alt="Get it on Google Play"
          width={googleWidth}
          height={height}
          style={{ height, width: 'auto', display: 'block' }}
        />
      </a>
      {layout === 'auto' && (
        <style>{`
          [data-app-badges="${id}"] { flex-direction: column; align-items: ${align === 'center' ? 'center' : 'flex-start'}; }
          @media (min-width: 640px) {
            [data-app-badges="${id}"] { flex-direction: row; align-items: center; }
          }
        `}</style>
      )}
    </div>
  )
}

// The Sell Your Shelf symbol — BINDING brand asset (PRODUCT.md).
// Four spines on a shelf rail: three upright with the second dimmed, one
// leaning away. Traced from public/icon.png (the app icon) so the web
// lockup and the store icon are the same mark, not two cousins.
// The wordmark and typeface may change; this symbol may not.

type Props = {
  size?: number
  /** Mark colour. Defaults to currentColor so it inherits the lockup. */
  color?: string
  className?: string
}

export default function BrandMark({ size = 28, color = 'currentColor', className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="Sell Your Shelf"
    >
      {/* Proportions scaled from public/icon.png: rail 467u wide, spines
          67/58/76u wide at 338/293/360u tall, gaps ~27u. */}
      {/* shelf rail */}
      <rect x="6" y="22.6" width="20" height="1.1" rx="0.55" fill={color} />
      {/* upright spines — the second one dimmed, as in the icon */}
      <rect x="7.7" y="8.1" width="2.87" height="14.5" rx="1.1" fill={color} />
      <rect x="11.73" y="10.1" width="2.48" height="12.5" rx="1" fill={color} opacity="0.72" />
      <rect x="15.37" y="7.2" width="3.25" height="15.4" rx="1.2" fill={color} />
      {/* the one that leans away */}
      <rect
        x="20.6"
        y="10.4"
        width="2.6"
        height="12.2"
        rx="1.05"
        fill={color}
        opacity="0.86"
        transform="rotate(21 21.9 22.6)"
      />
    </svg>
  )
}

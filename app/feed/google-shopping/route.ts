import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// Google Shopping condition mapping
const CONDITION_MAP: Record<string, string> = {
  like_new: 'used',
  very_good: 'used',
  good: 'used',
  acceptable: 'used',
}

// Escape XML special characters
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// Condition as human-readable for description
const CONDITION_LABELS: Record<string, string> = {
  like_new: 'Like New',
  very_good: 'Very Good',
  good: 'Good',
  acceptable: 'Acceptable',
}

// Common English words for language detection
const ENGLISH_WORDS = new Set(['the', 'and', 'is', 'was', 'for', 'that', 'with', 'this', 'are', 'have', 'from', 'not', 'but', 'been', 'they', 'which', 'their', 'will', 'one', 'all', 'would', 'can', 'has', 'her', 'his', 'she', 'had', 'you', 'were', 'who'])

function isLikelyEnglish(text: string): boolean {
  if (!text || text.length < 20) return true // Too short to judge, include it
  const words = text.toLowerCase().split(/\s+/)
  const englishWordCount = words.filter(w => ENGLISH_WORDS.has(w)).length
  return englishWordCount >= 3
}

// Feed titles carry the format when known — better query matching and CTR
const FORMAT_LABELS: Record<string, string> = {
  paperback: 'Paperback',
  hardback: 'Hardback',
}

// Free-shipping threshold must match checkout (create-order-payment-intent
// and the single-item flow): orders of £10+ ship free. Overstating shipping
// in the feed risks price-mismatch disapprovals.
const FREE_SHIPPING_THRESHOLD_GBP = 10
const SHIPPING_FLAT_GBP = 2.5

// Normalise an ISBN to a 13-digit GTIN. ISBN-13 passes through; ISBN-10 is
// converted (978 prefix + recomputed check digit). Anything else → null.
function isbnToGtin13(raw: string | null): string | null {
  if (!raw) return null
  const isbn = raw.replace(/[^0-9Xx]/g, '')
  if (/^[0-9]{13}$/.test(isbn)) return isbn
  if (/^[0-9]{9}[0-9Xx]$/.test(isbn)) {
    const core = '978' + isbn.slice(0, 9)
    let sum = 0
    for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3)
    return core + String((10 - (sum % 10)) % 10)
  }
  return null
}

export async function GET() {
  try {
    // Fetch ALL eligible listings — Supabase caps unpaginated queries at
    // 1,000 rows, which silently truncated the feed to 955 items while
    // ~2,500 listings were eligible. Page with .range() until exhausted.
    const PAGE_SIZE = 1000
    const listings: any[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('marketplace_listings')
        .select('id, title, author, asking_price_gbp, condition, isbn, description, edition_description, work_description, edition_cover, work_cover, edition_cover_hosted, work_cover_hosted, seller_cover_url, edition_publisher, format, category')
        .gte('asking_price_gbp', 3)
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)

      if (error) {
        console.error('Feed error:', error)
        return new NextResponse('Feed generation failed', { status: 500 })
      }
      if (!data || data.length === 0) break
      listings.push(...data)
      if (data.length < PAGE_SIZE) break
    }

    // Filter to listings with the data Google requires. Items without any
    // image are excluded outright — image_link is mandatory and imageless
    // items are disapproved anyway, so they'd only pollute the feed's
    // quality metrics.
    const items = listings.filter(l => {
      if (!l.title || !l.asking_price_gbp) return false
      const image = l.seller_cover_url || l.edition_cover_hosted || l.edition_cover || l.work_cover_hosted || l.work_cover
      if (!image) return false
      const desc = l.edition_description || l.work_description || l.description || ''
      return isLikelyEnglish(desc)
    })

    const xmlItems = items.map(listing => {
      // Seller's own photo first (it's the actual product being sold),
      // stock cover as fallback + additional image.
      const sellerPhoto = listing.seller_cover_url
      const stockCover = listing.edition_cover_hosted || listing.edition_cover || listing.work_cover_hosted || listing.work_cover
      const image = sellerPhoto || stockCover
      const additionalImage = sellerPhoto && stockCover ? stockCover : null

      const desc = listing.edition_description || listing.work_description || listing.description || ''
      const conditionLabel = CONDITION_LABELS[listing.condition] || listing.condition
      const priceNum = Number(listing.asking_price_gbp)
      const price = priceNum.toFixed(2)
      const shipping = priceNum >= FREE_SHIPPING_THRESHOLD_GBP ? '0.00' : SHIPPING_FLAT_GBP.toFixed(2)

      const gtin = isbnToGtin13(listing.isbn)
      const formatLabel = FORMAT_LABELS[listing.format] ?? null

      const title = `${listing.title}${listing.author ? ` - ${listing.author}` : ''}${formatLabel ? ` (${formatLabel})` : ''}`

      // Build description: condition + truncated book description
      const fullDesc = `Used copy in ${conditionLabel} condition. ${desc}`.slice(0, 5000)

      return `    <item>
      <g:id>listing-${listing.id}</g:id>
      <g:title>${escapeXml(title)}</g:title>
      <g:description>${escapeXml(fullDesc)}</g:description>
      <g:link>https://www.sellyourshelf.com/listing/${listing.id}</g:link>
      <g:image_link>${escapeXml(image)}</g:image_link>
${additionalImage ? `      <g:additional_image_link>${escapeXml(additionalImage)}</g:additional_image_link>\n` : ''}      <g:price>${price} GBP</g:price>
      <g:condition>${CONDITION_MAP[listing.condition] || 'used'}</g:condition>
      <g:availability>in stock</g:availability>
${gtin ? `      <g:gtin>${gtin}</g:gtin>\n` : `      <g:identifier_exists>no</g:identifier_exists>\n`}${listing.edition_publisher ? `      <g:brand>${escapeXml(listing.edition_publisher)}</g:brand>\n` : ''}      <g:product_type>Books</g:product_type>
      <g:google_product_category>Media &gt; Books</g:google_product_category>
      <g:shipping>
        <g:country>GB</g:country>
        <g:price>${shipping} GBP</g:price>
        <g:service>Standard</g:service>
      </g:shipping>
    </item>`
    }).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Sell Your Shelf — Secondhand Books</title>
    <link>https://www.sellyourshelf.com</link>
    <description>Buy secondhand books from UK sellers. Secure payments, tracked shipping.</description>
${xmlItems}
  </channel>
</rss>`

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    })
  } catch (err) {
    console.error('Feed error:', err)
    return new NextResponse('Feed generation failed', { status: 500 })
  }
}

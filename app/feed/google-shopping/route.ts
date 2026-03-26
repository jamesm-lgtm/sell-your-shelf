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

export async function GET() {
  try {
    // Fetch active listings with book data via the marketplace_listings view
    const { data: listings, error } = await supabase
      .from('marketplace_listings')
      .select('id, title, author, asking_price_gbp, condition, isbn, description, edition_description, work_description, edition_cover, work_cover, edition_publisher, format, category')
      .gte('asking_price_gbp', 3)
      .limit(1000)

    if (error) {
      console.error('Feed error:', error)
      return new NextResponse('Feed generation failed', { status: 500 })
    }

    // Filter to listings that have status=active (view should only return active, but be safe)
    const items = (listings || []).filter(l => l.title && l.asking_price_gbp)

    const now = new Date().toISOString()

    const xmlItems = items.map(listing => {
      const cover = listing.edition_cover || listing.work_cover
      const desc = listing.edition_description || listing.work_description || listing.description || ''
      const conditionLabel = CONDITION_LABELS[listing.condition] || listing.condition
      const price = Number(listing.asking_price_gbp).toFixed(2)

      // Build description: condition + truncated book description
      const fullDesc = `Used copy in ${conditionLabel} condition. ${desc}`.slice(0, 5000)

      return `    <item>
      <g:id>listing-${listing.id}</g:id>
      <g:title>${escapeXml(`${listing.title}${listing.author ? ` - ${listing.author}` : ''}`)}</g:title>
      <g:description>${escapeXml(fullDesc)}</g:description>
      <g:link>https://www.sellyourshelf.com/listing/${listing.id}</g:link>
${cover ? `      <g:image_link>${escapeXml(cover)}</g:image_link>\n` : ''}      <g:price>${price} GBP</g:price>
      <g:condition>${CONDITION_MAP[listing.condition] || 'used'}</g:condition>
      <g:availability>in stock</g:availability>
${listing.isbn ? `      <g:gtin>${escapeXml(listing.isbn)}</g:gtin>\n` : ''}${listing.edition_publisher ? `      <g:brand>${escapeXml(listing.edition_publisher)}</g:brand>\n` : ''}      <g:product_type>Books</g:product_type>
      <g:google_product_category>Media &gt; Books</g:google_product_category>
      <g:shipping>
        <g:country>GB</g:country>
        <g:price>2.50 GBP</g:price>
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

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

export async function GET() {
  try {
    // Fetch active listings with book data via the marketplace_listings view
    // Include hosted cover columns for Google Merchant Centre compliance
    // Paginate to avoid Supabase 1000-row default limit
    const listings: any[] = [];
    {
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error: fetchErr } = await supabase
          .from('marketplace_listings')
          .select('id, title, author, asking_price_gbp, condition, isbn, description, edition_description, work_description, edition_cover, work_cover, edition_cover_hosted, work_cover_hosted, edition_publisher, format, category')
          .gte('asking_price_gbp', 3)
          .range(from, from + PAGE - 1);
        if (fetchErr) {
          console.error('Feed error:', fetchErr);
          return new NextResponse('Feed generation failed', { status: 500 });
        }
        listings.push(...(data || []));
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
    }

    // Filter to listings that have valid data and are likely English
    const items = (listings || []).filter(l => {
      if (!l.title || !l.asking_price_gbp) return false
      const desc = l.edition_description || l.work_description || l.description || ''
      return isLikelyEnglish(desc)
    })

    const xmlItems = items.map(listing => {
      // Prefer hosted URLs, fall back to originals
      const cover = listing.edition_cover_hosted || listing.edition_cover || listing.work_cover_hosted || listing.work_cover
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

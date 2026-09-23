import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import AuthorHub from '@/app/components/AuthorHub'
import { getAuthorHub, INDEX_THRESHOLD } from '@/app/lib/authorHub'

export const revalidate = 0

/**
 * Same page as /author/[slug], different noun.
 *
 * CGP Books is why this route exists: 103 live copies across 84 titles, and
 * the only query cluster on the site already ranking well (position 7.5),
 * because revision-guide buyers genuinely search by publisher rather than by
 * author. Filing it under /author would be a lie about what it is; blocking it
 * would throw away the one thing already working.
 */
type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const hub = await getAuthorHub(slug, 'publisher')
  if (!hub) return { title: 'Not found | Sell Your Shelf' }

  const url = `https://www.sellyourshelf.com/publisher/${hub.slug}`
  const indexable = hub.liveCopies >= INDEX_THRESHOLD

  const description = hub.liveCopies
    ? `${hub.liveCopies} second-hand ${hub.liveCopies === 1 ? 'title' : 'titles'} from ${hub.displayName}` +
      (hub.lowestPriceGbp != null ? `, from £${hub.lowestPriceGbp.toFixed(2)}` : '') +
      `. Bought from real people clearing their shelves, with free delivery over £10.`
    : `Second-hand ${hub.displayName} titles on Sell Your Shelf.`

  return {
    title: `${hub.displayName} — second-hand | Sell Your Shelf`,
    description,
    alternates: { canonical: url },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: { title: `Second-hand ${hub.displayName} titles`, description, url, type: 'website' },
  }
}

export default async function PublisherPage({ params }: Props) {
  const { slug } = await params
  const hub = await getAuthorHub(slug, 'publisher')
  if (!hub) notFound()
  return <AuthorHub hub={hub} />
}

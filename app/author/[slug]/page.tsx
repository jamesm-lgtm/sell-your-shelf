import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import AuthorHub from '@/app/components/AuthorHub'
import { getAuthorHub, INDEX_THRESHOLD } from '@/app/lib/authorHub'

export const revalidate = 0

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const hub = await getAuthorHub(slug, 'person')
  if (!hub) return { title: 'Not found | Sell Your Shelf' }

  const url = `https://www.sellyourshelf.com/author/${hub.slug}`

  /**
   * Indexed only at five live copies or more.
   *
   * A page below that still serves — the URL keeps working for anyone holding
   * the link, and there is no redirect — it just doesn't go in the index or
   * the sitemap. That matters because inventory here churns by removal rather
   * than by selling (1,137 removed against 40 sold ever), and removal is
   * frequently reversible. A 410 would throw away an earned ranking for a
   * condition that often lasts a week.
   */
  const indexable = hub.liveCopies >= INDEX_THRESHOLD

  const description = hub.liveCopies
    ? `${hub.liveCopies} second-hand ${hub.liveCopies === 1 ? 'book' : 'books'} by ${hub.displayName}` +
      (hub.lowestPriceGbp != null ? `, from £${hub.lowestPriceGbp.toFixed(2)}` : '') +
      `. Bought from real people clearing their shelves, with free delivery over £10.`
    : `Second-hand books by ${hub.displayName} on Sell Your Shelf.`

  return {
    title: `${hub.displayName} — second-hand books | Sell Your Shelf`,
    description,
    alternates: { canonical: url },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: { title: `Second-hand books by ${hub.displayName}`, description, url, type: 'website' },
  }
}

export default async function AuthorPage({ params }: Props) {
  const { slug } = await params
  const hub = await getAuthorHub(slug, 'person')
  if (!hub) notFound()
  return <AuthorHub hub={hub} />
}

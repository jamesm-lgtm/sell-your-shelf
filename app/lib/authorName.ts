/**
 * Turning a credit string into contributors.
 *
 * `listings.author` and `books.author` are not names. Live values include:
 *
 *   "David Walliams"
 *   "Walliams, David"
 *   "david walliams; illustrated by quentin blake"
 *   "CGP Books, Richard Parsons"
 *   "<unknown>"
 *
 * A comma means two opposite things — "Wilson, Jacqueline" is one person
 * inverted, "CGP Books, Richard Parsons" is two people — and nothing in the
 * string says which. Measured against the live corpus, evidence-based rules
 * settle 251 of the 779 comma-bearing strings; the other 528 need world
 * knowledge and go to the model (see scripts/backfill-authors.ts).
 *
 * Everything here is deterministic and side-effect free so it can be run over
 * the whole catalogue repeatedly, and so the model is only asked about strings
 * the rules genuinely cannot decide.
 */

export type Contributor = {
  /** Display form: "First Surname", title-cased. */
  name: string
  kind: 'person' | 'publisher' | 'unknown'
}

export type ParseResult =
  | { status: 'resolved'; contributors: Contributor[] }
  /** Rules can't decide. Hand the raw string to the model. */
  | { status: 'ambiguous'; raw: string }
  /** Deliberately has no page — "Unknown Author" and its many spellings. */
  | { status: 'junk' }

/**
 * Every spelling of "we don't know" in the live data. The brief counted the
 * 115 "Unknown Author" rows; there are also "unknown", "<unknown>", "unknown
 * from ocr", "unknown poet/author" and several more, because the field is
 * filled by OCR and identification rather than typed by a person. A list of
 * exact strings would miss most of them.
 */
const JUNK = /^(<?unknown>?\b|n\/?a$|various\b|anon(ymous)?\b|no author\b)/i

/** Publisher-ish credits. Deliberately narrow: a false positive files a real
 *  person under /publisher, which is worse than leaving them as a person. */
const PUBLISHER = /\b(books?|publishing|publications?|press|media|ltd|limited|inc)\b/i

/** Words that mark the rest of a credit as a role, not another author. */
const ROLE = /\b(illustrated|illustrator|translated|translator|edited|editor|foreword|introduction|adapted|photographs?)\b/i

const SUFFIX = /^(jr|sr|i{1,3}|iv|v|phd|md|obe|mbe|cbe)\.?$/i

/**
 * A corporate suffix is part of a company's name, not another contributor.
 *
 * "Egmont Books, Limited" and "HarperCollins Canada, Limited" are single
 * publishers that happen to contain a comma. Split naively they produced a
 * contributor called "Limited", which cleared five copies and would have gone
 * live as a page titled Limited.
 */
const CORPORATE_TAIL = /^(limited|ltd|inc|incorporated|llc|plc|co|company|gmbh|sa|bv|pty)\.?$/i

/**
 * Trailing corporate suffix, stripped for grouping only.
 *
 * "Igloo Books" and "Igloo Books Ltd" are the same publisher and were two
 * separate pages. Applied to publishers alone — a person can legitimately be
 * called Co or Sa, and this must never touch a personal name.
 */
const dropCorporateTail = (name: string) => {
  const words = name.split(/\s+/)
  while (words.length > 1 && CORPORATE_TAIL.test(words[words.length - 1])) words.pop()
  return words.join(' ')
}

const titleCase = (s: string) =>
  s
    .split(/\s+/)
    .map((w) =>
      // Initials and hyphenated names both need per-part capitalisation:
      // "j.k." -> "J.K.", "smith-jones" -> "Smith-Jones".
      w
        .split('-')
        .map((part) =>
          part
            .split('.')
            .map((bit) => (bit ? bit[0].toUpperCase() + bit.slice(1) : bit))
            .join('.'),
        )
        .join('-'),
    )
    .join(' ')

const tidy = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/\s*\.\s*$/, '')
    .trim()

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // rachel renée russell -> rachel renee russell
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const classify = (name: string): Contributor['kind'] =>
  PUBLISHER.test(name) ? 'publisher' : 'person'

/** Looks like a personal name rather than an organisation or a fragment. */
const isPersonalName = (s: string) => {
  const words = s.split(/\s+/).filter((w) => !SUFFIX.test(w))
  return words.length >= 1 && words.length <= 4 && !PUBLISHER.test(s)
}

/**
 * @param raw        the credit string as stored
 * @param standalone lowercased names that appear elsewhere in the corpus with
 *                   no comma. This is what lets "CGP Books, Richard Parsons"
 *                   be recognised as two people: both halves stand alone.
 *                   Pass an empty set to disable corpus evidence.
 */
export function parseCredit(raw: string, standalone: Set<string> = new Set()): ParseResult {
  const cleaned = tidy(raw ?? '')
  if (!cleaned || cleaned.length < 2) return { status: 'junk' }
  if (JUNK.test(cleaned)) return { status: 'junk' }

  // Semicolons, ampersands and " and " are unambiguous separators. Anything
  // after a role word is a credit for someone else's contribution to the same
  // book, which we keep — it is still a real contributor.
  const segments = cleaned
    .split(/;|&|\band\b/i)
    .map((s) => tidy(s.replace(ROLE, '').replace(/^\s*by\s+/i, '')))
    .filter(Boolean)

  const out: Contributor[] = []

  for (const segment of segments) {
    if (!segment.includes(',')) {
      if (JUNK.test(segment)) continue
      out.push({ name: titleCase(segment), kind: classify(segment) })
      continue
    }

    const parts = segment
      .split(',')
      .map(tidy)
      .filter((p) => p && !SUFFIX.test(p))

    if (parts.length === 0) continue
    if (parts.length === 1) {
      out.push({ name: titleCase(parts[0]), kind: classify(parts[0]) })
      continue
    }

    // Three or more comma-separated parts is a list of contributors — an
    // inversion only ever has two halves.
    if (parts.length > 2) {
      for (const p of parts) {
        if (JUNK.test(p)) continue
        out.push({ name: titleCase(p), kind: classify(p) })
      }
      continue
    }

    const [a, b] = parts

    // "Egmont Books, Limited" is one publisher, not two contributors. Check
    // this before any of the inversion logic, which would otherwise read it
    // as "Limited Egmont Books".
    if (CORPORATE_TAIL.test(b)) {
      const joined = `${a} ${b}`
      out.push({ name: titleCase(dropCorporateTail(joined)), kind: classify(joined) })
      continue
    }

    const flipped = `${b} ${a}`.toLowerCase()
    const flipExists = standalone.has(flipped)
    const bothStandAlone = standalone.has(a.toLowerCase()) && standalone.has(b.toLowerCase())

    if (flipExists && !bothStandAlone) {
      out.push({ name: titleCase(`${b} ${a}`), kind: classify(flipped) })
      continue
    }
    if (bothStandAlone && !flipExists) {
      out.push({ name: titleCase(a), kind: classify(a) })
      out.push({ name: titleCase(b), kind: classify(b) })
      continue
    }

    // No corpus evidence. One safe call is still available: an organisation on
    // either side means these are separate credits, because no publisher is
    // anyone's surname. "CGP Books, Richard Parsons" resolves here.
    if (PUBLISHER.test(a) || PUBLISHER.test(b)) {
      out.push({ name: titleCase(a), kind: classify(a) })
      out.push({ name: titleCase(b), kind: classify(b) })
      continue
    }

    // Two plausible personal names and nothing to separate them:
    // "Malpas, Jodi Ellen" (inverted) and "Gaiman, Pratchett" (two authors)
    // are the same shape. This is the 528-string residue the model handles.
    if (isPersonalName(a) && isPersonalName(b)) return { status: 'ambiguous', raw: cleaned }

    out.push({ name: titleCase(`${b} ${a}`), kind: 'person' })
  }

  const kept = out
    // Publishers only: a trailing Ltd/Limited/Inc is the same company written
    // differently, and left alone it mints a second page for it.
    .map((c) => (c.kind === 'publisher' ? { ...c, name: titleCase(dropCorporateTail(c.name)) } : c))
    .filter((c) => c.name.length > 2 && !JUNK.test(c.name) && !CORPORATE_TAIL.test(c.name))
  return kept.length ? { status: 'resolved', contributors: kept } : { status: 'junk' }
}

/**
 * Guardrail for anything the model returns.
 *
 * The failure that matters is not a refusal to parse — it is a silent
 * "correction" of an obscure real name to a famous similar one. The live data
 * holds both "erin russell" (10 copies) and "rachel renée russell" (36);
 * folding the first into the second would merge two authors into one page with
 * no error raised anywhere.
 *
 * So the model is only ever allowed to split and reorder what it was given.
 * Returns the tokens it invented — non-empty means do not trust the row.
 */
export function inventedTokens(raw: string, contributors: Contributor[]): string[] {
  const tokensOf = (s: string) =>
    (s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9']+/g) ?? [])
  const input = new Set(tokensOf(raw))
  return contributors
    .flatMap((c) => tokensOf(c.name))
    .filter((t) => t.length > 1 && !input.has(t))
}

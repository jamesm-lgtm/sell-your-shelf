/**
 * Phase 2 of author resolution: the credit strings rules can't decide.
 *
 * A comma in a credit string means two opposite things — "Wilson, Jacqueline"
 * is one person inverted, "Gaiman, Pratchett" is two people — and the shapes
 * are identical. Corpus evidence (does the flipped form appear elsewhere? do
 * both halves stand alone?) settles about a third of them; the rest need to
 * know that Jodi Ellen Malpas writes romance and CGP is a revision-guide
 * publisher. That's what this is for. 1,385 distinct strings as of the first
 * backfill.
 *
 * This function ONLY transforms strings. It does not touch the database and it
 * does not decide what gets a page — grouping variants and applying the
 * five-copy threshold happen afterwards in SQL, where they are deterministic
 * and free to re-run. Mixing the two would invite the model to invent merges.
 *
 * Deploy:
 *   supabase functions deploy resolve-author-credits
 *
 * Called by scripts/resolve-ambiguous-authors.ts, which owns the guardrail:
 * every token the model returns must already appear in the input string, or
 * the row is flagged rather than trusted. See app/lib/authorName.ts.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Keeps one request comfortably inside the edge function's time budget. */
const MAX_CREDITS_PER_CALL = 80

const SYSTEM = `You split book credit strings into individual contributors.

These strings come from OCR and automated book identification, so they are messy. Your only job is to work out, for each string, who the contributors are and how each name should read.

Rules, in order of importance:

1. NEVER introduce a name, word, or initial that is not already present in the input string. You may only reorder and split what you are given. If a string looks like a misspelling of a famous author, leave it exactly as written. "Erin Russell" must stay "Erin Russell" — it must NOT become "Rachel Renee Russell". Getting this wrong silently merges two real authors, which is far worse than leaving a name untidy.

2. Decide what each comma means. "Wilson, Jacqueline" is ONE person written surname-first, so it becomes "Jacqueline Wilson". "CGP Books, Richard Parsons" is TWO contributors. Use what you know about real authors and publishers to tell them apart.

3. Capitalise names normally: "jodi ellen malpas" becomes "Jodi Ellen Malpas". Keep initials as given: "j.k. rowling" becomes "J.K. Rowling".

4. Set kind to "publisher" for imprints and companies (CGP Books, Usborne, Ladybird), "person" for people, "unknown" if a fragment is neither — a role word, a stray phrase, or something unreadable.

5. Drop segments that name no contributor at all: "unknown", "various", "n/a", "illustrated by" with nothing after it. If a whole string yields nothing, return an empty contributors array for it.

Return one entry per input string, in the same order you received them.`

type Body = { credits?: unknown }

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500)

    const body = (await req.json()) as Body
    const credits = Array.isArray(body.credits)
      ? body.credits.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      : []

    if (!credits.length) return json({ error: 'credits must be a non-empty string array' }, 400)
    if (credits.length > MAX_CREDITS_PER_CALL) {
      return json({ error: `at most ${MAX_CREDITS_PER_CALL} credits per call` }, 400)
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-5',
        max_tokens: 16000,
        // Mechanical classification rather than reasoning — low effort is the
        // right setting and materially cheaper across ~1,400 strings.
        output_config: {
          effort: 'low',
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['results'],
              properties: {
                results: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['raw', 'contributors'],
                    properties: {
                      raw: { type: 'string' },
                      contributors: {
                        type: 'array',
                        items: {
                          type: 'object',
                          additionalProperties: false,
                          required: ['name', 'kind'],
                          properties: {
                            name: { type: 'string' },
                            kind: { type: 'string', enum: ['person', 'publisher', 'unknown'] },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content:
              'Split each of these credit strings into contributors:\n\n' +
              credits.map((c, i) => `${i + 1}. ${c}`).join('\n'),
          },
        ],
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('[resolve-author-credits] anthropic error', response.status, detail.slice(0, 500))
      return json({ error: `anthropic ${response.status}` }, 502)
    }

    const data = await response.json()

    // A safety decline arrives as HTTP 200 with stop_reason "refusal", so the
    // status code alone isn't enough to know the call succeeded.
    if (data.stop_reason === 'refusal') {
      console.error('[resolve-author-credits] refused', JSON.stringify(data.stop_details ?? {}))
      return json({ error: 'refused', stop_details: data.stop_details ?? null }, 502)
    }

    const text = (data.content ?? [])
      .filter((b: { type?: string }) => b.type === 'text')
      .map((b: { text?: string }) => b.text ?? '')
      .join('')

    let parsed: { results?: unknown }
    try {
      parsed = JSON.parse(text)
    } catch {
      console.error('[resolve-author-credits] unparseable response', text.slice(0, 500))
      return json({ error: 'model returned unparseable JSON' }, 502)
    }

    const results = Array.isArray(parsed.results) ? parsed.results : []

    // The caller pairs results back to inputs by `raw`, so a short or
    // reordered array is survivable — but it means something went wrong and
    // is worth seeing in the logs.
    if (results.length !== credits.length) {
      console.warn(
        `[resolve-author-credits] asked for ${credits.length}, got ${results.length}`,
      )
    }

    return json({ results, usage: data.usage ?? null })
  } catch (err) {
    console.error('[resolve-author-credits]', err)
    return json({ error: err instanceof Error ? err.message : 'unknown error' }, 500)
  }
})

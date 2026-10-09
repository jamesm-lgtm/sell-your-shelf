/**
 * A way for a seller to tell us what happened to an order, from an email,
 * with no login.
 *
 * WHY
 *
 * Eight sellers explained why they had not posted. Every one reached us
 * through James's personal phone. Three no longer had the book; one had
 * already posted it and our database still said otherwise because he had no
 * way to tell us. Becky's words: "I'm not sure how to cancel the sale."
 *
 * So the single largest cause of failed dispatch is invisible for twelve days
 * and then surfaces as a cancellation with no reason attached. Three taps fix
 * that, and every use of them produces data the database currently cannot.
 *
 * WHY THIS SERVES ITS OWN HTML
 *
 * The link has to work from an email on a phone with nobody logged in. Doing
 * it here rather than in the Next app keeps the signing secret in Supabase,
 * where it already lives — the web app has only SUPABASE_SECRET_KEY, and
 * copying a signing secret into Vercel to render two buttons is a poor trade.
 *
 * TOKENS
 *
 * <orderId>.<hmac>, where hmac is HMAC-SHA256 over "order-action:<orderId>"
 * keyed with PREFERENCE_CENTRE_SECRET — the secret already used for
 * user-facing tokenised links. The "order-action:" prefix is domain
 * separation: a token minted here can never be replayed against the
 * preference centre, and vice versa.
 *
 * Tokens do not expire. An order reaches a terminal state within days and
 * every action re-checks that state, so an old link is harmless — and a
 * seller finding a two-week-old email and finally telling us the book is gone
 * is exactly the outcome we want, not one to expire away.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SECRET = Deno.env.get('PREFERENCE_CENTRE_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const enc = new TextEncoder()

/**
 * Tell the buyer their parcel is on its way.
 *
 * There are three routes by which an order becomes "shipped" and until now
 * only one of them — the app's mark-shipped button — told the buyer anything.
 * This one wrote status straight to the table and emailed ops, while the page
 * it returned told the seller "we've let the buyer know". That claim was
 * false, and the chase emails now lead with this button, so the path was about
 * to carry far more traffic than it used to.
 *
 * Returns whether a buyer was actually emailed, because the page should only
 * claim it when it happened.
 *
 * eBay orders have no buyer_id on our side — the buyer is eBay's customer and
 * never had an account here — so there is nobody to write to and this returns
 * false. Note that we do NOT push fulfilment back to eBay either, so an eBay
 * buyer who is told by this route is told by nobody. That gap is real and
 * wants its own fix; it is not this function's to close.
 *
 * Never throws. A seller did their part by tapping the button, and losing that
 * because our mail provider blinked would be the worst possible outcome — the
 * same rule notifyOps follows.
 */
async function notifyBuyerShipped(orderId: string): Promise<boolean> {
  try {
    const { data: order, error } = await supabase
      .from('orders').select('buyer_id').eq('id', orderId).maybeSingle()
    if (error) {
      console.error('[order-action] buyer lookup failed', orderId, error.message)
      return false
    }
    if (!order?.buyer_id) return false  // eBay order — no account on our side

    const { data: buyer } = await supabase
      .from('users').select('email, first_name, username').eq('id', order.buyer_id).maybeSingle()
    if (!buyer?.email) return false

    const { data: rows } = await supabase
      .from('order_items').select('title, author').eq('order_id', orderId)
    const items = rows ?? []
    const buyerName = buyer.first_name ?? buyer.username ?? ''

    // send-email picks the multi-item template off the presence of `items`,
    // so a three-book order lists all three rather than naming one of them.
    const payload = items.length > 1
      ? { buyerName, items: items.map((i) => ({ title: i.title, author: i.author })) }
      : { buyerName, bookTitle: items[0]?.title ?? 'Your book', bookAuthor: items[0]?.author ?? '' }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ type: 'order_shipped', to: buyer.email, data: payload }),
    })
    if (!res.ok) {
      console.error('[order-action] order_shipped failed', res.status, (await res.text()).slice(0, 300))
      return false
    }
    return true
  } catch (err) {
    console.error('[order-action] notifyBuyerShipped threw', err)
    return false
  }
}

/**
 * Tell James a seller needs something done.
 *
 * The refund is deliberately NOT automated. This link lives in an email,
 * emails get forwarded, and tokens here do not expire — so a URL that moves
 * money is a URL that anyone down the forwarding chain can fire. Recording
 * the seller's answer is safe; executing a payment from a link is not.
 *
 * That trade only holds if someone actually sees the answer, which is what
 * this is. Failure to notify must never fail the seller's action — they did
 * their part, and losing their answer because our mail provider blinked would
 * be the worst possible outcome.
 */
async function notifyOps(subject: string, lines: string[]): Promise<void> {
  const key = Deno.env.get('RESEND_API_KEY')
  const to = Deno.env.get('ALERT_EMAIL')
  if (!key || !to) {
    console.warn('[order-action] no RESEND_API_KEY/ALERT_EMAIL — seller answer recorded but nobody told')
    return
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Sell Your Shelf <noreply@sellyourshelf.com>',
        to: [to],
        subject,
        html: lines.map((l) => `<p style="margin:0 0 10px">${l}</p>`).join(''),
      }),
    })
    if (!res.ok) console.error('[order-action] notify failed', res.status, (await res.text()).slice(0, 300))
  } catch (err) {
    console.error('[order-action] notify threw', err)
  }
}

async function sign(orderId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(SECRET ?? ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`order-action:${orderId}`))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

/** Constant-time compare, so a wrong token cannot be brute-forced byte by byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function tokenFor(orderId: string): Promise<string> {
  return `${orderId}.${await sign(orderId)}`
}

async function orderIdFromToken(token: string): Promise<string | null> {
  const dot = token.lastIndexOf('.')
  if (dot < 1) return null
  const id = token.slice(0, dot)
  const mac = token.slice(dot + 1)
  return safeEqual(mac, await sign(id)) ? id : null
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

function page(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} — Sell Your Shelf</title>
<style>
 :root{color-scheme:light}
 body{margin:0;background:#FAF7F2;color:#1A1D1B;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
 .w{max-width:520px;margin:0 auto;padding:40px 20px 64px}
 h1{font:600 24px/1.25 Georgia,serif;margin:0 0 8px}
 p{margin:0 0 16px;color:#55605A}
 .book{background:#fff;border:1px solid #DED6C9;border-radius:3px;padding:14px 16px;margin:0 0 24px}
 .book strong{color:#1A1D1B}
 form{margin:0 0 12px}
 button{width:100%;padding:14px 18px;font:600 15px/1 inherit;border-radius:999px;cursor:pointer;border:1px solid #DED6C9;background:#fff;color:#1A1D1B;text-align:left}
 button.p{background:#2D4A3E;color:#FAF7F2;border-color:#2D4A3E}
 button span{display:block;font-weight:400;font-size:13px;opacity:.75;margin-top:3px}
 textarea{width:100%;box-sizing:border-box;padding:12px;border:1px solid #DED6C9;border-radius:3px;font:inherit;margin-bottom:10px}
 .f{margin-top:28px;font-size:13px;color:#67716B}
 a{color:#8A5A16}
</style></head><body><div class="w">${body}</div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  )
}

Deno.serve(async (req: Request) => {
  try {
    if (!SECRET) return page('Unavailable', '<h1>Not available</h1><p>This link cannot be checked right now. Please reply to your email instead.</p>', 500)

    const url = new URL(req.url)

    /**
     * Mint a link for an order. Service-role only.
     *
     * send-email needs this to put the link in the sale email, and support
     * needs it when a seller says "I've lost the email". Guarded by the
     * service key rather than the token scheme, because this is the thing
     * that issues tokens.
     */
    const mint = url.searchParams.get('mint')
    if (mint) {
      const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (!key || req.headers.get('Authorization') !== `Bearer ${key}`) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ orderId: mint, token: await tokenFor(mint) }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const token = url.searchParams.get('t') ?? ''
    const orderId = await orderIdFromToken(token)
    if (!orderId) {
      return page('Link not recognised',
        `<h1>This link isn't valid</h1><p>It may have been altered on its way to you. Reply to the email it came from and we'll sort it out.</p>`, 404)
    }

    const { data: order, error: lookupErr } = await supabase
      .from('order_stages')
      .select('id, stage, seller_response, shipped_at, cancelled_at, seller_payout_gbp')
      .eq('id', orderId)
      .maybeSingle()

    // A broken query and a genuinely missing order are NOT the same thing, and
    // conflating them is how a seller gets told their order does not exist
    // while it sits there perfectly fine. That happened during testing: the
    // order_stages view had gone stale after a column was added to orders, the
    // select failed, and the page confidently reported "we can't find that
    // order". Say "our end" when it is our end.
    if (lookupErr) {
      console.error('[order-action] lookup failed', orderId, lookupErr.message)
      return page('Something went wrong',
        `<h1>Something went wrong at our end</h1><p>Your order is fine — we just couldn't load it. Reply to your email and we'll sort it.</p>`, 500)
    }
    if (!order) return page('Not found', `<h1>We can't find that order</h1><p>Reply to your email and we'll look it up.</p>`, 404)

    const { data: items } = await supabase.from('order_items').select('title').eq('order_id', orderId)
    const titles = (items ?? []).map((i) => i.title).filter(Boolean)
    const bookLine = titles.length
      ? `<div class="book"><strong>${esc(titles.join(', '))}</strong></div>`
      : ''

    // Already resolved. Say so rather than offering buttons that will not fire —
    // a seller who clicks twice should see the same calm answer both times.
    if (order.stage === 'dispatched' || order.stage === 'cancelled') {
      const done = order.stage === 'dispatched'
        ? `<h1>That's already marked as posted</h1><p>Nothing more to do — thank you.</p>`
        : `<h1>That order has been cancelled</h1><p>The buyer has been refunded. Nothing is owed by you.</p>`
      return page('Already done', bookLine + done)
    }

    if (req.method === 'POST') {
      const form = await req.formData()
      const action = String(form.get('action') ?? '')
      const note = String(form.get('note') ?? '').slice(0, 2000)
      const now = new Date().toISOString()

      if (action === 'posted') {
        // Guarded on 'paid' exactly as mark-shipped is, so a race with the app
        // cannot double-write or resurrect a cancelled order.
        const { error } = await supabase
          .from('orders')
          .update({ status: 'shipped', shipped_at: now, seller_response: 'posted', seller_response_at: now })
          .eq('id', orderId).eq('status', 'paid')
        if (error) throw error
        // Only claim the buyer was told when they actually were. eBay buyers
        // have no account here, so there is nobody for us to write to.
        const told = await notifyBuyerShipped(orderId)
        return page('Thank you', bookLine +
          `<h1>Thanks — marked as posted</h1>
           <p>${told ? `We've let the buyer know it's on its way.` : `That's logged at our end.`}</p>
           <p class="f">If you haven't actually posted it yet, just reply to your email and we'll put it back.</p>`)
      }

      if (action === 'no_longer_have') {
        // Records the outcome and stops the chase. The refund itself stays with
        // the existing cancellation flow rather than being triggered from a
        // link in an email — moving money should not hang off a URL anyone
        // could forward.
        const { error } = await supabase
          .from('orders')
          .update({ seller_response: 'no_longer_have', seller_response_at: now, seller_response_note: note || null })
          .eq('id', orderId)
        if (error) throw error
        await notifyOps(
          `Refund needed — seller no longer has the book`,
          [
            `<strong>${esc(titles.join(', ') || 'Order ' + orderId)}</strong>`,
            `The seller says they no longer have this book.`,
            note ? `They added: &ldquo;${esc(note)}&rdquo;` : `They left no note.`,
            `Payout was £${Number(order.seller_payout_gbp ?? 0).toFixed(2)}. <strong>Cancel and refund the buyer.</strong>`,
            `Order id: <code>${esc(orderId)}</code>`,
          ],
        )
        return page('Thank you', bookLine +
          `<h1>Thanks for telling us</h1>
           <p>We'll cancel this and refund the buyer. You don't owe anything, and nothing has been taken from you.</p>
           <p class="f">It happens — books get donated, lent, sold elsewhere. Worth a look through your other listings when you get a minute, so it doesn't happen again.</p>`)
      }

      if (action === 'problem') {
        const { error } = await supabase
          .from('orders')
          .update({ seller_response: 'problem', seller_response_at: now, seller_response_note: note || null })
          .eq('id', orderId)
        if (error) throw error
        await notifyOps(
          `Seller reported a problem with an order`,
          [
            `<strong>${esc(titles.join(', ') || 'Order ' + orderId)}</strong>`,
            note ? `&ldquo;${esc(note)}&rdquo;` : `They left no note — worth calling them.`,
            `Order id: <code>${esc(orderId)}</code>`,
          ],
        )
        return page('Thank you', bookLine +
          `<h1>Thanks — that's with us</h1><p>James will pick this up and come back to you directly.</p>`)
      }

      return page('Unknown action', `<h1>Something went wrong</h1><p>Please reply to your email instead.</p>`, 400)
    }

    const t = esc(token)
    return page('Your order', bookLine + `
      <h1>What happened with this one?</h1>
      <p>Whichever applies — it all helps, and none of it gets you in trouble.</p>
      <form method="post"><input type="hidden" name="t" value="${t}">
        <input type="hidden" name="action" value="posted">
        <button class="p" type="submit">I've posted it<span>We'll tell the buyer it's on its way</span></button></form>
      <form method="post">
        <input type="hidden" name="action" value="no_longer_have">
        <button type="submit">I no longer have this book<span>We'll cancel it and refund the buyer. No problem at all</span></button></form>
      <form method="post">
        <input type="hidden" name="action" value="problem">
        <textarea name="note" rows="3" placeholder="Something else? Tell us what happened."></textarea>
        <button type="submit">Something's wrong<span>Goes straight to James</span></button></form>
      <p class="f">Take it to an InPost shop — a counter inside a shop, not an outdoor locker. Your code won't work in a locker.</p>`)
  } catch (err) {
    console.error('[order-action]', err)
    return page('Error', `<h1>Something went wrong</h1><p>Please reply to your email and we'll sort it.</p>`, 500)
  }
})

// send-email
//
// Resend-backed transactional email sender. Accepts one of:
//   - order_confirmation  (buyer; single-item or multi-item)
//   - new_sale            (seller; single-item or multi-item)
//   - order_shipped       (buyer; single-item or multi-item)
//   - onboarding_reminder (seller; unchanged)
//
// Multi-item mode is selected by the presence of a non-empty `data.items`
// array. Single-item payloads (the iOS legacy flow) keep working unchanged
// so this function can be deployed without breaking existing transactions.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ---------- types ----------

interface MultiItemBookLine {
  title: string
  author?: string | null
  priceGbp?: number
  // seller-side extras
  platformFeeGbp?: number
  payoutGbp?: number
}

interface EmailRequest {
  type: 'order_confirmation' | 'new_sale' | 'order_shipped' | 'onboarding_reminder'
  to: string
  data: {
    // Common
    buyerName?: string
    sellerName?: string
    sellerUsername?: string
    name?: string

    // ---- Legacy single-item fields (kept for backward compat) ----
    bookTitle?: string
    bookAuthor?: string
    bookPrice?: number
    shippingCharge?: number
    totalPaid?: number
    platformFee?: number
    sellerReceives?: number
    price?: number
    shippingAddress?: string | Record<string, string>
    trackingNumber?: string
    trackingUrl?: string
    requirement?: string

    // ---- Multi-item fields ----
    items?: MultiItemBookLine[]
    subtotalGbp?: number
    shippingGbp?: number
    totalGbp?: number
    walletAppliedGbp?: number
    cardChargedGbp?: number
    totalPlatformFeeGbp?: number
    totalPayoutGbp?: number
    parcelTier?: string
    estimatedDeliveryDays?: string
    orderId?: string
  }
}

// ---------- shared chrome ----------

const FOREST_DEEP = '#2D4A3E'
const CREAM = '#FAF8F5'

const footerHtml = `
  <div style="border-top: 1px solid #E5E3DF; margin-top: 24px; padding-top: 20px;">
    <p style="color: #999999; font-size: 12px; text-align: center; margin: 0 0 8px;">
      Sell Your Shelf — Buy and sell secondhand books
    </p>
    <p style="color: #999999; font-size: 12px; text-align: center; margin: 0;">
      Questions? <a href="mailto:support@sellyourshelf.com" style="color: ${FOREST_DEEP};">support@sellyourshelf.com</a>
    </p>
  </div>
`

const wrapper = (header: string, body: string) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: ${FOREST_DEEP}; padding: 24px; border-radius: 12px 12px 0 0;">
      <h1 style="color: ${CREAM}; margin: 0; font-size: 24px;">${header}</h1>
    </div>
    <div style="background: ${CREAM}; padding: 24px; border: 1px solid #E5E3DF; border-top: none; border-radius: 0 0 12px 12px;">
      ${body}
    </div>
    ${footerHtml}
  </div>
`

const cardBox = (inner: string, marginBottom = 20) => `
  <div style="background: #FFFFFF; border: 1px solid #E5E3DF; border-radius: 8px; padding: 16px; margin-bottom: ${marginBottom}px;">
    ${inner}
  </div>
`

function moneyRow(
  label: string,
  value: string,
  opts: { bold?: boolean; valueColor?: string; topRule?: boolean } = {},
): string {
  const padTop = opts.topRule ? '8px' : '4px'
  const border = opts.topRule ? 'border-top: 1px solid #E5E3DF;' : ''
  const labelColor = opts.bold ? '#1A1A1A' : '#666666'
  const valueColor = opts.valueColor ?? (opts.bold ? FOREST_DEEP : '#1A1A1A')
  const weight = opts.bold ? '600' : '400'
  return `
    <tr style="${border}">
      <td style="color: ${labelColor}; font-size: ${opts.bold ? '16px' : '14px'}; font-weight: ${weight}; padding: ${padTop} 0 4px 0;">${label}</td>
      <td style="color: ${valueColor}; font-size: ${opts.bold ? '16px' : '14px'}; font-weight: ${weight}; padding: ${padTop} 0 4px 0; text-align: right;">${value}</td>
    </tr>
  `
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatGbp(n: number | undefined | null): string {
  return `£${Number(n ?? 0).toFixed(2)}`
}

function formatAddress(addr: string | Record<string, string> | undefined): string {
  if (!addr) return 'Your address'
  if (typeof addr === 'string') return escapeHtml(addr)
  const parts = [addr.name, addr.line1, addr.line2, addr.city, addr.postcode].filter(Boolean)
  return parts.map(escapeHtml).join('<br />')
}

// ---------- multi-item templates ----------

function multiOrderConfirmation(data: EmailRequest['data']): { subject: string; html: string } {
  const items = data.items ?? []
  const sellerSuffix = data.sellerUsername ? ` from @${data.sellerUsername}` : ''
  const countLabel = items.length === 1 ? 'book' : 'books'
  const subject = `Order confirmed: ${items.length} ${countLabel}${sellerSuffix}`

  const itemRows = items
    .map(
      (it) => `
        <tr>
          <td style="color: #1A1A1A; font-size: 14px; padding: 6px 0; vertical-align: top;">
            ${escapeHtml(it.title)}
            ${it.author ? `<div style="color: #666; font-size: 12px;">${escapeHtml(it.author)}</div>` : ''}
          </td>
          <td style="color: #1A1A1A; font-size: 14px; padding: 6px 0; text-align: right; vertical-align: top; white-space: nowrap;">${formatGbp(it.priceGbp)}</td>
        </tr>
      `,
    )
    .join('')

  const shippingValue =
    Number(data.shippingGbp ?? 0) === 0
      ? `<span style="color: ${FOREST_DEEP}; font-weight: 600;">Free</span>`
      : formatGbp(data.shippingGbp)

  const walletRow =
    Number(data.walletAppliedGbp ?? 0) > 0
      ? moneyRow('Wallet applied', `−${formatGbp(data.walletAppliedGbp)}`)
      : ''

  const deliveryDays = data.estimatedDeliveryDays ?? '2-3 working days'

  const itemsCard = cardBox(`
    <table style="width: 100%; border-collapse: collapse;">${itemRows}</table>
    <table style="width: 100%; border-top: 1px solid #E5E3DF; margin-top: 12px; padding-top: 12px; border-collapse: collapse;">
      ${moneyRow('Subtotal', formatGbp(data.subtotalGbp))}
      ${moneyRow('Shipping', shippingValue)}
      ${walletRow}
      ${moneyRow('Total paid', formatGbp(data.cardChargedGbp ?? data.totalGbp), { bold: true, topRule: true })}
    </table>
  `)

  const addressCard = cardBox(
    `<h4 style="margin: 0 0 8px; color: #1A1A1A; font-size: 14px;">Delivering to:</h4>
     <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.5;">${formatAddress(data.shippingAddress)}</p>`,
  )

  const body = `
    <p style="color: #1A1A1A; font-size: 16px; margin: 0 0 20px;">Hi ${escapeHtml(data.buyerName) || 'there'},</p>
    <p style="color: #1A1A1A; font-size: 16px; margin: 0 0 20px;">Great news — your order${sellerSuffix} has been confirmed.</p>
    ${itemsCard}
    ${addressCard}
    <p style="color: #666666; font-size: 14px; margin: 0;">
      We'll notify you when your order is on its way. Expect delivery within ${escapeHtml(deliveryDays)} after dispatch.
    </p>
  `

  return { subject, html: wrapper('Order Confirmed ✓', body) }
}

function multiNewSale(data: EmailRequest['data']): { subject: string; html: string } {
  const items = data.items ?? []
  const buyer = data.buyerName ? `@${data.buyerName}` : 'a buyer'
  const countLabel = items.length === 1 ? 'book' : 'books'
  const subject = `You've sold ${items.length} ${countLabel} to ${buyer}`

  const itemRows = items
    .map(
      (it) => `
        <tr>
          <td style="color: #1A1A1A; font-size: 14px; padding: 6px 0 0 0; vertical-align: top;">${escapeHtml(it.title)}</td>
          <td style="color: #1A1A1A; font-size: 14px; padding: 6px 0 0 0; text-align: right; vertical-align: top; white-space: nowrap;">${formatGbp(it.priceGbp)}</td>
        </tr>
        <tr>
          <td colspan="2" style="color: #999; font-size: 12px; padding: 0 0 8px 0;">
            Fee: ${formatGbp(it.platformFeeGbp)} · You receive: <span style="color: ${FOREST_DEEP}; font-weight: 600;">${formatGbp(it.payoutGbp)}</span>
          </td>
        </tr>
      `,
    )
    .join('')

  const parcelHint = data.parcelTier
    ? `<p style="margin: 0; color: #666666; font-size: 13px; line-height: 1.5;">
         Estimated parcel size: <strong style="color: #1A1A1A;">${escapeHtml(data.parcelTier)}</strong>.
         Pack all ${items.length} ${countLabel} together — you'll generate one combined label.
       </p>`
    : ''

  const summaryCard = cardBox(`
    <table style="width: 100%; border-collapse: collapse;">${itemRows}</table>
    <table style="width: 100%; border-top: 1px solid #E5E3DF; margin-top: 12px; padding-top: 12px; border-collapse: collapse;">
      ${moneyRow('Subtotal sold', formatGbp(data.subtotalGbp))}
      ${moneyRow('Platform fees', `−${formatGbp(data.totalPlatformFeeGbp)}`, { valueColor: '#DC2626' })}
      ${moneyRow('You receive', formatGbp(data.totalPayoutGbp), { bold: true, topRule: true })}
    </table>
  `)

  const parcelCard = parcelHint ? cardBox(parcelHint) : ''

  const nextStepsCard = cardBox(`
    <h4 style="margin: 0 0 12px; color: #1A1A1A; font-size: 14px; font-weight: 600;">Next steps:</h4>
    <ol style="margin: 0; padding-left: 20px; color: #666666; font-size: 14px;">
      <li style="margin-bottom: 8px;">Open the Sell Your Shelf app</li>
      <li style="margin-bottom: 8px;">Go to Orders → tap this order</li>
      <li style="margin-bottom: 8px;">Generate the combined shipping label</li>
      <li style="margin-bottom: 0;">Drop the parcel at any Yodel point — no printer needed!</li>
    </ol>
  `)

  const body = `
    <p style="color: #1A1A1A; font-size: 16px; margin: 0 0 20px;">Hi ${escapeHtml(data.sellerName) || 'there'},</p>
    <p style="color: #1A1A1A; font-size: 16px; margin: 0 0 20px;">${buyer} just bought ${items.length} ${countLabel} from your shelf!</p>
    ${summaryCard}
    ${parcelCard}
    ${nextStepsCard}
  `

  return { subject, html: wrapper("You've Made a Sale! 🎉", body) }
}

function multiOrderShipped(data: EmailRequest['data']): { subject: string; html: string } {
  const items = data.items ?? []
  const countLabel = items.length === 1 ? 'book' : 'books'
  const subject = `Your order has shipped (${items.length} ${countLabel})`
  const deliveryDays = data.estimatedDeliveryDays ?? '2-3 working days'

  const itemRows = items
    .map(
      (it) => `
        <tr>
          <td style="color: #1A1A1A; font-size: 14px; padding: 6px 0; vertical-align: top;">
            ${escapeHtml(it.title)}
            ${it.author ? `<div style="color: #666; font-size: 12px;">${escapeHtml(it.author)}</div>` : ''}
          </td>
        </tr>
      `,
    )
    .join('')

  const itemsCard = cardBox(`<table style="width: 100%; border-collapse: collapse;">${itemRows}</table>`)

  const trackingCard = data.trackingNumber
    ? cardBox(`
        <h4 style="margin: 0 0 8px; color: #1A1A1A; font-size: 14px;">Tracking number:</h4>
        <p style="margin: 0 0 12px; color: #1A1A1A; font-size: 16px; font-weight: 600;">${escapeHtml(data.trackingNumber)}</p>
        ${
          data.trackingUrl
            ? `<a href="${escapeHtml(data.trackingUrl)}" style="display: inline-block; background: ${FOREST_DEEP}; color: ${CREAM}; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Track parcel</a>`
            : ''
        }
      `)
    : ''

  const body = `
    <p style="color: #1A1A1A; font-size: 16px; margin: 0 0 20px;">Hi ${escapeHtml(data.buyerName) || 'there'},</p>
    <p style="color: #1A1A1A; font-size: 16px; margin: 0 0 20px;">
      Your ${items.length === 1 ? 'book is' : `${items.length} ${countLabel} are`} on the way to you.
    </p>
    ${itemsCard}
    ${trackingCard}
    <p style="color: #666666; font-size: 14px; margin: 0;">Expect delivery within ${escapeHtml(deliveryDays)} via Yodel.</p>
  `

  return { subject, html: wrapper('Your Order Has Shipped 📦', body) }
}

// ---------- legacy single-item templates (unchanged behaviour) ----------

function legacyOrderConfirmation(data: EmailRequest['data']): { subject: string; html: string } {
  const bookPrice = data.bookPrice ?? (data.price ? data.price - 2.5 : 0)
  const shippingCharge = data.shippingCharge ?? 2.5
  const totalPaid = data.totalPaid ?? data.price ?? bookPrice + shippingCharge

  const subject = `Order confirmed: ${data.bookTitle}`
  const html = wrapper(
    'Order Confirmed ✓',
    `
      <p style="color: #1A1A1A; font-size: 16px; margin: 0 0 20px;">Hi ${escapeHtml(data.buyerName) || 'there'},</p>
      <p style="color: #1A1A1A; font-size: 16px; margin: 0 0 20px;">Great news! Your order has been confirmed.</p>
      ${cardBox(`
        <h3 style="margin: 0 0 8px; color: #1A1A1A; font-size: 18px;">${escapeHtml(data.bookTitle)}</h3>
        <p style="margin: 0 0 16px; color: #666666; font-size: 14px;">by ${escapeHtml(data.bookAuthor) || 'Unknown'}</p>
        <table style="width: 100%; border-top: 1px solid #E5E3DF; margin-top: 12px; padding-top: 12px; border-collapse: collapse;">
          ${moneyRow('Book', formatGbp(bookPrice))}
          ${moneyRow('Shipping', formatGbp(shippingCharge))}
          ${moneyRow('Total paid', formatGbp(totalPaid), { bold: true, topRule: true })}
        </table>
      `)}
      ${cardBox(`
        <h4 style="margin: 0 0 8px; color: #1A1A1A; font-size: 14px;">Delivering to:</h4>
        <p style="margin: 0; color: #666666; font-size: 14px;">${formatAddress(data.shippingAddress)}</p>
      `)}
      <p style="color: #666666; font-size: 14px; margin: 0;">
        We'll notify you when your book is on its way. Expect delivery within 2-3 working days once shipped.
      </p>
    `,
  )
  return { subject, html }
}

function legacyNewSale(data: EmailRequest['data']): { subject: string; html: string } {
  const bookPrice = data.bookPrice ?? (data.price ? data.price - 2.5 : 0)
  const platformFee = data.platformFee ?? (bookPrice < 5 ? 1.0 : bookPrice * 0.2)
  const sellerReceives = data.sellerReceives ?? bookPrice - platformFee

  const subject = `You've sold: ${data.bookTitle}`
  const html = wrapper(
    "You've Made a Sale! 🎉",
    `
      <p style="color: #1A1A1A; font-size: 16px; margin: 0 0 20px;">Hi ${escapeHtml(data.sellerName) || 'there'},</p>
      <p style="color: #1A1A1A; font-size: 16px; margin: 0 0 20px;">Someone just bought your book!</p>
      ${cardBox(`
        <h3 style="margin: 0 0 8px; color: #1A1A1A; font-size: 18px;">${escapeHtml(data.bookTitle)}</h3>
        <p style="margin: 0 0 16px; color: #666666; font-size: 14px;">by ${escapeHtml(data.bookAuthor) || 'Unknown'}</p>
        <table style="width: 100%; border-top: 1px solid #E5E3DF; margin-top: 12px; padding-top: 12px; border-collapse: collapse;">
          ${moneyRow('Book price', formatGbp(bookPrice))}
          ${moneyRow('Platform fee', `−${formatGbp(platformFee)}`, { valueColor: '#DC2626' })}
          ${moneyRow('You receive', formatGbp(sellerReceives), { bold: true, topRule: true })}
        </table>
      `)}
      ${cardBox(`
        <h4 style="margin: 0 0 12px; color: #1A1A1A; font-size: 14px; font-weight: 600;">Next steps:</h4>
        <ol style="margin: 0; padding-left: 20px; color: #666666; font-size: 14px;">
          <li style="margin-bottom: 8px;">Open the Sell Your Shelf app</li>
          <li style="margin-bottom: 8px;">Go to Orders → tap this sale</li>
          <li style="margin-bottom: 8px;">Generate your shipping label</li>
          <li style="margin-bottom: 0;">Drop off at any Yodel point — no printer needed!</li>
        </ol>
      `)}
    `,
  )
  return { subject, html }
}

function legacyOrderShipped(data: EmailRequest['data']): { subject: string; html: string } {
  const subject = `Your book is on its way: ${data.bookTitle}`
  const html = wrapper(
    'Your Book Has Shipped 📦',
    `
      <p style="color: #1A1A1A; font-size: 16px; margin: 0 0 20px;">Hi ${escapeHtml(data.buyerName) || 'there'},</p>
      <p style="color: #1A1A1A; font-size: 16px; margin: 0 0 20px;">Great news! Your book is on its way to you.</p>
      ${cardBox(`
        <h3 style="margin: 0 0 8px; color: #1A1A1A; font-size: 18px;">${escapeHtml(data.bookTitle)}</h3>
        <p style="margin: 0; color: #666666; font-size: 14px;">by ${escapeHtml(data.bookAuthor) || 'Unknown'}</p>
      `)}
      ${
        data.trackingNumber
          ? cardBox(`
            <h4 style="margin: 0 0 8px; color: #1A1A1A; font-size: 14px;">Tracking Number:</h4>
            <p style="margin: 0 0 12px; color: #1A1A1A; font-size: 16px; font-weight: 600;">${escapeHtml(data.trackingNumber)}</p>
            ${
              data.trackingUrl
                ? `<a href="${escapeHtml(data.trackingUrl)}" style="display: inline-block; background: ${FOREST_DEEP}; color: ${CREAM}; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Track Parcel</a>`
                : ''
            }
          `)
          : ''
      }
      <p style="color: #666666; font-size: 14px; margin: 0;">Expect delivery within 2-3 working days via Yodel.</p>
    `,
  )
  return { subject, html }
}

function onboardingReminder(data: EmailRequest['data']): { subject: string; html: string } {
  const subject = `Complete your seller setup — just one step left`
  const html = wrapper(
    "You're Almost There! 🎯",
    `
      <p style="color: #1A1A1A; font-size: 16px; margin: 0 0 20px;">Hi ${escapeHtml(data.name) || 'there'},</p>
      <p style="color: #1A1A1A; font-size: 16px; margin: 0 0 20px;">
        You started setting up your seller account but didn't quite finish. Just one more step and you'll be ready to start earning from your bookshelf.
      </p>
      <div style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <h4 style="margin: 0 0 8px; color: #92400E; font-size: 14px; font-weight: 600;">What's needed:</h4>
        <p style="margin: 0; color: #92400E; font-size: 16px;">${escapeHtml(data.requirement) || 'Complete verification'}</p>
      </div>
      <p style="color: #666666; font-size: 14px; margin: 0 0 20px;">
        It only takes a minute. Open the app and tap "Continue Setup" — you'll pick up right where you left off.
      </p>
      <a href="https://sellyourshelf.com" style="display: inline-block; background: ${FOREST_DEEP}; color: ${CREAM}; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        Complete Setup
      </a>
      <p style="color: #666666; font-size: 14px; margin: 20px 0 0;">
        Once verified, you can scan your bookshelf and list books in under 90 seconds. Most sellers earn £4-6 per book — that's 15x more than trade-in services.
      </p>
    `,
  )
  return { subject, html }
}

// ---------- router ----------

function isMultiItem(data: EmailRequest['data']): boolean {
  return Array.isArray(data.items) && data.items.length > 0
}

function buildEmail(req: EmailRequest): { subject: string; html: string } {
  switch (req.type) {
    case 'order_confirmation':
      return isMultiItem(req.data) ? multiOrderConfirmation(req.data) : legacyOrderConfirmation(req.data)
    case 'new_sale':
      return isMultiItem(req.data) ? multiNewSale(req.data) : legacyNewSale(req.data)
    case 'order_shipped':
      return isMultiItem(req.data) ? multiOrderShipped(req.data) : legacyOrderShipped(req.data)
    case 'onboarding_reminder':
      return onboardingReminder(req.data)
    default:
      throw new Error('Unknown email type')
  }
}

// ---------- handler ----------

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = (await req.json()) as EmailRequest
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured on this project')
    }

    const { subject, html } = buildEmail(payload)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Sell Your Shelf <noreply@sellyourshelf.com>',
        to: payload.to,
        subject,
        html,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      throw new Error(result.message || 'Failed to send email')
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Email error:', error)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

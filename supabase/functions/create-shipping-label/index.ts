// create-shipping-label
//
// Creates a Yodel Print-at-Store label via ShipEngine. Accepts ONE of:
//   { transaction_id }  — legacy single-item iOS flow
//   { order_id }        — new multi-item flow (Phase 1B). Scales the
//                         parcel weight from summed order_items.
//
// Returns the QR code URL + tracking number for the seller to show at
// any Yodel drop-off point. Stores label state on the transaction or
// order row so it can be retrieved later.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SHIPENGINE_API_KEY = Deno.env.get('SHIPENGINE_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Yodel Print at Store — printerless drop-off at 4,000+ UK locations.
const CARRIER_ID = 'se-355478'
const SERVICE_CODE = 'yodel_direct_print_at_store'

// Per-book heuristic weights (grams) — match the client basket model so
// the combined parcel weight reflects what the buyer saw at checkout.
const WEIGHT_PAPERBACK_G = 280
const WEIGHT_HARDBACK_G = 800
const WEIGHT_UNKNOWN_G = 350
const PACKAGING_G = 150

const PACKAGE_DIMENSIONS = { length: 22, width: 16, height: 4, unit: 'centimeter' as const }
const SINGLE_BOOK_WEIGHT_KG = 0.5

function weightForFormat(format: string | null | undefined): number {
  if (format === 'paperback') return WEIGHT_PAPERBACK_G
  if (format === 'hardback') return WEIGHT_HARDBACK_G
  return WEIGHT_UNKNOWN_G
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const transactionId = body?.transaction_id as number | string | undefined
    const orderId = body?.order_id as string | undefined

    if (!transactionId && !orderId) {
      return json(400, { error: 'transaction_id or order_id is required' })
    }
    if (transactionId && orderId) {
      return json(400, { error: 'Provide exactly one of transaction_id or order_id' })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    if (orderId) return await createLabelForOrder(supabase, orderId)
    return await createLabelForTransaction(supabase, transactionId!)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('create-shipping-label error:', err)
    return json(500, { error: message })
  }
})

// ---------------------------------------------------------------------
// Multi-item order path
// ---------------------------------------------------------------------

async function createLabelForOrder(supabase: SupabaseClient, orderId: string): Promise<Response> {
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select(`
      id, status, seller_id, buyer_email,
      tracking_number, shipping_label_url, shipping_handoff_code, tracking_url,
      shipping_address, parcel_tier, estimated_weight_grams,
      seller:seller_id(first_name, last_name, email),
      items:order_items(format, weight_grams)
    `)
    .eq('id', orderId)
    .single()

  if (fetchErr || !order) return json(404, { error: 'Order not found' })

  if (order.status !== 'paid') {
    return json(400, { error: `Cannot create label for status: ${order.status}. Must be 'paid'.` })
  }

  // Idempotent: if a label was already generated for this order, return it.
  if (order.tracking_number) {
    return json(200, {
      success: true,
      already_generated: true,
      tracking_number: order.tracking_number,
      tracking_url: order.tracking_url,
      qr_code_url: order.shipping_label_url,
      handoff_code: order.shipping_handoff_code,
    })
  }

  // Seller's return address from user_addresses.
  const { data: sellerAddress } = await supabase
    .from('user_addresses')
    .select('*')
    .eq('user_id', order.seller_id)
    .eq('is_default', true)
    .single()

  if (!sellerAddress) {
    return json(400, { error: 'Seller has no default return address.' })
  }

  // Combined weight from order_items (kg). Fall back to a sensible default.
  const items = (order as { items?: Array<{ format: string | null; weight_grams: number | null }> }).items ?? []
  let weightG =
    items.reduce(
      (s, it) => s + (it.weight_grams ?? weightForFormat(it.format)),
      0,
    ) + PACKAGING_G
  if (weightG <= 0) weightG = Math.round(SINGLE_BOOK_WEIGHT_KG * 1000)
  const weightKg = Math.max(0.1, weightG / 1000)

  const seller = (order as { seller?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null }).seller ?? null
  const shipAddr = (order.shipping_address ?? {}) as Record<string, string>

  const shipmentPayload = {
    shipment: {
      carrier_id: CARRIER_ID,
      service_code: SERVICE_CODE,
      ship_from: {
        name:
          [seller?.first_name, seller?.last_name].filter(Boolean).join(' ') ||
          (sellerAddress.name as string | null) ||
          'Seller',
        address_line1: sellerAddress.address_line1,
        address_line2: sellerAddress.address_line2 || undefined,
        city_locality: sellerAddress.city,
        postal_code: sellerAddress.postcode,
        country_code: 'GB',
        phone: sellerAddress.phone || '07000000000',
        email: seller?.email || 'noreply@sellyourshelf.com',
      },
      ship_to: {
        name: shipAddr.name ?? 'Buyer',
        address_line1: shipAddr.line1,
        address_line2: shipAddr.line2 || undefined,
        city_locality: shipAddr.city,
        postal_code: shipAddr.postcode,
        country_code: shipAddr.country || 'GB',
        phone: '07000000001',
        email: order.buyer_email || 'noreply@sellyourshelf.com',
      },
      packages: [
        {
          weight: { value: weightKg, unit: 'kilogram' },
          dimensions: PACKAGE_DIMENSIONS,
        },
      ],
    },
    display_scheme: 'paperless',
  }

  const response = await fetch('https://api.shipengine.com/v1/labels', {
    method: 'POST',
    headers: { 'API-Key': SHIPENGINE_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(shipmentPayload),
  })

  const labelData = await response.json()

  if (!response.ok || labelData.errors?.length > 0) {
    console.error('ShipEngine error:', JSON.stringify(labelData, null, 2))
    return json(500, { error: 'Failed to create shipping label', details: labelData.errors || labelData })
  }

  const { error: updateErr } = await supabase
    .from('orders')
    .update({
      tracking_number: labelData.tracking_number,
      shipping_label_url: labelData.paperless_download?.href,
      shipping_handoff_code: labelData.paperless_download?.handoff_code,
      tracking_url: labelData.tracking_url,
      shipping_method: 'yodel_print_at_store',
    })
    .eq('id', orderId)

  if (updateErr) {
    console.error('Order label update failed:', updateErr)
    return json(500, {
      error: 'Label created but failed to save. Contact support with this data.',
      label_id: labelData.label_id,
      tracking_number: labelData.tracking_number,
      qr_code_url: labelData.paperless_download?.href,
      handoff_code: labelData.paperless_download?.handoff_code,
    })
  }

  return json(200, {
    success: true,
    tracking_number: labelData.tracking_number,
    tracking_url: labelData.tracking_url,
    qr_code_url: labelData.paperless_download?.href,
    handoff_code: labelData.paperless_download?.handoff_code,
    instructions:
      labelData.paperless_download?.instructions ||
      `Show the QR code at any Yodel drop-off point. Or give them the code: ${labelData.paperless_download?.handoff_code}`,
    parcel_weight_kg: weightKg,
    parcel_tier: order.parcel_tier,
  })
}

// ---------------------------------------------------------------------
// Legacy single-item transaction path (unchanged from existing prod fn)
// ---------------------------------------------------------------------

async function createLabelForTransaction(
  supabase: SupabaseClient,
  transactionId: number | string,
): Promise<Response> {
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .select(`
      *,
      seller:seller_id (id, first_name, last_name, email),
      listing:listing_id (title)
    `)
    .eq('id', transactionId)
    .single()

  if (txError || !transaction) return json(404, { error: 'Transaction not found' })
  if (transaction.status !== 'paid') {
    return json(400, { error: `Cannot create label for status: ${transaction.status}. Must be 'paid'.` })
  }

  if (transaction.tracking_number) {
    return json(400, {
      error: 'Shipping label already exists',
      tracking_number: transaction.tracking_number,
      qr_code_url: transaction.shipping_label_url,
      handoff_code: transaction.shipping_handoff_code,
      tracking_url: transaction.shipping_tracking_url,
    })
  }

  const { data: sellerAddress, error: addrError } = await supabase
    .from('user_addresses')
    .select('*')
    .eq('user_id', transaction.seller_id)
    .eq('is_default', true)
    .single()

  if (addrError || !sellerAddress) {
    return json(400, { error: 'Seller address not found. Please add a return address in settings.' })
  }

  const shipmentPayload = {
    shipment: {
      carrier_id: CARRIER_ID,
      service_code: SERVICE_CODE,
      ship_from: {
        name:
          [transaction.seller?.first_name, transaction.seller?.last_name].filter(Boolean).join(' ') ||
          'Seller',
        address_line1: sellerAddress.address_line1,
        address_line2: sellerAddress.address_line2 || undefined,
        city_locality: sellerAddress.city,
        postal_code: sellerAddress.postcode,
        country_code: 'GB',
        phone: sellerAddress.phone || '07000000000',
        email: transaction.seller?.email || 'noreply@sellyourshelf.com',
      },
      ship_to: {
        name: transaction.shipping_name_full,
        address_line1: transaction.shipping_address_line1,
        address_line2: transaction.shipping_address_line2 || undefined,
        city_locality: transaction.shipping_city,
        postal_code: transaction.shipping_postcode,
        country_code: transaction.shipping_country || 'GB',
        phone: '07000000001',
        email: 'noreply@sellyourshelf.com',
      },
      packages: [
        {
          weight: { value: SINGLE_BOOK_WEIGHT_KG, unit: 'kilogram' },
          dimensions: { length: 20, width: 15, height: 3, unit: 'centimeter' },
        },
      ],
    },
    display_scheme: 'paperless',
  }

  const response = await fetch('https://api.shipengine.com/v1/labels', {
    method: 'POST',
    headers: { 'API-Key': SHIPENGINE_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(shipmentPayload),
  })

  const labelData = await response.json()
  if (!response.ok || labelData.errors?.length > 0) {
    console.error('ShipEngine error:', JSON.stringify(labelData, null, 2))
    return json(500, { error: 'Failed to create shipping label', details: labelData.errors || labelData })
  }

  const { error: updateError } = await supabase
    .from('transactions')
    .update({
      tracking_number: labelData.tracking_number,
      shipping_label_url: labelData.paperless_download?.href,
      shipping_handoff_code: labelData.paperless_download?.handoff_code,
      shipping_tracking_url: labelData.tracking_url,
      shipping_method: 'yodel_print_at_store',
      shipping_cost_gbp: labelData.shipment_cost?.amount || 2.69,
    })
    .eq('id', transactionId)

  if (updateError) {
    console.error('DB update failed:', updateError)
    return json(500, {
      error: 'Label created but failed to save. Contact support with this data.',
      label_id: labelData.label_id,
      tracking_number: labelData.tracking_number,
      qr_code_url: labelData.paperless_download?.href,
      handoff_code: labelData.paperless_download?.handoff_code,
    })
  }

  return json(200, {
    success: true,
    tracking_number: labelData.tracking_number,
    tracking_url: labelData.tracking_url,
    qr_code_url: labelData.paperless_download?.href,
    handoff_code: labelData.paperless_download?.handoff_code,
    instructions:
      labelData.paperless_download?.instructions ||
      `Show the QR code at any Yodel drop-off point. Or give them the code: ${labelData.paperless_download?.handoff_code}`,
    shipping_cost: labelData.shipment_cost?.amount,
  })
}

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const BUCKET = "covers"
const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const VALID_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key",
      },
    })
  }

  // Auth check
  const apiKey = req.headers.get("x-api-key")
  const expectedKey = Deno.env.get("COVER_UPLOAD_API_KEY")
  if (!apiKey || apiKey !== expectedKey) {
    return new Response(JSON.stringify({ success: false, error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const { sourceUrl, storageKey } = await req.json()

    if (!sourceUrl || !storageKey) {
      return new Response(
        JSON.stringify({ success: false, error: "missing_params" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Skip if already a Supabase URL
    if (sourceUrl.includes("supabase")) {
      return new Response(
        JSON.stringify({ success: true, hostedUrl: sourceUrl, skipped: true }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    // Download the image with timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    let downloadRes: Response
    try {
      downloadRes = await fetch(sourceUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "SellYourShelf/1.0",
        },
      })
    } catch (_e) {
      return new Response(
        JSON.stringify({ success: false, error: "download_failed" }),
        { headers: { "Content-Type": "application/json" } }
      )
    } finally {
      clearTimeout(timeout)
    }

    if (!downloadRes.ok) {
      return new Response(
        JSON.stringify({ success: false, error: "download_failed" }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    // Validate content type
    const contentType = downloadRes.headers.get("content-type") || ""
    const isValidType = VALID_TYPES.some((t) => contentType.includes(t))
    if (!isValidType) {
      return new Response(
        JSON.stringify({ success: false, error: "invalid_image" }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    // Read body and validate size
    const imageData = await downloadRes.arrayBuffer()
    if (imageData.byteLength > MAX_SIZE) {
      return new Response(
        JSON.stringify({ success: false, error: "invalid_image" }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    // Determine file extension from content type
    let ext = "jpg"
    if (contentType.includes("png")) ext = "png"
    else if (contentType.includes("webp")) ext = "webp"
    else if (contentType.includes("gif")) ext = "gif"

    const filename = `${storageKey}.${ext}`

    // Upload to Supabase Storage
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filename, imageData, {
        contentType: contentType.split(";")[0],
        upsert: true,
      })

    if (uploadError) {
      return new Response(
        JSON.stringify({ success: false, error: "upload_failed", details: uploadError.message }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    // Build public URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const hostedUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${filename}`

    return new Response(
      JSON.stringify({ success: true, hostedUrl }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: "unexpected", details: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})

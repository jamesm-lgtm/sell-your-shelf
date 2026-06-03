import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

// Mode switching — mirrors create-order-payment-intent. Without this hook
// the iOS dev build (which bundles pk_test_) can't confirm any PI minted
// here, since prod's STRIPE_SECRET_KEY is the live key. With it: dev
// builds send `x-stripe-mode: test` and we use STRIPE_TEST_SECRET_KEY.
type StripeMode = "live" | "test";
const _stripeByMode: Partial<Record<StripeMode, Stripe>> = {};
function getStripe(mode: StripeMode): Stripe {
  const cached = _stripeByMode[mode];
  if (cached) return cached;
  const envKey = mode === "test" ? "STRIPE_TEST_SECRET_KEY" : "STRIPE_SECRET_KEY";
  const key = Deno.env.get(envKey);
  if (!key) throw new Error(`${envKey} is not configured on this project`);
  const client = new Stripe(key, { apiVersion: "2023-10-16" });
  _stripeByMode[mode] = client;
  return client;
}

function modeFromRequest(req: Request): StripeMode {
  return req.headers.get("x-stripe-mode") === "test" ? "test" : "live";
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Fee structure: £1 flat if under £5, 20% if £5+
const PLATFORM_FEE_PERCENT = 20;
const PLATFORM_FEE_FLAT_PENCE = 100; // £1
const PLATFORM_FEE_THRESHOLD_PENCE = 500; // £5
const SHIPPING_CHARGE_GBP = 2.50; // What buyer pays

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeMode = modeFromRequest(req);
  const stripe = getStripe(stripeMode);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { listingId, shippingAddress, useBalancePence = 0, platform = 'ios' } = body; // PLATFORM TRACKING

    if (!listingId) {
      return new Response(
        JSON.stringify({ error: "listingId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get listing details
    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("id, title, asking_price_gbp, user_id, status")
      .eq("id", listingId)
      .single();

    if (listingError || !listing) {
      return new Response(
        JSON.stringify({ error: "Listing not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (listing.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Listing is not available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (listing.user_id === user.id) {
      return new Response(
        JSON.stringify({ error: "Cannot buy your own listing" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get seller's Stripe account
    const { data: sellerWallet, error: sellerWalletError } = await supabase
      .from("user_wallets")
      .select("stripe_account_id")
      .eq("user_id", listing.user_id)
      .single();

    if (sellerWalletError || !sellerWallet?.stripe_account_id) {
      return new Response(
        JSON.stringify({ error: "Seller has not set up payments" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate amounts (in pence)
    const bookPricePence = Math.round(listing.asking_price_gbp * 100);
    const shippingPence = Math.round(SHIPPING_CHARGE_GBP * 100);
    const totalPence = bookPricePence + shippingPence;

    // Fee: £1 flat if book under £5, 20% of book price if £5+
    const platformFeePence = bookPricePence < PLATFORM_FEE_THRESHOLD_PENCE
      ? PLATFORM_FEE_FLAT_PENCE
      : Math.round(bookPricePence * (PLATFORM_FEE_PERCENT / 100));

    // Seller receives book price minus platform fee (shipping goes to platform)
    const sellerReceivesPence = bookPricePence - platformFeePence;

    // If using balance, validate buyer has a Connect account with sufficient funds
    let actualBalanceToUse = 0;
    let buyerStripeAccountId: string | null = null;

    if (useBalancePence > 0) {
      const { data: buyerWallet, error: buyerWalletError } = await supabase
        .from("user_wallets")
        .select("stripe_account_id")
        .eq("user_id", user.id)
        .single();

      if (buyerWalletError || !buyerWallet?.stripe_account_id) {
        return new Response(
          JSON.stringify({ error: "You need to set up payments to use balance" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      buyerStripeAccountId = buyerWallet.stripe_account_id;

      // Check actual balance
      const balance = await stripe.balance.retrieve({
        stripeAccount: buyerStripeAccountId,
      });

      const gbpBalance = balance.available.find(b => b.currency === "gbp");
      const availableBalancePence = gbpBalance?.amount ?? 0;

      // Use minimum of requested and available
      actualBalanceToUse = Math.min(useBalancePence, availableBalancePence, totalPence);

      console.log("Balance check:", {
        requested: useBalancePence,
        available: availableBalancePence,
        willUse: actualBalanceToUse,
      });
    }

    const cardAmountPence = totalPence - actualBalanceToUse;

    console.log("Payment calculation:", {
      bookPrice: listing.asking_price_gbp,
      shipping: SHIPPING_CHARGE_GBP,
      total: totalPence / 100,
      platformFee: platformFeePence / 100,
      sellerReceives: sellerReceivesPence / 100,
      fromBalance: actualBalanceToUse / 100,
      fromCard: cardAmountPence / 100,
      platform, // PLATFORM TRACKING
    });

    // SCENARIO 1: Full balance payment (no card needed)
    if (cardAmountPence === 0 && actualBalanceToUse > 0) {
      // Debit buyer's Connect account balance (account debit — funds go to platform)
      const buyerTransfer = await stripe.charges.create({
        amount: actualBalanceToUse,
        currency: "gbp",
        source: buyerStripeAccountId!,
        description: `Balance used for purchase of "${listing.title}"`,
      });

      // Transfer seller's portion from platform to seller
      const sellerTransfer = await stripe.transfers.create({
        amount: sellerReceivesPence,
        currency: "gbp",
        destination: sellerWallet.stripe_account_id,
      });

      // Create transaction record
      const { error: txError } = await supabase.from("transactions").insert({
        listing_id: listing.id,
        buyer_id: user.id,
        seller_id: listing.user_id,
        sale_price_gbp: totalPence / 100,
        shipping_cost_gbp: SHIPPING_CHARGE_GBP,
        platform_fee_gbp: platformFeePence / 100,
        seller_payout_gbp: sellerReceivesPence / 100,
        status: "paid",
        paid_at: new Date().toISOString(),
        payment_method: "balance",
        buyer_transfer_id: buyerTransfer.id,
        seller_transfer_id: sellerTransfer.id,
        shipping_name_full: shippingAddress?.name || "",
        shipping_address_line1: shippingAddress?.line1 || "",
        shipping_address_line2: shippingAddress?.line2 || "",
        shipping_city: shippingAddress?.city || "",
        shipping_postcode: shippingAddress?.postcode || "",
        platform, // PLATFORM TRACKING
      });

      if (txError) {
        console.error("Transaction insert error:", txError);
      }

      // Mark listing as sold
      await supabase
        .from("listings")
        .update({ status: "sold" })
        .eq("id", listing.id);

      return new Response(
        JSON.stringify({
          success: true,
          paymentMethod: "balance",
          breakdown: {
            bookPrice: listing.asking_price_gbp,
            shipping: SHIPPING_CHARGE_GBP,
            total: totalPence / 100,
            fromBalance: actualBalanceToUse / 100,
            fromCard: 0,
            platformFee: platformFeePence / 100,
            sellerReceives: sellerReceivesPence / 100,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SCENARIO 2: Partial balance + card payment
    if (actualBalanceToUse > 0 && cardAmountPence > 0) {
      // Debit buyer's Connect account balance upfront (account debit — funds go to platform)
      let buyerTransfer;
      try {
        buyerTransfer = await stripe.charges.create({
          amount: actualBalanceToUse,
          currency: "gbp",
          source: buyerStripeAccountId!,
          description: `Balance used for purchase of "${listing.title}"`,
        });
      } catch (transferErr: any) {
        console.error("Buyer balance transfer failed:", transferErr);
        return new Response(
          JSON.stringify({ error: `Balance transfer failed: ${transferErr.message}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Buyer balance transfer created:", buyerTransfer.id);

      // Platform keeps fee + shipping from the total
      // Always use a destination charge (at least 1p to seller) so the Connect webhook fires
      const platformKeepsPence = platformFeePence + shippingPence;
      const cardApplicationFee = Math.min(platformKeepsPence, cardAmountPence - 1);
      const sellerFromCard = cardAmountPence - cardApplicationFee; // Always >= 1
      const sellerFromBalance = Math.max(0, sellerReceivesPence - sellerFromCard);

      console.log("Partial payment split:", {
        platformKeeps: platformKeepsPence / 100,
        cardApplicationFee: cardApplicationFee / 100,
        sellerFromCard: sellerFromCard / 100,
        sellerFromBalance: sellerFromBalance / 100,
      });

      let paymentIntent;
      try {
        paymentIntent = await stripe.paymentIntents.create({
          amount: cardAmountPence,
          currency: "gbp",
          application_fee_amount: cardApplicationFee,
          transfer_data: {
            destination: sellerWallet.stripe_account_id,
          },
          metadata: {
            listing_id: listing.id.toString(),
            buyer_id: user.id,
            seller_id: listing.user_id,
            book_title: listing.title,
            book_price_pence: bookPricePence.toString(),
            shipping_charge_pence: shippingPence.toString(),
            seller_stripe_account: sellerWallet.stripe_account_id,
            buyer_stripe_account: buyerStripeAccountId!,
            balance_amount_pence: actualBalanceToUse.toString(),
            total_amount_pence: totalPence.toString(),
            platform_fee_pence: platformFeePence.toString(),
            seller_receives_pence: sellerReceivesPence.toString(),
            seller_balance_transfer_pence: sellerFromBalance.toString(),
            buyer_transfer_id: buyerTransfer.id,
            shipping_name: shippingAddress?.name || "",
            shipping_line1: shippingAddress?.line1 || "",
            shipping_line2: shippingAddress?.line2 || "",
            shipping_city: shippingAddress?.city || "",
            shipping_postcode: shippingAddress?.postcode || "",
            platform, // PLATFORM TRACKING
            mode: stripeMode,
          },
        });
      } catch (piErr: any) {
        // CRITICAL: the wallet portion was already captured at line ~236
        // above. If we don't refund here the buyer's Connect balance is
        // stranded with no order to show for it.
        console.error("PI creation failed; refunding stranded wallet charge:", piErr);
        try {
          await stripe.refunds.create({
            charge: buyerTransfer.id,
            reason: "requested_by_customer",
            metadata: {
              listing_id: listing.id.toString(),
              reason: "pi_creation_failed",
            },
          });
          console.log("🔄 Refunded stranded wallet charge:", buyerTransfer.id);
        } catch (refundErr) {
          console.error(
            "⚠️ Wallet refund FAILED after PI creation error. Manual reconciliation needed for charge",
            buyerTransfer.id,
            refundErr,
          );
        }
        return new Response(
          JSON.stringify({ error: piErr.message || "Stripe PaymentIntent creation failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          paymentMethod: "balance_and_card",
          breakdown: {
            bookPrice: listing.asking_price_gbp,
            shipping: SHIPPING_CHARGE_GBP,
            total: totalPence / 100,
            fromBalance: actualBalanceToUse / 100,
            fromCard: cardAmountPence / 100,
            platformFee: platformFeePence / 100,
            sellerReceives: sellerReceivesPence / 100,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SCENARIO 3: Card-only payment (no balance)
    // application_fee_amount includes shipping so seller only gets book price minus platform fee
    const applicationFeeAmount = platformFeePence + shippingPence;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: cardAmountPence,
      currency: "gbp",
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: sellerWallet.stripe_account_id,
      },
      metadata: {
        listing_id: listing.id.toString(),
        buyer_id: user.id,
        seller_id: listing.user_id,
        book_title: listing.title,
        book_price_pence: bookPricePence.toString(),
        shipping_charge_pence: shippingPence.toString(),
        seller_stripe_account: sellerWallet.stripe_account_id,
        buyer_stripe_account: buyerStripeAccountId || "",
        balance_amount_pence: actualBalanceToUse.toString(),
        total_amount_pence: totalPence.toString(),
        platform_fee_pence: platformFeePence.toString(),
        seller_receives_pence: sellerReceivesPence.toString(),
        shipping_name: shippingAddress?.name || "",
        shipping_line1: shippingAddress?.line1 || "",
        shipping_line2: shippingAddress?.line2 || "",
        shipping_city: shippingAddress?.city || "",
        shipping_postcode: shippingAddress?.postcode || "",
        platform, // PLATFORM TRACKING
      },
    });

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        paymentMethod: actualBalanceToUse > 0 ? "balance_and_card" : "card",
        breakdown: {
          bookPrice: listing.asking_price_gbp,
          shipping: SHIPPING_CHARGE_GBP,
          total: totalPence / 100,
          fromBalance: actualBalanceToUse / 100,
          fromCard: cardAmountPence / 100,
          platformFee: platformFeePence / 100,
          sellerReceives: sellerReceivesPence / 100,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
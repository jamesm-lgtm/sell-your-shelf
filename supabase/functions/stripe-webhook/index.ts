import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import { handleOrderPaid } from "../_shared/handle-order-paid.ts";

// Live mode (primary) + test mode (iOS/Android dev builds). Test secrets
// are optional; signature verification falls back through whatever is
// configured.
const stripeLive = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});
const stripeTestKey = Deno.env.get("STRIPE_TEST_SECRET_KEY");
const stripeTest = stripeTestKey
  ? new Stripe(stripeTestKey, { apiVersion: "2023-10-16" })
  : null;
// Default reference used for signature verification — the constructEvent
// call only needs HMAC, so either instance works.
const stripe = stripeLive;

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Support platform + Connect + test webhook secrets. Test endpoint is
// configured separately in Stripe Dashboard (Test mode → Webhooks) and
// emits its own signing secret.
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const webhookSecretConnect = Deno.env.get("STRIPE_WEBHOOK_SECRET_CONNECT");
const webhookSecretTest = Deno.env.get("STRIPE_TEST_WEBHOOK_SECRET");

// Pick the right Stripe instance for any post-verification API calls
// (transfers, refunds, etc). event.livemode is the source of truth.
function stripeFor(event: Stripe.Event): Stripe {
  if (!event.livemode && stripeTest) return stripeTest;
  return stripeLive;
}

// Constants
const SHIPPING_CHARGE_GBP = 2.50; // What buyer pays for shipping

// Compute the badge number for a user = unread messages to them +
// paid-but-not-shipped sales where they are the seller.
// Mirrors the client-side useUnreadCounts hook so push-delivered
// badge numbers stay coherent with what the app shows.
async function computeBadgeTotal(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<number> {
  try {
    const [convoRes, salesRes] = await Promise.all([
      supabase
        .from("conversations")
        .select("id")
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`),
      supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("seller_id", userId)
        .eq("status", "paid")
        .is("shipped_at", null),
    ]);

    const convoIds = (convoRes.data ?? []).map((c: { id: number }) => c.id);
    let unreadMessages = 0;
    if (convoIds.length > 0) {
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", convoIds)
        .eq("is_read", false)
        .neq("sender_id", userId);
      unreadMessages = count ?? 0;
    }

    return unreadMessages + (salesRes.count ?? 0);
  } catch (err) {
    console.error("computeBadgeTotal failed:", err);
    return 1; // fallback — at least increment to signal something happened
  }
}

serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");
  
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  try {
    const body = await req.text();
    
    // Try each configured webhook secret in turn — platform live, Connect,
    // then test. First one that verifies wins.
    let event: Stripe.Event | null = null;
    const candidates: Array<{ name: string; secret: string | null | undefined }> = [
      { name: "platform", secret: webhookSecret },
      { name: "Connect", secret: webhookSecretConnect },
      { name: "test", secret: webhookSecretTest },
    ];

    for (const { name, secret } of candidates) {
      if (!secret) continue;
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature, secret);
        console.log(`✅ Verified with ${name} webhook secret`);
        break;
      } catch {
        // Try the next secret.
      }
    }

    if (!event) {
      console.error("❌ Signature verification failed against all configured secrets");
      return new Response("Invalid signature", { status: 400 });
    }

    console.log("📩 Webhook received:", event.type, "livemode:", event.livemode);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ============================================
    // CONNECT ACCOUNT UPDATED - Sync seller status & address
    // ============================================
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      
      console.log("👤 Account updated:", account.id);
      console.log("   details_submitted:", account.details_submitted);
      console.log("   charges_enabled:", account.charges_enabled);
      console.log("   requirements.currently_due:", account.requirements?.currently_due);
      
      // Find user by stripe_account_id
      let { data: wallet } = await supabase
        .from("user_wallets")
        .select("user_id, created_at, last_onboarding_reminder_at")
        .eq("stripe_account_id", account.id)
        .maybeSingle();

      if (!wallet?.user_id) {
        // Self-heal: a Stripe account exists with metadata pointing at one of
        // our users, but no wallet row was ever written (or it was deleted out
        // of band). Reconstruct it so this and future events land cleanly.
        const supabaseUserId = (account.metadata as Record<string, string> | null)?.supabase_user_id;
        if (!supabaseUserId) {
          console.log("⚠️ No wallet and no supabase_user_id metadata for account:", account.id);
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { data: userExists } = await supabase
          .from("users")
          .select("id")
          .eq("id", supabaseUserId)
          .maybeSingle();
        if (!userExists) {
          console.log("⚠️ Stripe metadata points to unknown user:", supabaseUserId, "for account:", account.id);
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        console.log("🩹 Healing orphan wallet for user:", supabaseUserId, "account:", account.id);
        const { error: insertErr } = await supabase
          .from("user_wallets")
          .insert({
            user_id: supabaseUserId,
            stripe_account_id: account.id,
            stripe_account_status: "pending",
            available_balance_gbp: 0,
            pending_balance_gbp: 0,
            total_earned_gbp: 0,
          });
        if (insertErr) {
          // Most likely cause: a wallet row already exists for this user
          // pointing at a *different* Stripe account (the duplicate-onboarding
          // case). Don't overwrite — surface for manual reconciliation.
          console.error("❌ Failed to heal orphan wallet (likely duplicate Stripe account):", insertErr, "account:", account.id, "user:", supabaseUserId);
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        wallet = {
          user_id: supabaseUserId,
          created_at: new Date().toISOString(),
          last_onboarding_reminder_at: null,
        };
      }

      // Determine status
      const status = account.charges_enabled ? 'enabled' : 
                     account.details_submitted ? 'pending' : 'restricted';
      
      // Get requirements that are currently due
      const requirementsDue = account.requirements?.currently_due || [];
      
      // Update wallet status
      const updateData: any = { 
        stripe_account_status: status,
        stripe_requirements_due: requirementsDue,
        updated_at: new Date().toISOString(),
        last_stripe_sync_at: new Date().toISOString(),
      };
      
      // Set onboarded_at when first enabled
      if (status === 'enabled') {
        updateData.stripe_onboarded_at = new Date().toISOString();
        updateData.stripe_requirements_due = [];
      }
      
      const { error: walletError } = await supabase
        .from("user_wallets")
        .update(updateData)
        .eq("stripe_account_id", account.id);
      
      if (walletError) {
        console.error("❌ Failed to update wallet:", walletError);
      } else {
        console.log("✅ Wallet status updated:", status, "| Requirements:", requirementsDue.length);
      }

      // ============================================
      // SEND ONBOARDING REMINDER IF INCOMPLETE
      // ============================================
      if (status !== 'enabled' && requirementsDue.length > 0) {
        const walletCreatedAt = new Date(wallet.created_at).getTime();
        const now = Date.now();
        const tenMinutesAgo = now - (10 * 60 * 1000);
        const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
        
        // Only send if:
        // 1. Wallet created >10 mins ago (not mid-flow)
        // 2. No reminder sent in last 24 hours
        const lastReminder = wallet.last_onboarding_reminder_at 
          ? new Date(wallet.last_onboarding_reminder_at).getTime() 
          : 0;
        
        const shouldSendReminder = 
          walletCreatedAt < tenMinutesAgo && 
          lastReminder < twentyFourHoursAgo;
        
        if (shouldSendReminder) {
          console.log("📬 Sending onboarding reminder...");
          
          // Get user details
          const { data: user } = await supabase
            .from("users")
            .select("email, first_name, username")
            .eq("id", wallet.user_id)
            .single();
          
          // Map first requirement to friendly text
          const requirementLabels: Record<string, string> = {
            'individual.verification.document': 'ID verification',
            'individual.verification.additional_document': 'proof of address',
            'external_account': 'bank account details',
            'tos_acceptance.date': 'terms acceptance',
          };
          
          const firstReq = requirementsDue[0] || '';
          const friendlyReq = requirementLabels[firstReq] || 'a few details';
          
          // Send push notification
          try {
            const { data: pushTokens } = await supabase
              .from("push_tokens")
              .select("expo_push_token")
              .eq("user_id", wallet.user_id);
            
            if (pushTokens?.length) {
              const onboardingBadge = await computeBadgeTotal(supabase, wallet.user_id);
              const notifications = pushTokens.map((t: { expo_push_token: string }) => ({
                to: t.expo_push_token,
                sound: "default",
                title: "Complete your seller setup",
                body: `Just need ${friendlyReq} to start selling your books`,
                data: { screen: "SellerOnboarding" },
                badge: onboardingBadge + 1, // bump so the user notices
                channelId: "default",
              }));
              
              await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(notifications),
              });
              console.log("✅ Push reminder sent");
            }
          } catch (pushErr) {
            console.log("⚠️ Push reminder failed:", pushErr);
          }
          
          // Send email
          if (user?.email) {
            try {
              await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  type: "onboarding_reminder",
                  to: user.email,
                  data: {
                    name: user.first_name || user.username || "there",
                    requirement: friendlyReq,
                  },
                }),
              });
              console.log("✅ Email reminder sent");
            } catch (emailErr) {
              console.log("⚠️ Email reminder failed:", emailErr);
            }
          }
          
          // Update last reminder timestamp
          await supabase
            .from("user_wallets")
            .update({ last_onboarding_reminder_at: new Date().toISOString() })
            .eq("stripe_account_id", account.id);
        } else {
          console.log("⏭️ Skipping reminder (too soon or recently sent)");
        }
      }

      // Sync address if onboarding is complete
      if (account.details_submitted) {
        const address = account.individual?.address || account.business_profile?.support_address;
        const phone = account.individual?.phone || account.business_profile?.support_phone;
        const name = account.individual?.first_name && account.individual?.last_name
          ? `${account.individual.first_name} ${account.individual.last_name}`
          : null;
        
        if (address?.line1 && address?.city && address?.postal_code) {
          const { error: addressError } = await supabase
            .from("user_addresses")
            .upsert({
              user_id: wallet.user_id,
              address_line1: address.line1,
              address_line2: address.line2 || null,
              city: address.city,
              postcode: address.postal_code,
              phone: phone || null,
              name: name || null,
              is_default: true,
            }, {
              onConflict: 'user_id',
            });
          
          if (addressError) {
            console.error("❌ Failed to sync address:", addressError);
          } else {
            console.log("✅ Seller address synced from Stripe");
          }
        } else {
          console.log("⚠️ No complete address in Stripe account");
        }
      }
      
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ============================================
    // PAYMENT INTENT SUCCEEDED - Process sale
    // ============================================
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      console.log("💰 Payment succeeded:", paymentIntent.id);
      console.log("📦 Metadata:", paymentIntent.metadata);

      // ----- Phase 1B multi-item branch -----
      // PaymentIntents created by `create-order-payment-intent` carry
      // metadata.type === 'multi_item_order' and metadata.order_id. We hand
      // off to the same shared handler the wallet-only path uses so the
      // post-payment work (mark paid, mark listings sold, resolve guest
      // buyer, system message, notifications) is identical for both paths.
      if (paymentIntent.metadata?.type === "multi_item_order") {
        const orderId = paymentIntent.metadata.order_id;
        if (!orderId) {
          console.error("multi_item_order PI missing metadata.order_id");
          return new Response(
            JSON.stringify({ received: true, error: "missing order_id" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        const stripeChargeId =
          typeof paymentIntent.latest_charge === "string"
            ? paymentIntent.latest_charge
            : null;

        const result = await handleOrderPaid({
          supabase,
          orderId,
          stripeChargeId,
          // Transfer id (platform → seller for the wallet portion) is created
          // during create-order-payment-intent and stored on the order then.
          // No additional transfer to capture here.
          stripeTransferId: null,
        });

        if (!result.ok) {
          console.error("handleOrderPaid failed for", orderId, result.error);
        } else if (result.alreadyPaid) {
          console.log("Order", orderId, "was already processed — idempotent no-op");
        } else {
          console.log("Order", orderId, "marked paid via webhook");
        }

        return new Response(
          JSON.stringify({ received: true, multi_item: true, ok: result.ok }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      // ----- end multi-item branch — fall through to legacy single-item below -----

      const {
        listing_id,
        seller_id,
        balance_amount_pence,
        buyer_stripe_account,
        seller_stripe_account,
        seller_receives_pence,
        platform_fee_pence,
        total_amount_pence,
        book_price_pence,
        shipping_charge_pence,
        seller_balance_transfer_pence,
        buyer_transfer_id: metadataBuyerTransferId,
      } = paymentIntent.metadata;

      // buyer_id arrives in metadata for the mobile flow. The web checkout
      // flow can't put it there (the buyer may not have an account yet at
      // the moment we create the paymentIntent), so it sends a
      // checkout_session_id pointing at a temp_checkout_sessions row and we
      // resolve / create the buyer here.
      let buyer_id = paymentIntent.metadata.buyer_id;

      if (paymentIntent.metadata.platform === "web") {
        const checkout_session_id = paymentIntent.metadata.checkout_session_id;
        console.log("🌐 Web purchase — resolving buyer from checkout session:", checkout_session_id);

        const { data: checkoutSession, error: sessionError } = await supabase
          .from("temp_checkout_sessions")
          .select("*")
          .eq("id", checkout_session_id)
          .is("used_at", null)
          .single();

        if (sessionError || !checkoutSession) {
          console.error("❌ Checkout session not found or already used:", sessionError);
          return new Response("Checkout session not found", { status: 400 });
        }

        if (checkoutSession.is_existing_user && checkoutSession.existing_user_id) {
          // Existing buyer — already password-verified at checkout time
          buyer_id = checkoutSession.existing_user_id;
          console.log("✅ Existing buyer (pre-verified):", buyer_id);
        } else {
          // New buyer — create auth user
          let newUserId: string;
          const { data: newUser, error: createError } =
            await supabase.auth.admin.createUser({
              email: checkoutSession.email,
              password: checkoutSession.password_hash,
              email_confirm: true,
            });

          if (createError) {
            if (
              createError.message?.includes("already") ||
              (createError as any).code === "email_address_already_exists"
            ) {
              // Race: user was created between our pre-check and now. Look them up.
              const { data: existingProfile } = await supabase
                .from("users")
                .select("id")
                .eq("email", checkoutSession.email)
                .single();
              if (existingProfile) {
                newUserId = existingProfile.id;
              } else {
                const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
                newUserId = listData?.users?.find((u: { email?: string }) => u.email === checkoutSession.email)?.id || "";
              }
            } else {
              console.error("❌ User creation failed:", createError);
              return new Response("User creation failed", { status: 500 });
            }
          } else {
            newUserId = newUser.user.id;
          }

          buyer_id = newUserId;

          // Ensure a public.users row exists for the new buyer
          const { data: existingProfile } = await supabase
            .from("users")
            .select("id")
            .eq("id", buyer_id)
            .maybeSingle();

          if (!existingProfile) {
            const { error: profileError } = await supabase
              .from("users")
              .insert({
                id: buyer_id,
                email: checkoutSession.email,
                username: checkoutSession.username || null,
                first_name: checkoutSession.first_name || null,
                last_name: checkoutSession.last_name || null,
                name: paymentIntent.metadata.shipping_name || null,
                is_anonymous: false,
                registered_at: new Date().toISOString(),
              });
            if (profileError) console.error("⚠️ Profile creation error:", profileError);
            else console.log("✅ New buyer profile created:", buyer_id);
          }
        }

        // Burn the session: prevent reuse and scrub the stored password
        await supabase
          .from("temp_checkout_sessions")
          .update({ used_at: new Date().toISOString(), password_hash: "***" })
          .eq("id", checkout_session_id);
      }

      if (!listing_id || !buyer_id || !seller_id) {
        console.error("❌ Missing metadata");
        return new Response("Missing metadata", { status: 400 });
      }

      // Get listing details
      const { data: listing, error: listingError } = await supabase
        .from("listings")
        .select("id, title, author, asking_price_gbp, status")
        .eq("id", listing_id)
        .single();

      if (listingError || !listing) {
        console.error("❌ Listing not found:", listingError);
        return new Response("Listing not found", { status: 404 });
      }

      // Prevent double-processing
      if (listing.status === "sold") {
        console.log("⚠️ Listing already sold, skipping");
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const balanceAmountPence = parseInt(balance_amount_pence || "0");
      const isPartialBalancePayment = balanceAmountPence > 0 && buyer_stripe_account;

      // Buyer transfer was already created in create-payment-intent for partial payments
      let buyerTransferId: string | null = metadataBuyerTransferId || null;
      let sellerTransferId: string | null = null;

      // Handle partial balance payment — transfer seller's balance portion from platform
      if (isPartialBalancePayment) {
        console.log("💳 Partial balance payment - processing seller balance transfer");
        console.log("  Balance portion:", balanceAmountPence / 100);
        console.log("  Card portion:", paymentIntent.amount / 100);
        console.log("  Buyer transfer (from PI creation):", buyerTransferId);

        const sellerBalanceAmount = parseInt(seller_balance_transfer_pence || "0");
        if (sellerBalanceAmount > 0) {
          try {
            const sellerTransfer = await stripeFor(event).transfers.create({
              amount: sellerBalanceAmount,
              currency: "gbp",
              destination: seller_stripe_account,
            });
            sellerTransferId = sellerTransfer.id;
            console.log("✅ Seller balance transfer:", sellerTransferId, "amount:", sellerBalanceAmount / 100);
          } catch (transferErr) {
            console.error("❌ Seller balance transfer failed:", transferErr);
          }
        } else {
          console.log("ℹ️ No seller balance transfer needed (card covers seller portion)");
        }
      }

      // Calculate amounts for transaction record
      const totalAmountPence = parseInt(total_amount_pence || "0") || paymentIntent.amount;
      const platformFeePence = parseInt(platform_fee_pence || "0");
      const sellerReceivesPence = parseInt(seller_receives_pence || "0");
      const bookPricePence = parseInt(book_price_pence || "0");
      const shippingChargePence = parseInt(shipping_charge_pence || "0") || Math.round(SHIPPING_CHARGE_GBP * 100);
      
      const salePriceGbp = totalAmountPence / 100;
      const shippingChargeGbp = shippingChargePence / 100;
      const bookPriceGbp = bookPricePence / 100 || (salePriceGbp - shippingChargeGbp);
      
      // FIX: Platform fee calculation - £1 flat if book under £5, 20% if £5+
      let platformFeeGbp: number;
      if (platformFeePence > 0) {
        platformFeeGbp = platformFeePence / 100;
      } else if (bookPriceGbp < 5) {
        platformFeeGbp = 1.00;
      } else {
        platformFeeGbp = bookPriceGbp * 0.20;
      }
      
      const platformFeeVatGbp = platformFeeGbp * 0.20;
      
      // FIX: Seller payout = book price - platform fee (NOT total - platform fee)
      const sellerPayoutGbp = sellerReceivesPence > 0 
        ? sellerReceivesPence / 100 
        : bookPriceGbp - platformFeeGbp;

      console.log("💵 Money breakdown:", {
        total: salePriceGbp,
        bookPrice: bookPriceGbp,
        shipping: shippingChargeGbp,
        platformFee: platformFeeGbp,
        sellerPayout: sellerPayoutGbp,
      });

      // Determine payment method
      let paymentMethod = "card";
      if (isPartialBalancePayment) {
        paymentMethod = "balance_and_card";
      }

      // Create transaction record
      const { data: transaction, error: transactionError } = await supabase
        .from("transactions")
        .insert({
          listing_id: parseInt(listing_id),
          seller_id,
          buyer_id,
          sale_price_gbp: salePriceGbp,
          platform_fee_gbp: platformFeeGbp,
          platform_fee_vat_gbp: platformFeeVatGbp,
          seller_payout_gbp: sellerPayoutGbp,
          shipping_cost_gbp: shippingChargeGbp,
          shipping_name_full: paymentIntent.metadata.shipping_name || null,
          shipping_address_line1: paymentIntent.metadata.shipping_line1 || null,
          shipping_address_line2: paymentIntent.metadata.shipping_line2 || null,
          shipping_city: paymentIntent.metadata.shipping_city || null,
          shipping_postcode: paymentIntent.metadata.shipping_postcode || null,
          shipping_country: "GB",
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_method: paymentMethod,
          balance_used_gbp: balanceAmountPence / 100,
          card_charged_gbp: paymentIntent.amount / 100,
          stripe_payment_intent_id: paymentIntent.id,
          buyer_transfer_id: buyerTransferId,
          seller_transfer_id: sellerTransferId,
        })
        .select()
        .single();

      if (transactionError) {
        console.error("❌ Failed to create transaction:", transactionError);
        return new Response("Transaction insert failed", { status: 500 });
      }

      console.log("✅ Transaction created:", transaction.id);

      // Insert system message into conversation
      try {
        let { data: conversation } = await supabase
          .from("conversations")
          .select("id")
          .eq("listing_id", parseInt(listing_id))
          .eq("buyer_id", buyer_id)
          .eq("seller_id", seller_id)
          .single();

        if (!conversation) {
          const { data: newConvo } = await supabase
            .from("conversations")
            .insert({
              listing_id: parseInt(listing_id),
              buyer_id,
              seller_id,
            })
            .select()
            .single();
          conversation = newConvo;
        }

        if (conversation) {
          await supabase.from("messages").insert({
            conversation_id: conversation.id,
            sender_id: buyer_id,
            content: `Purchased for £${salePriceGbp.toFixed(2)}`,
            message_type: "system",
            event: "purchase",
            is_read: false,
          });
          console.log("✅ System message added to conversation");

          // Send push notifications for purchase
          try {
            const { data: buyer } = await supabase
              .from("users")
              .select("first_name, username")
              .eq("id", buyer_id)
              .single();
            const buyerName = buyer?.first_name || buyer?.username || "A buyer";

            const bookTitle = listing?.title || "your book";

            const { data: sellerTokens } = await supabase
              .from("push_tokens")
              .select("expo_push_token")
              .eq("user_id", seller_id);

            const { data: buyerTokens } = await supabase
              .from("push_tokens")
              .select("expo_push_token")
              .eq("user_id", buyer_id);

            // Compute each recipient's new total badge count
            // (unread messages + pending sales) so the OS can set the
            // app icon badge even when the app is closed.
            const sellerBadge = await computeBadgeTotal(supabase, seller_id);
            const buyerBadge = await computeBadgeTotal(supabase, buyer_id);

            const notifications: any[] = [];

            if (sellerTokens?.length) {
              sellerTokens.forEach((t: { expo_push_token: string }) => {
                notifications.push({
                  to: t.expo_push_token,
                  sound: "default",
                  title: "You made a sale! 🎉",
                  body: `${buyerName} purchased "${bookTitle}" for £${salePriceGbp.toFixed(2)}`,
                  data: { screen: "Orders" },
                  badge: sellerBadge,
                  channelId: "default",
                });
              });
            }

            if (buyerTokens?.length) {
              buyerTokens.forEach((t: { expo_push_token: string }) => {
                notifications.push({
                  to: t.expo_push_token,
                  sound: "default",
                  title: "Order confirmed ✓",
                  body: `Your copy of "${bookTitle}" is on its way`,
                  data: { screen: "Orders" },
                  badge: buyerBadge,
                  channelId: "default",
                });
              });
            }

            if (notifications.length > 0) {
              const pushResponse = await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(notifications),
              });
              const pushResult = await pushResponse.json();
              console.log("📬 Push notifications sent:", pushResult);
            }

            // Send emails
            try {
              const { data: buyerUser } = await supabase
                .from("users")
                .select("email, first_name, username")
                .eq("id", buyer_id)
                .single();

              const { data: sellerUser } = await supabase
                .from("users")
                .select("email, first_name, username")
                .eq("id", seller_id)
                .single();

              const shippingAddress = [
                paymentIntent.metadata.shipping_name,
                paymentIntent.metadata.shipping_line1,
                paymentIntent.metadata.shipping_city,
                paymentIntent.metadata.shipping_postcode,
              ].filter(Boolean).join(", ");

              if (buyerUser?.email) {
                await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify({
                    type: "order_confirmation",
                    to: buyerUser.email,
                    data: {
                      buyerName: buyerUser.first_name || buyerUser.username || "there",
                      bookTitle: bookTitle,
                      bookAuthor: listing?.author || "",
                      price: salePriceGbp,
                      lockerName: shippingAddress,
                    },
                  }),
                });
                console.log("📧 Buyer email sent");
              }

              if (sellerUser?.email) {
                await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify({
                    type: "new_sale",
                    to: sellerUser.email,
                    data: {
                      sellerName: sellerUser.first_name || sellerUser.username || "there",
                      bookTitle: bookTitle,
                      bookAuthor: listing?.author || "",
                      price: salePriceGbp,
                      lockerName: shippingAddress,
                    },
                  }),
                });
                console.log("📧 Seller email sent");
              }
            } catch (emailError) {
              console.log("⚠️ Could not send emails:", emailError);
            }

          } catch (pushError) {
            console.log("⚠️ Could not send push notifications:", pushError);
          }
        }
      } catch (msgError) {
        console.log("⚠️ Could not add system message:", msgError);
      }

      // Mark listing as sold
      const { error: updateError } = await supabase
        .from("listings")
        .update({ status: "sold", sold_at: new Date().toISOString() })
        .eq("id", listing_id);

      if (updateError) {
        console.error("❌ Failed to update listing:", updateError);
      } else {
        console.log("✅ Listing marked as sold");
      }

      // Update seller's wallet totals
      const { error: walletError } = await supabase.rpc("increment_seller_earnings", {
        p_user_id: seller_id,
        p_amount: sellerPayoutGbp,
      });

      if (walletError) {
        console.log("⚠️ Wallet update skipped (RPC may not exist):", walletError);
      }

      return new Response(
        JSON.stringify({ received: true, transactionId: transaction.id }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Unhandled event type
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("❌ Webhook error:", err);
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }
});
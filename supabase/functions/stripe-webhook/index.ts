import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const event = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    console.log("Webhook event:", event.type);

    // Handle successful subscription creation
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userEmail = session.customer_email || session.customer_details?.email;
      const userId = session.metadata?.user_id;
      const stripeCustomerId = session.customer;

      if (userEmail && userId && stripeCustomerId) {
        // Only link user to Stripe customer if not already set
        await supabaseClient.from("subscribers").upsert({
          email: userEmail,
          user_id: userId,
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'email' });
        await supabaseClient.from("providers").update({
          stripe_customer_id: stripeCustomerId,
          updated_at: new Date().toISOString(),
        }).eq('user_id', userId);
        console.log("Linked user to Stripe customer:", userEmail, stripeCustomerId);
      }
    }

    // Handle subscription updates and cancellations
    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      const status = subscription.status;
      const currentPeriodEnd = subscription.current_period_end;
      const items = subscription.items.data;
      const priceId = items[0]?.price?.id;

      // Robust priceId to tier mapping
      const priceIdToTier = {
        [Deno.env.get("STRIPE_PRICE_STARTER")]: "starter",
        [Deno.env.get("STRIPE_PRICE_PRO")]: "pro",
        // Add more price IDs and tiers as needed
      };
      let tier = priceIdToTier[priceId] || null;

      // Log for debugging
      console.log("Stripe subscription update: priceId", priceId, "mapped tier", tier, "env starter", Deno.env.get("STRIPE_PRICE_STARTER"), "env pro", Deno.env.get("STRIPE_PRICE_PRO"), "status", status);

      // Find user by customerId (assuming you store stripe_customer_id in your DB)
      const { data: user } = await supabaseClient
        .from("subscribers")
        .select("*")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();

      if (user) {
        // If status is active but tier is null, keep previous tier and log warning
        let subscriptionTierToSet = null;
        if (status === "active") {
          if (tier) {
            subscriptionTierToSet = tier;
          } else {
            subscriptionTierToSet = user.subscription_tier; // keep previous
            console.warn("Unknown priceId for active subscription, keeping previous tier:", priceId, "for user:", user.email);
          }
        }

        await supabaseClient.from("subscribers").upsert({
          email: user.email,
          user_id: user.id, // FIXED: use user.id
          stripe_customer_id: customerId,
          subscribed: status === "active",
          subscription_tier: subscriptionTierToSet,
          subscription_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'email' });
        console.log("DB UPDATE", { source: "stripe-webhook", table: "subscribers", subscribed: status === "active", subscriptionTierToSet, customerId });

        await supabaseClient.from("providers").update({
          subscription_tier: subscriptionTierToSet || 'free',
          subscription_end_date: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id); // FIXED: use user.id
        console.log("DB UPDATE", { source: "stripe-webhook", table: "providers", subscriptionTier: subscriptionTierToSet || 'free', customerId });

        // Fetch and log the updated DB state for debugging
        const { data: updatedSubscriber } = await supabaseClient
          .from("subscribers")
          .select("*")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        const { data: updatedProvider } = await supabaseClient
          .from("providers")
          .select("*")
          .eq("user_id", user.user_id)
          .maybeSingle();
        console.log("DB state after update:", { updatedSubscriber, updatedProvider });

        console.log("Updated subscription for user:", user.email, "tier:", subscriptionTierToSet, "status:", status);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
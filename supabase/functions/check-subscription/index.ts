import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper logging function for enhanced debugging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Use the service role key to perform writes (upsert) in Supabase
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    console.log("Check subscription function started - basic debug");
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    console.log("Stripe key check:", stripeKey ? "EXISTS" : "MISSING");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Check if we have a stripe_customer_id stored in the DB
    const { data: subscriberRecord } = await supabaseClient
      .from("subscribers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    let customerIdToUse = null;
    if (subscriberRecord && subscriberRecord.stripe_customer_id) {
      customerIdToUse = subscriberRecord.stripe_customer_id;
      logStep("Found stripe_customer_id in DB", { userId: user.id, customerId: customerIdToUse });
    } else {
      // fallback to searching by email if no customer_id in DB
      logStep("No stripe_customer_id in DB, searching Stripe by email", { email: user.email });
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerIdToUse = customers.data[0].id;
        logStep("Found Stripe customer by email", { customerId: customerIdToUse });
      }
    }
    if (!customerIdToUse) {
      logStep("No Stripe customer found for user, updating unsubscribed state", { userId: user.id, email: user.email });
      await supabaseClient.from("subscribers").upsert({
        email: user.email,
        user_id: user.id,
        stripe_customer_id: null,
        subscribed: false,
        subscription_tier: null,
        subscription_end: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });
      
      // Also update providers table
      await supabaseClient.from("providers").update({
        subscription_tier: 'free',
        subscription_end_date: null,
        stripe_customer_id: null,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);
      
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customerIdToUse;
    logStep("Using customerId for Stripe operations", { customerId });

    // Get ALL subscriptions (active, canceled, past_due, etc.) to properly handle cancellations
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 100, // Get all subscriptions to find the most recent one
    });

    logStep("Found subscriptions", { 
      total: subscriptions.data.length,
      statuses: subscriptions.data.map(sub => ({ id: sub.id, status: sub.status, cancel_at_period_end: sub.cancel_at_period_end }))
    });

    // Find the most recent subscription that's either active, canceled, or past_due
    const relevantSub = subscriptions.data
      .filter(sub => ['active', 'canceled', 'past_due'].includes(sub.status))
      .sort((a, b) => b.created - a.created)[0];

    let hasActiveSub = false;
    let subscriptionTier = null;
    let subscriptionEnd = null;

    if (relevantSub) {
      logStep("Processing subscription", { 
        id: relevantSub.id, 
        status: relevantSub.status,
        cancel_at_period_end: relevantSub.cancel_at_period_end,
        canceled_at: relevantSub.canceled_at
      });

      // Consider subscription active if status is 'active', regardless of cancel_at_period_end
      if (relevantSub.status === 'active') {
        hasActiveSub = true;
        subscriptionEnd = new Date(relevantSub.current_period_end * 1000).toISOString();
        
        // Determine subscription tier from priceId (robust mapping)
        const priceId = relevantSub.items.data[0].price.id;
        const priceIdToTier = {
          [Deno.env.get("STRIPE_PRICE_STARTER")]: "starter",
          [Deno.env.get("STRIPE_PRICE_PRO")]: "pro",
          // Add more price IDs and tiers as needed
        };
        subscriptionTier = priceIdToTier[priceId] || null;
        if (!subscriptionTier) {
          // fallback to previous logic or keep previous tier if possible
          const price = await stripe.prices.retrieve(priceId);
          const amount = price.unit_amount || 0;
          if (amount <= 799) {
            subscriptionTier = "starter";
          } else if (amount >= 2999) {
            subscriptionTier = "pro";
          } else {
            subscriptionTier = "starter";
          }
          logStep("Unknown priceId for active subscription, fallback to amount-based tier", { priceId, amount, subscriptionTier });
        }
        logStep("Active subscription found", { subscriptionId: relevantSub.id, endDate: subscriptionEnd, tier: subscriptionTier });
      } else {
        // Subscription is canceled, past_due, or marked for cancellation
        logStep("Subscription is inactive or canceled", { 
          status: relevantSub.status,
          cancel_at_period_end: relevantSub.cancel_at_period_end,
          canceled_at: relevantSub.canceled_at
        });
        hasActiveSub = false;
        subscriptionTier = null;
        subscriptionEnd = null;
      }
    } else {
      logStep("No relevant subscription found");
    }

    // Update subscribers table
    await supabaseClient.from("subscribers").upsert({
      email: user.email,
      user_id: user.id,
      stripe_customer_id: customerId,
      subscribed: hasActiveSub,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' });
    logStep("DB UPDATE", { source: "check-subscription", table: "subscribers", subscribed: hasActiveSub, subscriptionTier, customerId });

    // Update providers table as well
    await supabaseClient.from("providers").update({
      subscription_tier: subscriptionTier || 'free',
      subscription_end_date: subscriptionEnd,
      stripe_customer_id: customerId,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);
    logStep("DB UPDATE", { source: "check-subscription", table: "providers", subscriptionTier: subscriptionTier || 'free', customerId });

    logStep("Updated both subscribers and providers tables", { 
      subscribed: hasActiveSub, 
      subscriptionTier: subscriptionTier || 'free',
      customerId 
    });
    
    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      subscription_tier: subscriptionTier,
      subscription_end: subscriptionEnd
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

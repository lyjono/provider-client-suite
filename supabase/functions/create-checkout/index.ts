
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
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Use the service role key to perform writes in Supabase
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { tier } = await req.json();
    if (!tier || !['starter', 'pro'].includes(tier)) {
      throw new Error("Invalid tier specified");
    }
    logStep("Tier requested", { tier });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Find existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });

      // Check for existing active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 10,
      });

      // Filter out subscriptions that are marked for cancellation
      const activeSubscriptions = subscriptions.data.filter(sub => !sub.cancel_at_period_end);
      
      if (activeSubscriptions.length > 0) {
        logStep("Found active subscriptions - canceling them before creating new one", { 
          count: activeSubscriptions.length,
          subscriptionIds: activeSubscriptions.map(s => s.id)
        });

        // Cancel all existing active subscriptions immediately
        for (const subscription of activeSubscriptions) {
          await stripe.subscriptions.cancel(subscription.id);
          logStep("Canceled subscription", { subscriptionId: subscription.id });
        }
      }
    } else {
      // Create new customer if none exists
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id }
      });
      customerId = customer.id;
      logStep("Created new customer", { customerId });
    }

    // Set up pricing based on tier
    const priceMapping = {
      starter: { amount: 2999, name: "Starter Plan" }, // $29.99
      pro: { amount: 7999, name: "Pro Plan" } // $79.99
    };

    const selectedPlan = priceMapping[tier as keyof typeof priceMapping];
    logStep("Selected plan", { tier, price: selectedPlan });

    const origin = req.headers.get("origin") || "http://localhost:3000";

    // Create checkout session for new subscription
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: selectedPlan.name,
              description: `${tier} subscription plan`
            },
            unit_amount: selectedPlan.amount,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/dashboard?success=true`,
      cancel_url: `${origin}/dashboard?canceled=true`,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      metadata: {
        user_id: user.id,
        tier: tier
      }
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

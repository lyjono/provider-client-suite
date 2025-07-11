
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
    let activeSubscriptions: any[] = [];

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
      activeSubscriptions = subscriptions.data.filter(sub => !sub.cancel_at_period_end);
    } else {
      // Create new customer if none exists
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id }
      });
      customerId = customer.id;
      logStep("Created new customer", { customerId });
    }

    // Set up pricing based on tier - create actual Stripe prices for better management
    const priceMapping = {
      starter: { amount: 2999, name: "Starter Plan" }, // $29.99
      pro: { amount: 7999, name: "Pro Plan" } // $79.99
    } as const;

    const selectedPlan = priceMapping[tier as keyof typeof priceMapping];
    logStep("Selected plan", { tier, price: selectedPlan });

    const origin = req.headers.get("origin") || "http://localhost:3000";

    // If user has active subscriptions, modify the existing subscription instead of creating new one
    if (activeSubscriptions.length > 0) {
      const currentSubscription = activeSubscriptions[0];
      const currentPrice = currentSubscription.items.data[0].price;
      const currentAmount = currentPrice.unit_amount || 0;
      const newAmount = selectedPlan.amount;

      logStep("Modifying existing subscription", { 
        currentAmount, 
        newAmount, 
        subscriptionId: currentSubscription.id 
      });

      if (newAmount > currentAmount) {
        // Upgrade: Immediate change with proration
        logStep("Processing upgrade with immediate proration");
        
        // Create new price for the subscription
        const newPrice = await stripe.prices.create({
          currency: "usd",
          unit_amount: selectedPlan.amount,
          recurring: { interval: "month" },
          product_data: {
            name: selectedPlan.name,
            description: `${tier} subscription plan`
          }
        });

        // Update subscription immediately with proration
        await stripe.subscriptions.update(currentSubscription.id, {
          items: [{
            id: currentSubscription.items.data[0].id,
            price: newPrice.id,
          }],
          proration_behavior: 'always_invoice', // Bill immediately for the difference
          metadata: {
            user_id: user.id,
            tier: tier
          }
        });

        logStep("Subscription upgraded successfully");
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Subscription upgraded successfully with prorated billing" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });

      } else if (newAmount < currentAmount) {
        // Downgrade: Schedule change for end of current period
        logStep("Processing downgrade - scheduling for end of period");
        
        // Create new price for the subscription
        const newPrice = await stripe.prices.create({
          currency: "usd",
          unit_amount: selectedPlan.amount,
          recurring: { interval: "month" },
          product_data: {
            name: selectedPlan.name,
            description: `${tier} subscription plan`
          }
        });

        // Use schedule to change subscription at period end
        await stripe.subscriptionSchedules.create({
          customer: customerId,
          start_date: currentSubscription.current_period_end,
          end_behavior: 'release',
          phases: [{
            items: [{
              price: newPrice.id,
              quantity: 1
            }],
            metadata: {
              user_id: user.id,
              tier: tier
            }
          }],
          metadata: {
            user_id: user.id,
            tier: tier,
            downgrade_from: currentSubscription.id
          }
        });

        const periodEnd = new Date(currentSubscription.current_period_end * 1000);
        logStep("Subscription downgrade scheduled", { effectiveDate: periodEnd });
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: `Subscription will change to ${selectedPlan.name} on ${periodEnd.toDateString()}. You'll continue to enjoy your current plan until then.` 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });

      } else {
        // Same tier - no change needed
        logStep("User already has this subscription tier");
        return new Response(JSON.stringify({ 
          success: true, 
          message: "You're already subscribed to this plan" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // No active subscription - create new checkout session
    logStep("Creating new subscription checkout session");
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

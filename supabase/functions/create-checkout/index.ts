import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  console.log("=== FUNCTION ENTRY POINT ===");
  
  if (req.method === "OPTIONS") {
    console.log("OPTIONS request handled");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Function started - basic debug");
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    console.log("Stripe key check:", stripeKey ? "EXISTS" : "MISSING");
    if (!stripeKey) {
      console.log("STRIPE_SECRET_KEY is missing!");
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    console.log("Creating Supabase client...");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    console.log("Supabase client created");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { tier } = await req.json();
    if (!tier || !['free', 'starter', 'pro'].includes(tier)) {
      throw new Error("Invalid tier specified");
    }
    logStep("Request body parsed", { tier, requestedTier: tier });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Find existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    // Handle cancellation (free tier)
    if (tier === 'free') {
      if (!customerId) {
        throw new Error("No existing subscription to cancel");
      }

      // Find active subscription
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data.length === 0) {
        throw new Error("No active subscription found to cancel");
      }

      const subscription = subscriptions.data[0];
      
      // Cancel at period end
      await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
      });

      logStep("Subscription set to cancel at period end", { subscriptionId: subscription.id });
      
      return new Response(JSON.stringify({ 
        message: "Subscription will be cancelled at the end of your current billing period" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Handle downgrades for existing customers
    if (customerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const currentSub = subscriptions.data[0];
        const currentPrice = currentSub.items.data[0].price;
        const currentAmount = currentPrice.unit_amount || 0;
        
        // Determine if this is an upgrade or downgrade
        const newAmount = tier === 'starter' ? 799 : 2999; // $7.99 or $29.99
        
        logStep("Comparing prices", { 
          currentAmount, 
          newAmount, 
          currentPriceId: currentPrice.id,
          isDowngrade: newAmount <= currentAmount 
        });
        
        if (newAmount === currentAmount) {
          // Same tier - no change needed
          logStep("Same tier requested - no change needed");
          return new Response(JSON.stringify({ 
            message: `You are already on the ${tier} plan` 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
        
        if (newAmount < currentAmount) {
          // Downgrade: schedule change at period end using subscription schedule
          logStep("Processing downgrade - scheduling for period end");
          
          // Create a subscription schedule for the downgrade
          await stripe.subscriptionSchedules.create({
            customer: customerId,
            start_date: currentSub.current_period_end,
            end_behavior: 'release',
            phases: [
              {
                items: [
                  {
                    price_data: {
                      currency: 'usd',
                      unit_amount: newAmount,
                      recurring: { interval: 'month' },
                      product_data: {
                        name: tier === 'starter' ? 'Starter Plan' : 'Pro Plan',
                      },
                    },
                    quantity: 1,
                  },
                ],
              },
            ],
          });
          
          logStep("Downgrade scheduled for period end", { 
            currentPeriodEnd: new Date(currentSub.current_period_end * 1000).toISOString(),
            newTier: tier 
          });

          return new Response(JSON.stringify({ 
            message: `Your plan will be downgraded to ${tier} at the end of your current billing period` 
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
        // For upgrades, continue to checkout session below
        logStep("Processing upgrade via checkout");
      }
    }

    // Create checkout session for new subscriptions or upgrades
    const priceAmount = tier === 'starter' ? 799 : 2999;
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: tier === 'starter' ? 'Starter Plan' : 'Pro Plan',
            },
            unit_amount: priceAmount,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/dashboard?success=true`,
      cancel_url: `${req.headers.get("origin")}/dashboard`,
      subscription_data: {
        metadata: {
          tier: tier,
          user_id: user.id,
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("DETAILED ERROR:", { message: errorMessage, stack: errorStack });
    logStep("ERROR in create-checkout", { message: errorMessage, stack: errorStack });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
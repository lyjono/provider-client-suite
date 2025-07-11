
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
    if (!tier || !['starter', 'pro', 'free'].includes(tier)) {
      throw new Error("Invalid tier specified");
    }
    logStep("Tier requested", { tier });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Find existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | null = null;
    let activeSubscriptions: Stripe.Subscription[] = [];

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });

      // Get all subscriptions for this customer
      const allSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        limit: 10,
      });

      // Filter for truly active subscriptions (not canceled or canceling)
      activeSubscriptions = allSubscriptions.data.filter(sub => 
        sub.status === "active" && !sub.cancel_at_period_end
      );

      logStep("Active subscriptions found", { count: activeSubscriptions.length });
    } else {
      // Create new customer if none exists
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id }
      });
      customerId = customer.id;
      logStep("Created new customer", { customerId });
    }

    // Define pricing tiers
    const pricingTiers = {
      free: { amount: 0, name: "Free Plan" },
      starter: { amount: 2999, name: "Starter Plan" }, // $29.99
      pro: { amount: 7999, name: "Pro Plan" } // $79.99
    };

    const targetPlan = pricingTiers[tier as keyof typeof pricingTiers];
    const origin = req.headers.get("origin") || "http://localhost:3000";

    // CASE 1: User wants to downgrade to free
    if (tier === 'free') {
      if (activeSubscriptions.length === 0) {
        logStep("User already on free tier");
        return new Response(JSON.stringify({ 
          success: true, 
          message: "You're already on the free plan" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Cancel all active subscriptions at period end
      for (const subscription of activeSubscriptions) {
        await stripe.subscriptions.update(subscription.id, {
          cancel_at_period_end: true,
          metadata: {
            ...subscription.metadata,
            cancelled_to_free: 'true',
            cancelled_by_user: user.id
          }
        });

        const periodEnd = new Date(subscription.current_period_end * 1000);
        logStep("Subscription cancelled to free", { 
          subscriptionId: subscription.id, 
          effectiveDate: periodEnd 
        });
      }

      const latestSubscription = activeSubscriptions.sort((a, b) => b.current_period_end - a.current_period_end)[0];
      const periodEnd = new Date(latestSubscription.current_period_end * 1000);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: `Your subscription will end on ${periodEnd.toDateString()} and you'll switch to the free plan. You'll continue to enjoy your current plan benefits until then.` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // CASE 2: User has active subscription and wants to change tier
    if (activeSubscriptions.length > 0) {
      const currentSubscription = activeSubscriptions[0];
      const currentPrice = currentSubscription.items.data[0].price;
      const currentAmount = currentPrice.unit_amount || 0;
      const targetAmount = targetPlan.amount;

      logStep("Modifying existing subscription", { 
        currentAmount, 
        targetAmount, 
        subscriptionId: currentSubscription.id 
      });

      if (targetAmount === currentAmount) {
        logStep("Same tier requested");
        return new Response(JSON.stringify({ 
          success: true, 
          message: "You're already subscribed to this plan" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Create new price for the target tier
      const newPrice = await stripe.prices.create({
        currency: "usd",
        unit_amount: targetPlan.amount,
        recurring: { interval: "month" },
        product_data: {
          name: targetPlan.name
        }
      });

      if (targetAmount > currentAmount) {
        // UPGRADE: Immediate change with proration
        logStep("Processing upgrade with immediate proration");
        
        await stripe.subscriptions.update(currentSubscription.id, {
          items: [{
            id: currentSubscription.items.data[0].id,
            price: newPrice.id,
          }],
          proration_behavior: 'always_invoice',
          metadata: {
            user_id: user.id,
            tier: tier,
            upgrade_from: currentPrice.id,
            upgraded_at: new Date().toISOString()
          }
        });

        logStep("Subscription upgraded successfully");
        return new Response(JSON.stringify({ 
          success: true, 
          message: `Successfully upgraded to ${targetPlan.name}! You've been charged the prorated difference and can use all new features immediately.` 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });

      } else {
        // DOWNGRADE: Schedule change at period end using subscription schedules
        logStep("Processing downgrade - scheduling change at period end");
        
        // Create a subscription schedule to handle the downgrade
        const subscriptionSchedule = await stripe.subscriptionSchedules.create({
          from_subscription: currentSubscription.id,
          phases: [
            {
              // Current phase - keep existing subscription until period end
              items: [{
                price: currentPrice.id,
                quantity: 1
              }],
              end_date: currentSubscription.current_period_end
            },
            {
              // New phase - start the downgraded plan
              items: [{
                price: newPrice.id,
                quantity: 1
              }]
            }
          ],
          metadata: {
            user_id: user.id,
            downgrade_scheduled: 'true',
            new_tier: tier,
            downgrade_initiated_at: new Date().toISOString()
          }
        });

        const periodEnd = new Date(currentSubscription.current_period_end * 1000);
        logStep("Subscription downgrade scheduled", { 
          scheduleId: subscriptionSchedule.id,
          effectiveDate: periodEnd 
        });
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: `Your current plan will continue until ${periodEnd.toDateString()}, then you'll switch to the ${targetPlan.name}. You'll keep all current benefits until then.` 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // CASE 3: No active subscription - create new checkout session
    logStep("Creating new subscription checkout session");
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: targetPlan.name
            },
            unit_amount: targetPlan.amount,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/dashboard?success=true&tier=${tier}`,
      cancel_url: `${origin}/dashboard?canceled=true`,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      metadata: {
        user_id: user.id,
        tier: tier,
        new_subscription: 'true'
      }
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ 
      url: session.url,
      success: false // Indicates this is a redirect, not an immediate change
    }), {
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

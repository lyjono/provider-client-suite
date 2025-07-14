import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
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
    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) throw new Error("User not authenticated");
    
    const user = userData.user;
    const { tier } = await req.json();
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Debug logging
    console.log("Requested tier:", tier);
    console.log("STRIPE_PRICE_STARTER:", Deno.env.get("STRIPE_PRICE_STARTER"));
    console.log("STRIPE_PRICE_PRO:", Deno.env.get("STRIPE_PRICE_PRO"));

    // Find or create Stripe customer
    // --- FIX: Always use stripe_customer_id from DB if available ---
    let customerId: string | undefined;
    // Fetch customer ID from DB subscriber (or your user table)
    const { data: subscriber, error: subscriberError } = await supabaseClient
      .from("subscribers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();
    if (subscriberError) {
      console.error("Error fetching subscriber for stripe_customer_id:", subscriberError);
    }
    if (subscriber?.stripe_customer_id) {
      customerId = subscriber.stripe_customer_id;
      console.log("Using stripe_customer_id from DB:", customerId);
    } else {
      // Fallback: search Stripe by email (should only happen for legacy users)
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        console.log("Found Stripe customer by email:", customerId);
      } else {
        const customer = await stripe.customers.create({ email: user.email });
        customerId = customer.id;
        // Optionally, update DB with new customerId
        const { error: updateError } = await supabaseClient
          .from("subscribers")
          .update({ stripe_customer_id: customerId })
          .eq("user_id", user.id);
        if (updateError) {
          console.error("Error updating stripe_customer_id in DB:", updateError);
        }
        console.log("Created new Stripe customer and updated DB:", customerId);
      }
    }
    if (!customerId) throw new Error("Could not determine Stripe customer ID");

    // Find managed subscription for this customer
    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
    console.log("All subscriptions:", JSON.stringify(subscriptions.data, null, 2));
    // Define price IDs for each tier (replace with your actual Stripe price IDs)
    const priceIds = {
      starter: Deno.env.get("STRIPE_PRICE_STARTER"),
      pro: Deno.env.get("STRIPE_PRICE_PRO"),
      // add more if needed
    };
    const priceId = priceIds[tier];
    console.log("priceIds:", priceIds, "tier:", tier, "priceId:", priceId);
    if (!priceId) throw new Error(`Invalid tier or missing Stripe price ID. tier=${tier}, priceId=${priceId}`);

    // Find managed subscription for this customer for any paid price
    const managedStatuses = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'];
    const managedSub = subscriptions.data.find(sub =>
      managedStatuses.includes(sub.status) &&
      sub.items.data.some(item => Object.values(priceIds).includes(item.price.id))
    );
    console.log("managedSub found:", managedSub);

    // If the user has any managed subscription for a paid price, send to portal for all plan changes (upgrade/downgrade/cancel)
    if (managedSub) {
      return new Response(JSON.stringify({ portal: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    let session;
    // Only create a new subscription via Checkout if no managed subscription for a paid price exists
    session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/dashboard?success=true`,
      cancel_url: `${req.headers.get("origin")}/dashboard`,
      metadata: {
        user_id: user.id,
        tier: tier,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    // Enhanced error logging
    console.error("Checkout error:", error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
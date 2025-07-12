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
      const userEmail = session.customer_email;
      const userId = session.metadata?.user_id;
      const tier = session.metadata?.tier;

      if (userEmail && userId && tier) {
        // Update subscribers table
        await supabaseClient.from("subscribers").upsert({
          email: userEmail,
          user_id: userId,
          subscribed: true,
          subscription_tier: tier,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'email' });

        // Update providers table
        await supabaseClient.from("providers").update({
          subscription_tier: tier,
          subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        }).eq('user_id', userId);

        console.log("Updated subscription for user:", userEmail, "tier:", tier);
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
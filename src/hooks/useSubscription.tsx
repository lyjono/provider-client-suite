
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface SubscriptionData {
  subscribed: boolean;
  subscription_tier: string | null;
  subscription_end: string | null;
}

export const useSubscription = () => {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData>({
    subscribed: false,
    subscription_tier: null,
    subscription_end: null
  });

  // Query to get subscription data from database
  const { data: dbSubscription, isLoading, refetch } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('subscribers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching subscription:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!user?.id,
    staleTime: 30 * 60 * 1000, // 30 minutes - much longer stale time
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: false, // Disable automatic refetching
  });

  // Function to check subscription status with Stripe and refresh local data
  const checkSubscription = useCallback(async (force = false) => {
    if (!session?.access_token) return;

    try {
      console.log('Checking subscription status...', force ? '(forced)' : '');
      
      // Clear session storage if forced
      if (force && user?.id) {
        sessionStorage.removeItem(`subscription-checked-${user.id}`);
      }
      
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      console.log('Subscription check result:', data);

      setSubscriptionData({
        subscribed: data.subscribed || false,
        subscription_tier: data.subscription_tier,
        subscription_end: data.subscription_end
      });

      // Refresh the query to get updated data
      await refetch();
      
      // Also invalidate and refetch provider data if it exists
      queryClient.invalidateQueries({ queryKey: ['user-dashboard-data'] });

    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  }, [session?.access_token, refetch, queryClient, user?.id]);

  const createCheckoutSession = async (tier: 'starter' | 'pro' | 'free') => {
    if (!session?.access_token) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { tier },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) throw error;

    // Handle different response types
    if (data.url && !data.success) {
      // New subscription - redirect to Stripe
      window.open(data.url, '_blank');
      return null;
    } else if (data.success) {
      // Immediate change (upgrade/downgrade/cancellation)
      await checkSubscription();
      return data.message || 'Subscription updated successfully';
    } else {
      // Fallback case
      throw new Error('Unexpected response from server');
    }
  };

  // Function to open customer portal
  const openCustomerPortal = async () => {
    if (!session?.access_token) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('customer-portal', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) throw error;

    // Open customer portal in a new tab
    window.open(data.url, '_blank');
  };

  // Update subscription data when database data changes
  useEffect(() => {
    if (dbSubscription) {
      setSubscriptionData({
        subscribed: dbSubscription.subscribed || false,
        subscription_tier: dbSubscription.subscription_tier,
        subscription_end: dbSubscription.subscription_end
      });
    }
  }, [dbSubscription]);

  // Check subscription on mount and when user changes - but only once
  useEffect(() => {
    if (user && session) {
      const hasChecked = sessionStorage.getItem(`subscription-checked-${user.id}`);
      if (!hasChecked) {
        checkSubscription();
        sessionStorage.setItem(`subscription-checked-${user.id}`, 'true');
      }
    }
  }, [user?.id, session, checkSubscription]);

  // Listen for window focus to refresh subscription status - but with much longer throttling
  useEffect(() => {
    let lastFocusCheck = 0;
    const FOCUS_CHECK_THROTTLE = 5 * 60 * 1000; // 5 minutes instead of 30 seconds

    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusCheck > FOCUS_CHECK_THROTTLE && user && session) {
        console.log('Window focused, checking subscription status...');
        lastFocusCheck = now;
        checkSubscription();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, session, checkSubscription]);

  return {
    ...subscriptionData,
    isLoading,
    checkSubscription,
    createCheckoutSession,
    openCustomerPortal,
    refreshSubscription: refetch
  };
};

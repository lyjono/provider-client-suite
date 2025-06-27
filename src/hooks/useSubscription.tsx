
import { useState, useEffect } from 'react';
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
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching subscription:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!user?.id,
  });

  // Function to check subscription status with Stripe and refresh local data
  const checkSubscription = async () => {
    if (!session?.access_token) return;

    try {
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
      queryClient.invalidateQueries({ queryKey: ['provider'] });

    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  // Function to create checkout session
  const createCheckoutSession = async (tier: 'starter' | 'pro') => {
    if (!session?.access_token) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { tier },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) throw error;

    // Open Stripe checkout in a new tab
    window.open(data.url, '_blank');
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

  // Check subscription on mount and when user changes
  useEffect(() => {
    if (user && session) {
      checkSubscription();
    }
  }, [user, session]);

  // Listen for window focus to refresh subscription status
  useEffect(() => {
    const handleFocus = () => {
      if (user && session) {
        console.log('Window focused, checking subscription status...');
        checkSubscription();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, session]);

  return {
    ...subscriptionData,
    isLoading,
    checkSubscription,
    createCheckoutSession,
    openCustomerPortal,
    refreshSubscription: refetch
  };
};

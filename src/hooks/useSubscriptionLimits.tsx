
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useSubscriptionLimits = (providerId?: string) => {
  const { user } = useAuth();

  const { data: canInteract, isLoading } = useQuery({
    queryKey: ['subscription-limits', providerId, user?.id],
    queryFn: async () => {
      if (!providerId || !user?.id) return true;

      try {
        // Check if current user is a provider
        const { data: provider } = await supabase
          .from('providers')
          .select('id, subscription_tier')
          .eq('user_id', user.id)
          .single();

        if (!provider) return true; // User is not a provider, so no restrictions

        // Check if provider can accept new clients
        const { data: canAccept } = await supabase
          .rpc('check_provider_client_limit', { provider_id: provider.id });

        return canAccept;
      } catch (error) {
        console.error('Error checking subscription limits:', error);
        return true; // Default to allowing access on error
      }
    },
    enabled: !!providerId && !!user?.id,
  });

  return { canInteract: canInteract ?? true, isLoading };
};

export const useProviderClientInteraction = (clientId?: string) => {
  const { user } = useAuth();

  const { data: canInteract, isLoading } = useQuery({
    queryKey: ['provider-client-interaction', clientId, user?.id],
    queryFn: async () => {
      if (!clientId || !user?.id) return true;

      try {
        // Get provider info
        const { data: provider } = await supabase
          .from('providers')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!provider) return true; // User is not a provider

        // Check if provider can interact with this specific client
        const { data: canInteract } = await supabase
          .rpc('can_provider_interact_with_client', {
            provider_id: provider.id,
            client_id: clientId
          });

        return canInteract;
      } catch (error) {
        console.error('Error checking provider-client interaction:', error);
        return true; // Default to allowing access on error
      }
    },
    enabled: !!clientId && !!user?.id,
  });

  return { canInteract: canInteract ?? true, isLoading };
};

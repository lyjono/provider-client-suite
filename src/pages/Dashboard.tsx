
import { useAuth } from '@/hooks/useAuth';
import { AuthGuard } from '@/components/AuthGuard';
import { ProviderOnboarding } from '@/components/ProviderOnboarding';
import { ClientOnboarding } from '@/components/ClientOnboarding';
import { ProviderDashboard } from '@/components/ProviderDashboard';
import { ClientDashboard } from '@/components/ClientDashboard';
import { ProviderPresentation } from '@/components/ProviderPresentation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const Dashboard = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [showProviderPresentation, setShowProviderPresentation] = useState(false);
  const providerSlug = searchParams.get('provider');

  // Only check if user is a provider if they didn't come through a provider link
  const { data: provider, isLoading: providerLoading } = useQuery({
    queryKey: ['provider', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('providers')
        .select('*')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id && !providerSlug, // Don't check if user came through provider link
  });

  // Check if user is a client (always check this)
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['client', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('clients')
        .select('*, providers!inner(*)')
        .eq('user_id', user.id);
      return data || [];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    // If user came via provider link, show provider presentation first
    if (providerSlug && !client?.length && !providerLoading && !clientLoading) {
      setShowProviderPresentation(true);
    }
  }, [providerSlug, client, providerLoading, clientLoading]);

  if (providerLoading || clientLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Show provider presentation to potential clients */}
        {showProviderPresentation && providerSlug && (
          <ProviderPresentation 
            providerSlug={providerSlug} 
            onStartOnboarding={() => setShowProviderPresentation(false)}
          />
        )}
        
        {/* Client onboarding flow - for users coming via provider link */}
        {!showProviderPresentation && providerSlug && (!client || client.length === 0) && (
          <ClientOnboarding providerSlug={providerSlug} />
        )}
        
        {/* Provider onboarding flow - for users without provider slug who are not clients */}
        {!providerSlug && !provider && (!client || client.length === 0) && (
          <ProviderOnboarding />
        )}
        
        {/* Provider dashboard - only for users who are providers and didn't come through provider link */}
        {!providerSlug && provider && <ProviderDashboard provider={provider} />}
        
        {/* Client dashboard - handles multiple providers */}
        {client && client.length > 0 && <ClientDashboard clients={client} />}
      </div>
    </AuthGuard>
  );
};

export default Dashboard;

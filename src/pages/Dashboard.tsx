
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

  // Check if user is a provider
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
    enabled: !!user?.id,
  });

  // Check if user is a client
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
    if (providerSlug && !provider && (!client || client.length === 0) && !providerLoading && !clientLoading) {
      setShowProviderPresentation(true);
    }
  }, [providerSlug, provider, client, providerLoading, clientLoading]);

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
        {!showProviderPresentation && providerSlug && !provider && (!client || client.length === 0) && (
          <ClientOnboarding providerSlug={providerSlug} />
        )}
        
        {/* Provider onboarding flow - for users without provider slug */}
        {!providerSlug && !provider && (!client || client.length === 0) && (
          <ProviderOnboarding />
        )}
        
        {/* Provider dashboard */}
        {provider && <ProviderDashboard provider={provider} />}
        
        {/* Client dashboard - handles multiple providers */}
        {client && client.length > 0 && <ClientDashboard clients={client} />}
      </div>
    </AuthGuard>
  );
};

export default Dashboard;

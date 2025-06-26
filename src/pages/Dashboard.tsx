
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
  const [userType, setUserType] = useState<'provider' | 'client' | null>(null);
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
    if (provider) {
      setUserType('provider');
    } else if (client && client.length > 0) {
      setUserType('client');
    } else if (!providerLoading && !clientLoading && !provider && (!client || client.length === 0)) {
      // User needs onboarding
      if (providerSlug) {
        setShowProviderPresentation(true);
        setUserType('client');
      } else {
        setUserType(null); // Will show provider onboarding
      }
    }
  }, [provider, client, providerLoading, clientLoading, providerSlug]);

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
        
        {/* Client onboarding flow */}
        {!showProviderPresentation && !provider && (!client || client.length === 0) && providerSlug && (
          <ClientOnboarding providerSlug={providerSlug} />
        )}
        
        {/* Provider onboarding flow */}
        {!provider && (!client || client.length === 0) && !providerSlug && (
          <ProviderOnboarding />
        )}
        
        {/* Provider dashboard */}
        {provider && <ProviderDashboard provider={provider} />}
        
        {/* Client dashboard - now handles multiple providers */}
        {client && client.length > 0 && <ClientDashboard clients={client} />}
      </div>
    </AuthGuard>
  );
};

export default Dashboard;

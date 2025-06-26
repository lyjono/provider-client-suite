
import { useAuth } from '@/hooks/useAuth';
import { AuthGuard } from '@/components/AuthGuard';
import { ProviderOnboarding } from '@/components/ProviderOnboarding';
import { ClientOnboarding } from '@/components/ClientOnboarding';
import { ProviderDashboard } from '@/components/ProviderDashboard';
import { ClientDashboard } from '@/components/ClientDashboard';
import { ProviderPresentation } from '@/components/ProviderPresentation';
import { DemoClientOnboarding } from '@/components/DemoClientOnboarding';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const Dashboard = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [showProviderPresentation, setShowProviderPresentation] = useState(false);
  const providerSlug = searchParams.get('provider');
  const isDemoClient = searchParams.get('demo-client') === 'true';

  console.log('Dashboard - user:', user?.id);
  console.log('Dashboard - providerSlug:', providerSlug);
  console.log('Dashboard - isDemoClient:', isDemoClient);

  // Check if user is a client
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['client', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('clients')
        .select('*, providers!inner(*)')
        .eq('user_id', user.id);
      console.log('Client query result:', data);
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Only check if user is a provider if they don't have client records
  const { data: provider, isLoading: providerLoading } = useQuery({
    queryKey: ['provider', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('providers')
        .select('*')
        .eq('user_id', user.id)
        .single();
      console.log('Provider query result:', data);
      return data;
    },
    enabled: !!user?.id && (!client || client.length === 0),
  });

  useEffect(() => {
    // If user came via provider link and is not a client, show provider presentation first
    if (providerSlug && (!client || client.length === 0) && !isDemoClient) {
      setShowProviderPresentation(true);
    }
  }, [providerSlug, client, isDemoClient]);

  if (clientLoading || ((!client || client.length === 0) && providerLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  console.log('Dashboard - Final state:');
  console.log('  client:', client);
  console.log('  client.length:', client?.length);
  console.log('  provider:', provider);
  console.log('  showProviderPresentation:', showProviderPresentation);

  // PRIORITY 1: If user has client records, ALWAYS show client dashboard
  if (client && client.length > 0) {
    console.log('Rendering ClientDashboard');
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50">
          <ClientDashboard clients={client} />
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Demo client onboarding flow - simple registration without provider */}
        {isDemoClient && (
          <DemoClientOnboarding />
        )}
        
        {/* Show provider presentation to potential clients */}
        {!isDemoClient && showProviderPresentation && providerSlug && (
          <ProviderPresentation 
            providerSlug={providerSlug} 
            onStartOnboarding={() => setShowProviderPresentation(false)}
          />
        )}
        
        {/* Client onboarding flow - for users coming via provider link */}
        {!isDemoClient && !showProviderPresentation && providerSlug && (
          <ClientOnboarding providerSlug={providerSlug} />
        )}
        
        {/* Provider onboarding flow - for users without provider slug who are not clients */}
        {!isDemoClient && !providerSlug && !provider && (
          <ProviderOnboarding />
        )}
        
        {/* Provider dashboard - only for users who are providers and didn't come through provider link */}
        {!isDemoClient && !providerSlug && provider && <ProviderDashboard provider={provider} />}
      </div>
    </AuthGuard>
  );
};

export default Dashboard;

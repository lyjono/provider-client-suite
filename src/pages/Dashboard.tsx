
import { useAuth } from '@/hooks/useAuth';
import { AuthGuard } from '@/components/AuthGuard';
import { ProviderOnboarding } from '@/components/ProviderOnboarding';
import { ClientOnboarding } from '@/components/ClientOnboarding';
import { ProviderDashboard } from '@/components/ProviderDashboard';
import { ClientDashboard } from '@/components/ClientDashboard';
import { ProviderLandingPage } from '@/components/ProviderLandingPage';
import { DemoClientOnboarding } from '@/components/DemoClientOnboarding';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const Dashboard = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [showLandingPage, setShowLandingPage] = useState(false);
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
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id);
      
      console.log('Client query result:', clientData);
      
      if (!clientData || clientData.length === 0) {
        return [];
      }
      
      const clientsWithProviders = await Promise.all(
        clientData.map(async (client) => {
          if (client.provider_id) {
            const { data: providerData } = await supabase
              .from('providers')
              .select('*')
              .eq('id', client.provider_id)
              .single();
            return { ...client, providers: providerData };
          }
          return { ...client, providers: null };
        })
      );
      
      return clientsWithProviders;
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

  // Check if current user is already connected to the provider from the slug
  const { data: existingConnection } = useQuery({
    queryKey: ['existing-provider-connection', user?.id, providerSlug],
    queryFn: async () => {
      if (!user?.id || !providerSlug) return null;
      
      // Get provider by slug
      const { data: providerData } = await supabase
        .from('providers')
        .select('id')
        .eq('provider_slug', providerSlug)
        .single();
      
      if (!providerData) return null;
      
      // Check if user is already connected to this provider
      const { data: clientData } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider_id', providerData.id)
        .single();
      
      return clientData;
    },
    enabled: !!user?.id && !!providerSlug,
  });

  useEffect(() => {
    // Show landing page for provider links, but handle different scenarios
    if (providerSlug && !isDemoClient) {
      // If user is authenticated and already connected, don't show landing page
      if (user && existingConnection) {
        setShowLandingPage(false);
      } else {
        // Show landing page for new visitors or unconnected users
        setShowLandingPage(true);
      }
    }
  }, [providerSlug, isDemoClient, user, existingConnection]);

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
  console.log('  showLandingPage:', showLandingPage);
  console.log('  existingConnection:', existingConnection);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Demo client onboarding flow */}
        {isDemoClient && (
          <DemoClientOnboarding />
        )}
        
        {/* Show landing page for provider links (unless user is already connected) */}
        {!isDemoClient && showLandingPage && providerSlug && (
          <ProviderLandingPage 
            providerSlug={providerSlug}
          />
        )}
        
        {/* Client onboarding flow - for authenticated users who want to connect to a provider */}
        {!isDemoClient && !showLandingPage && providerSlug && user && !existingConnection && (
          <ClientOnboarding providerSlug={providerSlug} />
        )}
        
        {/* If user has client records and no provider link, show client dashboard */}
        {!isDemoClient && !providerSlug && client && client.length > 0 && (
          <ClientDashboard clients={client} />
        )}
        
        {/* If user is connected to the provider, show client dashboard */}
        {!isDemoClient && providerSlug && user && existingConnection && (
          <ClientDashboard clients={client || []} />
        )}
        
        {/* Provider onboarding flow - for users without provider slug who are not clients */}
        {!isDemoClient && !providerSlug && !provider && (!client || client.length === 0) && (
          <ProviderOnboarding />
        )}
        
        {/* Provider dashboard - only for users who are providers and didn't come through provider link */}
        {!isDemoClient && !providerSlug && provider && <ProviderDashboard provider={provider} />}
      </div>
    </AuthGuard>
  );
};

export default Dashboard;

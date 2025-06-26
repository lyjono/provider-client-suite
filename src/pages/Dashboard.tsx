
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
      try {
        const { data: clientData, error } = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', user.id);
        
        if (error) {
          console.error('Client query error:', error);
          return [];
        }
        
        console.log('Client query result:', clientData);
        
        if (!clientData || clientData.length === 0) {
          return [];
        }
        
        const clientsWithProviders = await Promise.all(
          clientData.map(async (client) => {
            if (client.provider_id) {
              try {
                const { data: providerData } = await supabase
                  .from('providers')
                  .select('*')
                  .eq('id', client.provider_id)
                  .single();
                return { ...client, providers: providerData };
              } catch (error) {
                console.warn('Provider lookup for client failed:', error);
                return { ...client, providers: null };
              }
            }
            return { ...client, providers: null };
          })
        );
        
        return clientsWithProviders;
      } catch (error) {
        console.error('Client query failed:', error);
        return [];
      }
    },
    enabled: !!user?.id,
  });

  // Only check if user is a provider if they don't have client records
  const { data: provider, isLoading: providerLoading } = useQuery({
    queryKey: ['provider', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      try {
        const { data, error } = await supabase
          .from('providers')
          .select('*')
          .eq('user_id', user.id);
        
        if (error) {
          console.error('Provider query error:', error);
          return null;
        }
        
        console.log('Provider query result:', data);
        return data && data.length > 0 ? data[0] : null;
      } catch (error) {
        console.error('Provider query failed:', error);
        return null;
      }
    },
    enabled: !!user?.id && (!client || client.length === 0),
  });

  // Check if current user is already connected to the provider from the slug
  const { data: existingConnection } = useQuery({
    queryKey: ['existing-provider-connection', user?.id, providerSlug],
    queryFn: async () => {
      if (!user?.id || !providerSlug) return null;
      
      try {
        // Get provider by slug - simplified query
        const { data: providerData, error: providerError } = await supabase
          .from('providers')
          .select('id, provider_slug')
          .eq('provider_slug', providerSlug);
        
        if (providerError) {
          console.error('Provider lookup error:', providerError);
          return null;
        }
        
        console.log('Provider data for slug:', providerData);
        
        if (!providerData || providerData.length === 0) return null;
        
        const provider = providerData[0];
        
        // Check if user is already connected to this provider
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', user.id)
          .eq('provider_id', provider.id);
        
        if (clientError) {
          console.error('Existing connection error:', clientError);
          return null;
        }
        
        console.log('Existing connection check:', clientData);
        return clientData && clientData.length > 0 ? clientData[0] : null;
      } catch (error) {
        console.error('Connection check failed:', error);
        return null;
      }
    },
    enabled: !!user?.id && !!providerSlug,
  });

  useEffect(() => {
    // Show landing page logic
    if (providerSlug && !isDemoClient) {
      if (!user) {
        // Not logged in - show landing page
        setShowLandingPage(true);
      } else if (existingConnection) {
        // User is logged in and already connected - don't show landing page
        setShowLandingPage(false);
      } else if (client && client.length > 0) {
        // User has client records but not connected to this specific provider
        // Check if any of their client records are for this provider
        const isConnectedToThisProvider = client.some(c => 
          c.providers?.provider_slug === providerSlug
        );
        setShowLandingPage(!isConnectedToThisProvider);
      } else {
        // User is logged in but has no client records - show landing page
        setShowLandingPage(true);
      }
    } else {
      setShowLandingPage(false);
    }
  }, [providerSlug, isDemoClient, user, existingConnection, client]);

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
        
        {/* Show landing page for provider links - only for non-authenticated users or users not connected to this provider */}
        {!isDemoClient && showLandingPage && providerSlug && (
          <ProviderLandingPage 
            providerSlug={providerSlug}
          />
        )}
        
        {/* Client onboarding flow - for authenticated users who want to connect to a provider but aren't connected yet */}
        {!isDemoClient && !showLandingPage && providerSlug && user && !existingConnection && (
          <ClientOnboarding providerSlug={providerSlug} />
        )}
        
        {/* If user has client records and no provider link, show client dashboard */}
        {!isDemoClient && !providerSlug && client && client.length > 0 && (
          <ClientDashboard clients={client} />
        )}
        
        {/* If user is connected to the provider, show client dashboard */}
        {!isDemoClient && !showLandingPage && (providerSlug && user && (existingConnection || (client && client.some(c => c.providers?.provider_slug === providerSlug)))) && (
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


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

  // First, get all client records for this user (regardless of provider connections)
  const { data: allClientRecords, isLoading: clientLoading } = useQuery({
    queryKey: ['all-clients', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const { data: clientData, error } = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', user.id);
        
        if (error) {
          console.error('All clients query error:', error);
          return [];
        }
        
        console.log('All client records:', clientData);
        return clientData || [];
      } catch (error) {
        console.error('All clients query failed:', error);
        return [];
      }
    },
    enabled: !!user?.id,
  });

  // Get client records with provider info for dashboard display
  const { data: clientsWithProviders } = useQuery({
    queryKey: ['clients-with-providers', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const { data: clientData, error } = await supabase
          .from('clients')
          .select(`
            *,
            providers!inner(
              id,
              first_name,
              last_name,
              company_name,
              provider_slug,
              email,
              bio,
              profile_image_url,
              tagline,
              expertise_areas(name)
            )
          `)
          .eq('user_id', user.id);
        
        if (error) {
          console.error('Clients with providers query error:', error);
          return [];
        }
        
        console.log('Clients with providers:', clientData);
        return clientData || [];
      } catch (error) {
        console.error('Clients with providers query failed:', error);
        return [];
      }
    },
    enabled: !!user?.id,
  });

  // Only check if user is a provider if they don't have any client records
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
    enabled: !!user?.id && (!allClientRecords || allClientRecords.length === 0),
  });

  // Check if current user is already connected to the current provider
  const isConnectedToCurrentProvider = () => {
    if (!providerSlug || !clientsWithProviders || clientsWithProviders.length === 0) return false;
    return clientsWithProviders.some(c => c.providers?.provider_slug === providerSlug);
  };

  useEffect(() => {
    // Show landing page logic - only for non-authenticated users
    if (providerSlug && !isDemoClient) {
      if (!user) {
        // Not logged in - show landing page
        setShowLandingPage(true);
      } else {
        // User is logged in - don't show landing page, proceed with connection flow
        setShowLandingPage(false);
      }
    } else {
      setShowLandingPage(false);
    }
  }, [providerSlug, isDemoClient, user]);

  if (clientLoading || ((!allClientRecords || allClientRecords.length === 0) && providerLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const connectedToCurrentProvider = isConnectedToCurrentProvider();
  const hasAnyClientRecords = allClientRecords && allClientRecords.length > 0;

  console.log('Dashboard - Final state:');
  console.log('  allClientRecords:', allClientRecords);
  console.log('  clientsWithProviders:', clientsWithProviders);
  console.log('  provider:', provider);
  console.log('  showLandingPage:', showLandingPage);
  console.log('  isConnectedToCurrentProvider:', connectedToCurrentProvider);
  console.log('  hasAnyClientRecords:', hasAnyClientRecords);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Demo client onboarding flow */}
        {isDemoClient && (
          <DemoClientOnboarding />
        )}
        
        {/* Show landing page for provider links - only for non-authenticated users */}
        {!isDemoClient && showLandingPage && providerSlug && !user && (
          <ProviderLandingPage 
            providerSlug={providerSlug}
          />
        )}
        
        {/* Client onboarding flow - for authenticated users who want to connect to a provider they're not already connected to */}
        {!isDemoClient && providerSlug && user && !connectedToCurrentProvider && (
          <ClientOnboarding providerSlug={providerSlug} />
        )}
        
        {/* If user has client records and no provider link, show client dashboard */}
        {!isDemoClient && !providerSlug && hasAnyClientRecords && !provider && (
          <ClientDashboard 
            clients={clientsWithProviders || []} 
            allClients={allClientRecords || []}
          />
        )}
        
        {/* If user is connected to the provider, show client dashboard */}
        {!isDemoClient && providerSlug && user && connectedToCurrentProvider && (
          <ClientDashboard 
            clients={clientsWithProviders || []} 
            allClients={allClientRecords || []}
          />
        )}
        
        {/* Provider onboarding flow - for users without provider slug who are not clients */}
        {!isDemoClient && !providerSlug && !provider && !hasAnyClientRecords && (
          <ProviderOnboarding />
        )}
        
        {/* Provider dashboard - only for users who are providers and didn't come through provider link */}
        {!isDemoClient && !providerSlug && provider && <ProviderDashboard provider={provider} />}
      </div>
    </AuthGuard>
  );
};

export default Dashboard;

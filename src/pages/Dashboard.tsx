
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

  // Only fetch data if user is authenticated
  const shouldFetchData = !!user?.id;

  // Get all client records for this user
  const { data: allClientRecords = [], isLoading: clientLoading, error: clientError } = useQuery({
    queryKey: ['all-clients', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      console.log('Fetching all clients for user:', user.id);
      
      const { data: clientData, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('All clients query error:', error);
        throw error;
      }
      
      console.log('All client records found:', clientData?.length || 0);
      return clientData || [];
    },
    enabled: shouldFetchData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Get client records with provider info
  const { data: clientsWithProviders = [], isLoading: clientsWithProvidersLoading } = useQuery({
    queryKey: ['clients-with-providers', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      console.log('Fetching clients with providers for user:', user.id);
      
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
        throw error;
      }
      
      console.log('Clients with providers found:', clientData?.length || 0);
      return clientData || [];
    },
    enabled: shouldFetchData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Check if user is a provider - only when they don't have client records
  const hasAnyClientRecords = allClientRecords.length > 0;
  const shouldFetchProvider = shouldFetchData && !clientLoading && !hasAnyClientRecords;

  const { data: provider, isLoading: providerLoading } = useQuery({
    queryKey: ['provider', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      console.log('Checking if user is a provider:', user.id);
      
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Provider query error:', error);
        throw error;
      }
      
      console.log('Provider found:', !!data);
      return data;
    },
    enabled: shouldFetchProvider,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Check if current user is already connected to the current provider
  const isConnectedToCurrentProvider = () => {
    if (!providerSlug || !clientsWithProviders || clientsWithProviders.length === 0) return false;
    return clientsWithProviders.some(c => c.providers?.provider_slug === providerSlug);
  };

  useEffect(() => {
    // Show landing page logic - only for non-authenticated users
    if (providerSlug && !isDemoClient && !user) {
      setShowLandingPage(true);
    } else {
      setShowLandingPage(false);
    }
  }, [providerSlug, isDemoClient, user]);

  // Show loading only when we're actually loading and have a user
  const isLoading = user && (clientLoading || clientsWithProvidersLoading || (shouldFetchProvider && providerLoading));

  if (isLoading) {
    console.log('Dashboard - Loading...');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Handle errors
  if (clientError) {
    console.error('Dashboard - Client error:', clientError);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Dashboard</h1>
          <p className="text-gray-600">Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  const connectedToCurrentProvider = isConnectedToCurrentProvider();

  console.log('Dashboard - Final state:');
  console.log('  allClientRecords:', allClientRecords.length);
  console.log('  clientsWithProviders:', clientsWithProviders.length);
  console.log('  provider:', !!provider);
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
            clients={clientsWithProviders} 
            allClients={allClientRecords}
          />
        )}
        
        {/* If user is connected to the provider, show client dashboard */}
        {!isDemoClient && providerSlug && user && connectedToCurrentProvider && (
          <ClientDashboard 
            clients={clientsWithProviders} 
            allClients={allClientRecords}
          />
        )}
        
        {/* Provider onboarding flow - for users without provider slug who are not clients */}
        {!isDemoClient && !providerSlug && !provider && !hasAnyClientRecords && user && (
          <ProviderOnboarding />
        )}
        
        {/* Provider dashboard - only for users who are providers and didn't come through provider link */}
        {!isDemoClient && !providerSlug && provider && user && (
          <ProviderDashboard provider={provider} />
        )}
      </div>
    </AuthGuard>
  );
};

export default Dashboard;


import { useAuth } from '@/hooks/useAuth';
import { AuthGuard } from '@/components/AuthGuard';
import { ProviderOnboarding } from '@/components/ProviderOnboarding';
import { ClientOnboarding } from '@/components/ClientOnboarding';
import { ProviderDashboard } from '@/components/ProviderDashboard';
import { ClientDashboard } from '@/components/ClientDashboard';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const Dashboard = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [userType, setUserType] = useState<'provider' | 'client' | null>(null);
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
        .eq('user_id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (provider) {
      setUserType('provider');
    } else if (client) {
      setUserType('client');
    } else if (!providerLoading && !clientLoading && !provider && !client) {
      // User needs onboarding
      setUserType(providerSlug ? 'client' : null);
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
        {!provider && !client && providerSlug && <ClientOnboarding providerSlug={providerSlug} />}
        {!provider && !client && !providerSlug && <ProviderOnboarding />}
        {provider && <ProviderDashboard provider={provider} />}
        {client && <ClientDashboard client={client} />}
      </div>
    </AuthGuard>
  );
};

export default Dashboard;

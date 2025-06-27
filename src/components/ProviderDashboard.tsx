import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Settings, LogOut, Link, User, MessageCircle, Calendar, FileText, Crown } from 'lucide-react';
import { ClientsManagement } from '@/components/ClientsManagement';
import { ProviderSettings } from '@/components/ProviderSettings';
import { ProviderClientDetails } from '@/components/ProviderClientDetails';
import { SubscriptionUpgrade } from '@/components/SubscriptionUpgrade';
import { BlurredContent } from '@/components/BlurredContent';
import { useProviderClientInteraction } from '@/hooks/useSubscriptionLimits';
import { toast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ProviderDashboardProps {
  provider: any;
}

export const ProviderDashboard = ({ provider }: ProviderDashboardProps) => {
  const { signOut } = useAuth();
  const [currentView, setCurrentView] = useState<'clients' | 'settings' | 'subscription'>('clients');
  const [selectedClient, setSelectedClient] = useState<any>(null);

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ['clients', provider.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select(`
          *,
          cities(name),
          countries(name)
        `)
        .eq('provider_id', provider.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const copyProviderLink = () => {
    const link = `${window.location.origin}/dashboard?provider=${provider.provider_slug}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copied!",
      description: "Share this link with potential clients so they can connect with you",
    });
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'free': return 'bg-gray-500';
      case 'starter': return 'bg-blue-500';
      case 'pro': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'contacted': return 'bg-blue-500';
      case 'qualified': return 'bg-yellow-500';
      case 'converted': return 'bg-green-500';
      case 'archived': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  const handleUpgrade = (tier: 'starter' | 'pro') => {
    // This would integrate with your payment system (Stripe, etc.)
    toast({
      title: "Upgrade Plan",
      description: `Upgrading to ${tier} plan - this would integrate with your payment system`,
    });
  };

  if (selectedClient) {
    return (
      <ProviderClientDetails 
        client={selectedClient} 
        provider={provider}
        onBack={() => setSelectedClient(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {provider.company_name || `${provider.first_name} ${provider.last_name}`}
              </h1>
              <div className="flex items-center space-x-2 mt-1">
                <Badge className={getTierBadgeColor(provider.subscription_tier)}>
                  {provider.subscription_tier?.toUpperCase()} Plan
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyProviderLink}
                  className="flex items-center space-x-1"
                >
                  <Link className="h-4 w-4" />
                  <span>Copy Client Link</span>
                </Button>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant={currentView === 'clients' ? 'default' : 'outline'} 
                onClick={() => setCurrentView('clients')}
              >
                <Users className="h-4 w-4 mr-2" />
                Clients
              </Button>
              <Button 
                variant={currentView === 'subscription' ? 'default' : 'outline'} 
                onClick={() => setCurrentView('subscription')}
                className={provider.subscription_tier === 'free' ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white' : ''}
              >
                <Crown className="h-4 w-4 mr-2" />
                {provider.subscription_tier === 'free' ? 'Upgrade' : 'Subscription'}
              </Button>
              <Button 
                variant={currentView === 'settings' ? 'default' : 'outline'} 
                onClick={() => setCurrentView('settings')}
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button variant="outline" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'settings' ? (
          <ProviderSettings provider={provider} />
        ) : currentView === 'subscription' ? (
          <SubscriptionUpgrade 
            currentTier={provider.subscription_tier || 'free'} 
            onUpgrade={handleUpgrade}
          />
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Your Clients</h2>
              <div className="text-sm text-gray-600">
                {clients?.length || 0} total clients
              </div>
            </div>

            {!clients || clients.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No clients yet</h3>
                  <p className="text-gray-600 mb-4">
                    Share your client registration link to start getting clients
                  </p>
                  <Button onClick={copyProviderLink}>
                    <Link className="h-4 w-4 mr-2" />
                    Copy Client Link
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clients.map((client) => {
                  const initials = `${client.first_name[0]}${client.last_name[0]}`.toUpperCase();
                  
                  return (
                    <ClientCard 
                      key={client.id}
                      client={client}
                      initials={initials}
                      provider={provider}
                      onSelectClient={setSelectedClient}
                      getStatusColor={getStatusColor}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ClientCard = ({ client, initials, provider, onSelectClient, getStatusColor }: any) => {
  const { canInteract } = useProviderClientInteraction(client.id);

  return (
    <BlurredContent
      isBlurred={!canInteract}
      title="Client Limit Reached"
      description="You've reached your subscription limit. Upgrade to interact with more clients."
    >
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={client.profile_image_url} />
                <AvatarFallback className="bg-blue-600 text-white text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">
                  {client.first_name} {client.last_name}
                </CardTitle>
                <p className="text-sm text-gray-600">{client.email}</p>
              </div>
            </div>
            <Badge className={getStatusColor(client.lead_status)}>
              {client.lead_status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {client.phone && (
            <p className="text-sm text-gray-600">{client.phone}</p>
          )}
          {client.cities?.name && (
            <p className="text-sm text-gray-600">
              {client.cities.name}, {client.countries?.name}
            </p>
          )}
          {client.notes && (
            <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
              {client.notes.substring(0, 80)}
              {client.notes.length > 80 && '...'}
            </p>
          )}
          <div className={`flex space-x-2 pt-2 ${!canInteract ? 'opacity-50 pointer-events-none' : ''}`}>
            <Button 
              size="sm" 
              onClick={() => onSelectClient(client)}
              className="flex-1"
              disabled={!canInteract}
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              View Details
            </Button>
          </div>
        </CardContent>
      </Card>
    </BlurredContent>
  );
};

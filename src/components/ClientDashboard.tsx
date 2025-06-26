
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Settings, LogOut, Users, UserPlus, MessageCircle, Calendar, FileText } from 'lucide-react';
import { ClientSettings } from '@/components/ClientSettings';
import { ClientProviderDetails } from '@/components/ClientProviderDetails';

interface ClientDashboardProps {
  clients: any[];
}

export const ClientDashboard = ({ clients }: ClientDashboardProps) => {
  const { signOut } = useAuth();
  const [currentView, setCurrentView] = useState<'providers' | 'settings'>('providers');
  const [selectedProvider, setSelectedProvider] = useState<any>(null);

  // Get the first client for user info
  const userClient = clients[0];
  const userName = `${userClient.first_name} ${userClient.last_name}`;

  // Filter clients that have providers
  const clientsWithProviders = clients.filter(client => client.providers);

  if (selectedProvider) {
    const clientRecord = clientsWithProviders.find(c => c.providers.id === selectedProvider.id);
    return (
      <ClientProviderDetails 
        provider={selectedProvider}
        client={clientRecord}
        onBack={() => setSelectedProvider(null)}
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
                Welcome, {userName}
              </h1>
              <p className="text-gray-600">
                {clientsWithProviders.length > 0 
                  ? `Connected to ${clientsWithProviders.length} provider${clientsWithProviders.length !== 1 ? 's' : ''}`
                  : 'No provider connections yet'
                }
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant={currentView === 'providers' ? 'default' : 'outline'} 
                onClick={() => setCurrentView('providers')}
              >
                <Users className="h-4 w-4 mr-2" />
                Providers
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
          <ClientSettings client={userClient} />
        ) : (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Your Providers</h2>
            
            {clientsWithProviders.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <UserPlus className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No Provider Connections
                  </h3>
                  <p className="text-gray-600 mb-4">
                    You haven't connected with any providers yet. You can connect with providers by using their invitation links.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clientsWithProviders.map((client) => {
                  const provider = client.providers;
                  const initials = `${provider.first_name[0]}${provider.last_name[0]}`.toUpperCase();
                  
                  return (
                    <Card key={client.id} className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardHeader className="pb-3">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={provider.profile_image_url} />
                            <AvatarFallback className="bg-blue-600 text-white">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-lg">
                              {provider.first_name} {provider.last_name}
                            </CardTitle>
                            {provider.company_name && (
                              <p className="text-sm text-gray-600">{provider.company_name}</p>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {provider.tagline && (
                          <p className="text-sm text-gray-600">{provider.tagline}</p>
                        )}
                        {provider.expertise_areas && (
                          <Badge variant="secondary">{provider.expertise_areas.name}</Badge>
                        )}
                        <div className="flex space-x-2 pt-2">
                          <Button 
                            size="sm" 
                            onClick={() => setSelectedProvider(provider)}
                            className="flex-1"
                          >
                            <MessageCircle className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
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

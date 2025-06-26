
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Calendar, MessageCircle, FileText, Settings, LogOut, Users } from 'lucide-react';
import { AppointmentBooking } from '@/components/AppointmentBooking';
import { ChatInterface } from '@/components/ChatInterface';
import { DocumentsManagement } from '@/components/DocumentsManagement';
import { ClientSettings } from '@/components/ClientSettings';

interface ClientDashboardProps {
  clients: any[];
}

export const ClientDashboard = ({ clients }: ClientDashboardProps) => {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedProvider, setSelectedProvider] = useState<any>(null);

  // Get the first client for user info
  const userClient = clients[0];
  const userName = `${userClient.first_name} ${userClient.last_name}`;

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
                Managing {clients.length} provider relationship{clients.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={() => setActiveTab('settings')}>
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
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="appointments" className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Appointments</span>
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center space-x-2">
              <MessageCircle className="h-4 w-4" />
              <span>Messages</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Documents</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Your Providers</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clients.map((client) => {
                  const provider = client.providers;
                  const initials = `${provider.first_name[0]}${provider.last_name[0]}`.toUpperCase();
                  
                  return (
                    <Card key={client.id} className="hover:shadow-md transition-shadow">
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
                        {provider.expertise_areas && (
                          <Badge variant="secondary">{provider.expertise_areas.name}</Badge>
                        )}
                        <div className="flex space-x-2">
                          <Button 
                            size="sm" 
                            onClick={() => {
                              setSelectedProvider(provider);
                              setActiveTab('appointments');
                            }}
                          >
                            <Calendar className="h-4 w-4 mr-1" />
                            Book
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedProvider(provider);
                              setActiveTab('messages');
                            }}
                          >
                            <MessageCircle className="h-4 w-4 mr-1" />
                            Chat
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedProvider(provider);
                              setActiveTab('documents');
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Files
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="appointments">
            {selectedProvider ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">
                    Appointments with {selectedProvider.first_name} {selectedProvider.last_name}
                  </h2>
                  <Button variant="outline" onClick={() => setSelectedProvider(null)}>
                    View All Providers
                  </Button>
                </div>
                <AppointmentBooking 
                  clientId={clients.find(c => c.provider_id === selectedProvider.id)?.id} 
                  providerId={selectedProvider.id} 
                />
              </div>
            ) : (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">All Appointments</h2>
                {clients.map((client) => (
                  <div key={client.id} className="space-y-4">
                    <h3 className="text-lg font-semibold">
                      {client.providers.first_name} {client.providers.last_name}
                    </h3>
                    <AppointmentBooking clientId={client.id} providerId={client.provider_id} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="messages">
            {selectedProvider ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">
                    Messages with {selectedProvider.first_name} {selectedProvider.last_name}
                  </h2>
                  <Button variant="outline" onClick={() => setSelectedProvider(null)}>
                    View All Conversations
                  </Button>
                </div>
                <ChatInterface 
                  userType="client" 
                  userId={clients.find(c => c.provider_id === selectedProvider.id)?.id} 
                />
              </div>
            ) : (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">All Conversations</h2>
                {clients.map((client) => (
                  <div key={client.id} className="space-y-4">
                    <h3 className="text-lg font-semibold">
                      {client.providers.first_name} {client.providers.last_name}
                    </h3>
                    <ChatInterface userType="client" userId={client.id} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="documents">
            {selectedProvider ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">
                    Documents with {selectedProvider.first_name} {selectedProvider.last_name}
                  </h2>
                  <Button variant="outline" onClick={() => setSelectedProvider(null)}>
                    View All Documents
                  </Button>
                </div>
                <DocumentsManagement 
                  userType="client" 
                  userId={clients.find(c => c.provider_id === selectedProvider.id)?.id} 
                />
              </div>
            ) : (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">All Documents</h2>
                {clients.map((client) => (
                  <div key={client.id} className="space-y-4">
                    <h3 className="text-lg font-semibold">
                      {client.providers.first_name} {client.providers.last_name}
                    </h3>
                    <DocumentsManagement userType="client" userId={client.id} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings">
            <ClientSettings client={userClient} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

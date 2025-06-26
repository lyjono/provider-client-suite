
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Users, Calendar, MessageCircle, FileText, Settings, LogOut, Link } from 'lucide-react';
import { ClientsManagement } from '@/components/ClientsManagement';
import { AppointmentsManagement } from '@/components/AppointmentsManagement';
import { ChatInterface } from '@/components/ChatInterface';
import { DocumentsManagement } from '@/components/DocumentsManagement';
import { ProviderSettings } from '@/components/ProviderSettings';
import { toast } from '@/hooks/use-toast';

interface ProviderDashboardProps {
  provider: any;
}

export const ProviderDashboard = ({ provider }: ProviderDashboardProps) => {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('clients');

  const copyProviderLink = () => {
    // Use the provider_slug to create the link
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
            <TabsTrigger value="clients" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Clients</span>
            </TabsTrigger>
            <TabsTrigger value="appointments" className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Appointments</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center space-x-2">
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

          <TabsContent value="clients">
            <ClientsManagement providerId={provider.id} />
          </TabsContent>

          <TabsContent value="appointments">
            <AppointmentsManagement providerId={provider.id} />
          </TabsContent>

          <TabsContent value="chat">
            <ChatInterface userType="provider" userId={provider.id} />
          </TabsContent>

          <TabsContent value="documents">
            <DocumentsManagement userType="provider" userId={provider.id} />
          </TabsContent>

          <TabsContent value="settings">
            <ProviderSettings provider={provider} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

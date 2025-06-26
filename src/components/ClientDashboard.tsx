
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, MessageCircle, FileText, Settings, LogOut } from 'lucide-react';
import { AppointmentBooking } from '@/components/AppointmentBooking';
import { ChatInterface } from '@/components/ChatInterface';
import { DocumentsManagement } from '@/components/DocumentsManagement';
import { ClientSettings } from '@/components/ClientSettings';

interface ClientDashboardProps {
  client: any;
}

export const ClientDashboard = ({ client }: ClientDashboardProps) => {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('appointments');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome, {client.first_name} {client.last_name}
              </h1>
              <p className="text-gray-600">
                Connected with {client.providers.company_name || `${client.providers.first_name} ${client.providers.last_name}`}
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

          <TabsContent value="appointments">
            <AppointmentBooking clientId={client.id} providerId={client.provider_id} />
          </TabsContent>

          <TabsContent value="chat">
            <ChatInterface userType="client" userId={client.id} />
          </TabsContent>

          <TabsContent value="documents">
            <DocumentsManagement userType="client" userId={client.id} />
          </TabsContent>

          <TabsContent value="settings">
            <ClientSettings client={client} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

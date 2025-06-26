
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, MessageCircle, FileText, User } from 'lucide-react';
import { AppointmentsManagement } from '@/components/AppointmentsManagement';
import { ChatInterface } from '@/components/ChatInterface';
import { DocumentsManagement } from '@/components/DocumentsManagement';
import { ClientEditForm } from '@/components/ClientEditForm';

interface ProviderClientDetailsProps {
  client: any;
  provider: any;
  onBack: () => void;
}

export const ProviderClientDetails = ({ client, provider, onBack }: ProviderClientDetailsProps) => {
  const [activeTab, setActiveTab] = useState('overview');
  const initials = `${client.first_name[0]}${client.last_name[0]}`.toUpperCase();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'contacted': return 'bg-blue-500';
      case 'qualified': return 'bg-yellow-500';
      case 'converted': return 'bg-green-500';
      case 'archived': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Clients
              </Button>
              <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={client.profile_image_url} />
                  <AvatarFallback className="bg-blue-600 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {client.first_name} {client.last_name}
                  </h1>
                  <p className="text-gray-600">{client.email}</p>
                </div>
              </div>
              <Badge className={getStatusColor(client.lead_status)}>
                {client.lead_status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <User className="h-4 w-4" />
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
          </TabsList>

          <TabsContent value="overview">
            <ClientEditForm client={client} providerId={provider.id} />
          </TabsContent>

          <TabsContent value="appointments">
            <AppointmentsManagement providerId={provider.id} />
          </TabsContent>

          <TabsContent value="messages">
            <ChatInterface userType="provider" userId={provider.id} />
          </TabsContent>

          <TabsContent value="documents">
            <DocumentsManagement userType="provider" userId={provider.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

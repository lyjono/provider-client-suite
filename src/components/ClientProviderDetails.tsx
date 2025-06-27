
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, MessageCircle, FileText, User } from 'lucide-react';
import { AppointmentBooking } from '@/components/AppointmentBooking';
import { ChatInterface } from '@/components/ChatInterface';
import { DocumentsManagement } from '@/components/DocumentsManagement';

interface ClientProviderDetailsProps {
  provider: any;
  client: any;
  onBack: () => void;
}

export const ClientProviderDetails = ({ provider, client, onBack }: ClientProviderDetailsProps) => {
  const [activeTab, setActiveTab] = useState('overview');
  const initials = `${provider.first_name[0]}${provider.last_name[0]}`.toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Providers
              </Button>
              <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={provider.profile_image_url} />
                  <AvatarFallback className="bg-blue-600 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {provider.first_name} {provider.last_name}
                  </h1>
                  {provider.company_name && (
                    <p className="text-gray-600">{provider.company_name}</p>
                  )}
                </div>
              </div>
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
            <Card>
              <CardHeader>
                <CardTitle>Provider Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <p className="text-gray-900">{provider.first_name} {provider.last_name}</p>
                  </div>
                  {provider.company_name && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                      <p className="text-gray-900">{provider.company_name}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <p className="text-gray-900">{provider.email}</p>
                  </div>
                  {provider.phone && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <p className="text-gray-900">{provider.phone}</p>
                    </div>
                  )}
                </div>

                {provider.tagline && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
                    <p className="text-gray-900">{provider.tagline}</p>
                  </div>
                )}

                {provider.bio && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                    <p className="text-gray-900">{provider.bio}</p>
                  </div>
                )}

                {provider.years_experience && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Years of Experience</label>
                    <p className="text-gray-900">{provider.years_experience} years</p>
                  </div>
                )}

                {provider.hourly_rate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate</label>
                    <p className="text-gray-900">${provider.hourly_rate}</p>
                  </div>
                )}

                {provider.services && provider.services.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Services</label>
                    <div className="flex flex-wrap gap-2">
                      {provider.services.map((service: string, index: number) => (
                        <Badge key={index} variant="secondary">{service}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appointments">
            <AppointmentBooking clientId={client.id} providerId={provider.id} />
          </TabsContent>

          <TabsContent value="messages">
            <ChatInterface providerId={provider.id} clientId={client.id} />
          </TabsContent>

          <TabsContent value="documents">
            <DocumentsManagement providerId={provider.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

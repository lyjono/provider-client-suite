
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, Mail, Building, User } from 'lucide-react';

interface ProviderPresentationProps {
  providerSlug: string;
  onStartOnboarding: () => void;
}

export const ProviderPresentation = ({ providerSlug, onStartOnboarding }: ProviderPresentationProps) => {
  // Fetch provider info
  const { data: provider, isLoading } = useQuery({
    queryKey: ['provider-by-slug', providerSlug],
    queryFn: async () => {
      const { data } = await supabase
        .from('providers')
        .select(`
          *,
          expertise_areas(name),
          cities(name),
          countries(name)
        `)
        .eq('provider_slug', providerSlug)
        .single();
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-red-600">Provider not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = `${provider.first_name[0]}${provider.last_name[0]}`.toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <Card className="mb-8">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
                <Avatar className="h-32 w-32">
                  <AvatarImage src={provider.profile_image_url} />
                  <AvatarFallback className="text-2xl font-bold bg-blue-600 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 text-center md:text-left">
                  <h1 className="text-4xl font-bold text-gray-900 mb-2">
                    {provider.first_name} {provider.last_name}
                  </h1>
                  {provider.company_name && (
                    <div className="flex items-center justify-center md:justify-start mb-3">
                      <Building className="h-5 w-5 text-gray-600 mr-2" />
                      <span className="text-xl text-gray-700">{provider.company_name}</span>
                    </div>
                  )}
                  
                  {provider.expertise_areas && (
                    <Badge variant="secondary" className="mb-4 text-lg px-4 py-2">
                      {provider.expertise_areas.name}
                    </Badge>
                  )}
                  
                  {provider.bio && (
                    <p className="text-gray-600 text-lg leading-relaxed">{provider.bio}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center">
                  <Mail className="h-4 w-4 text-gray-500 mr-3" />
                  <span>{provider.email}</span>
                </div>
                {provider.phone && (
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 text-gray-500 mr-3" />
                    <span>{provider.phone}</span>
                  </div>
                )}
                {(provider.cities?.name || provider.countries?.name) && (
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 text-gray-500 mr-3" />
                    <span>
                      {provider.cities?.name}{provider.cities?.name && provider.countries?.name ? ', ' : ''}{provider.countries?.name}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>What You Can Do</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-gray-600">
                  <li>• Schedule appointments</li>
                  <li>• Chat and communicate</li>
                  <li>• Share documents securely</li>
                  <li>• Track your interactions</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Call to Action */}
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Ready to Connect?
              </h2>
              <p className="text-gray-600 mb-6 text-lg">
                Join the platform to start working with {provider.first_name} and manage all your professional relationships in one place.
              </p>
              <Button 
                onClick={onStartOnboarding}
                size="lg"
                className="text-lg px-8 py-3"
              >
                Get Started
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

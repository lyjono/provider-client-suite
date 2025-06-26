
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, Mail, Building, User, Star, Clock, DollarSign, Globe, Linkedin, Twitter, BookOpen, Award, Languages } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface ProviderLandingPageProps {
  providerSlug: string;
}

export const ProviderLandingPage = ({ providerSlug }: ProviderLandingPageProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch provider info with all related data
  const { data: provider, isLoading } = useQuery({
    queryKey: ['provider-landing', providerSlug],
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

  // Fetch testimonials
  const { data: testimonials } = useQuery({
    queryKey: ['testimonials', provider?.id],
    queryFn: async () => {
      if (!provider?.id) return [];
      const { data } = await supabase
        .from('testimonials')
        .select('*')
        .eq('provider_id', provider.id)
        .eq('is_featured', true)
        .order('created_at', { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!provider?.id,
  });

  // Fetch service packages
  const { data: servicePackages } = useQuery({
    queryKey: ['service-packages', provider?.id],
    queryFn: async () => {
      if (!provider?.id) return [];
      const { data } = await supabase
        .from('service_packages')
        .select('*')
        .eq('provider_id', provider.id)
        .eq('is_active', true)
        .order('is_featured', { ascending: false });
      return data || [];
    },
    enabled: !!provider?.id,
  });

  // Check if current user is already connected to this provider
  const { data: existingClient } = useQuery({
    queryKey: ['existing-client-connection', user?.id, provider?.id],
    queryFn: async () => {
      if (!user?.id || !provider?.id) return null;
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider_id', provider.id)
        .single();
      return data;
    },
    enabled: !!user?.id && !!provider?.id,
  });

  const handleConnectWithProvider = () => {
    if (!user) {
      // Redirect to auth page with return URL
      navigate(`/auth?redirect=/dashboard?provider=${providerSlug}`);
    } else if (existingClient) {
      // Already connected, go to dashboard
      navigate('/dashboard');
    } else {
      // Start client onboarding process
      navigate(`/dashboard?provider=${providerSlug}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
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
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <Card className="mb-8 overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-8">
                <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
                  <Avatar className="h-32 w-32 border-4 border-white">
                    <AvatarImage src={provider.profile_image_url} />
                    <AvatarFallback className="text-2xl font-bold bg-white text-blue-600">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 text-center md:text-left">
                    <h1 className="text-4xl font-bold mb-2">
                      {provider.first_name} {provider.last_name}
                    </h1>
                    {provider.company_name && (
                      <div className="flex items-center justify-center md:justify-start mb-3">
                        <Building className="h-5 w-5 mr-2" />
                        <span className="text-xl">{provider.company_name}</span>
                      </div>
                    )}
                    
                    {provider.tagline && (
                      <p className="text-xl text-blue-100 mb-4">{provider.tagline}</p>
                    )}
                    
                    <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                      {provider.expertise_areas && (
                        <Badge variant="secondary" className="bg-white text-blue-600">
                          {provider.expertise_areas.name}
                        </Badge>
                      )}
                      {provider.years_experience && (
                        <Badge variant="secondary" className="bg-white text-blue-600">
                          {provider.years_experience} years experience
                        </Badge>
                      )}
                    </div>
                    
                    {provider.bio && (
                      <p className="text-blue-100 text-lg leading-relaxed">{provider.bio}</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Services */}
              {provider.services && provider.services.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <User className="h-5 w-5 mr-2" />
                      Services Offered
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {provider.services.map((service, index) => (
                        <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                          <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                          <span>{service}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Service Packages */}
              {servicePackages && servicePackages.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Service Packages</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {servicePackages.map((pkg) => (
                        <div key={pkg.id} className={`p-4 border rounded-lg ${pkg.is_featured ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                          {pkg.is_featured && (
                            <Badge className="mb-2 bg-blue-600">Featured</Badge>
                          )}
                          <h3 className="font-semibold text-lg mb-2">{pkg.name}</h3>
                          {pkg.description && (
                            <p className="text-gray-600 mb-3">{pkg.description}</p>
                          )}
                          <div className="flex justify-between items-center">
                            {pkg.price && (
                              <span className="text-2xl font-bold text-green-600">
                                ${pkg.price}
                              </span>
                            )}
                            {pkg.duration_minutes && (
                              <span className="text-gray-500 flex items-center">
                                <Clock className="h-4 w-4 mr-1" />
                                {pkg.duration_minutes} min
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Testimonials */}
              {testimonials && testimonials.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Client Testimonials</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {testimonials.map((testimonial) => (
                        <div key={testimonial.id} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center mb-2">
                            {testimonial.rating && (
                              <div className="flex mr-2">
                                {[...Array(testimonial.rating)].map((_, i) => (
                                  <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                ))}
                              </div>
                            )}
                            <span className="font-medium">{testimonial.client_name}</span>
                            {testimonial.client_title && (
                              <span className="text-gray-500 ml-2">- {testimonial.client_title}</span>
                            )}
                          </div>
                          <p className="text-gray-700 italic">"{testimonial.content}"</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Contact & Connect */}
              <Card>
                <CardHeader>
                  <CardTitle>Connect with {provider.first_name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    onClick={handleConnectWithProvider}
                    size="lg"
                    className="w-full text-lg"
                  >
                    {existingClient ? 'Go to Dashboard' : user ? 'Connect Now' : 'Get Started'}
                  </Button>
                  
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 text-gray-500 mr-3" />
                      <span className="text-sm">{provider.email}</span>
                    </div>
                    {provider.phone && (
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 text-gray-500 mr-3" />
                        <span className="text-sm">{provider.phone}</span>
                      </div>
                    )}
                    {(provider.cities?.name || provider.countries?.name) && (
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 text-gray-500 mr-3" />
                        <span className="text-sm">
                          {provider.cities?.name}{provider.cities?.name && provider.countries?.name ? ', ' : ''}{provider.countries?.name}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Pricing */}
              {(provider.hourly_rate || provider.consultation_fee) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <DollarSign className="h-5 w-5 mr-2" />
                      Pricing
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {provider.consultation_fee && (
                      <div className="flex justify-between">
                        <span>Initial Consultation</span>
                        <span className="font-semibold">${provider.consultation_fee}</span>
                      </div>
                    )}
                    {provider.hourly_rate && (
                      <div className="flex justify-between">
                        <span>Hourly Rate</span>
                        <span className="font-semibold">${provider.hourly_rate}/hr</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Professional Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Professional Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {provider.education && (
                    <div className="flex items-start">
                      <BookOpen className="h-4 w-4 text-gray-500 mr-3 mt-1" />
                      <div>
                        <div className="font-medium text-sm">Education</div>
                        <div className="text-sm text-gray-600">{provider.education}</div>
                      </div>
                    </div>
                  )}
                  
                  {provider.certifications && provider.certifications.length > 0 && (
                    <div className="flex items-start">
                      <Award className="h-4 w-4 text-gray-500 mr-3 mt-1" />
                      <div>
                        <div className="font-medium text-sm">Certifications</div>
                        <div className="text-sm text-gray-600">
                          {provider.certifications.join(', ')}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {provider.languages && provider.languages.length > 0 && (
                    <div className="flex items-start">
                      <Languages className="h-4 w-4 text-gray-500 mr-3 mt-1" />
                      <div>
                        <div className="font-medium text-sm">Languages</div>
                        <div className="text-sm text-gray-600">
                          {provider.languages.join(', ')}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Social Links */}
              {(provider.website_url || provider.linkedin_url || provider.twitter_url) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Connect Online</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {provider.website_url && (
                      <a href={provider.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 hover:text-blue-800">
                        <Globe className="h-4 w-4 mr-2" />
                        <span className="text-sm">Website</span>
                      </a>
                    )}
                    {provider.linkedin_url && (
                      <a href={provider.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 hover:text-blue-800">
                        <Linkedin className="h-4 w-4 mr-2" />
                        <span className="text-sm">LinkedIn</span>
                      </a>
                    )}
                    {provider.twitter_url && (
                      <a href={provider.twitter_url} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 hover:text-blue-800">
                        <Twitter className="h-4 w-4 mr-2" />
                        <span className="text-sm">Twitter</span>
                      </a>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

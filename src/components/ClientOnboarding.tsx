
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Lock, Crown } from 'lucide-react';

interface ClientOnboardingProps {
  providerSlug: string;
}

interface ClientForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  cityId: string;
  countryId: string;
  notes: string;
}

export const ClientOnboarding = ({ providerSlug }: ClientOnboardingProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<ClientForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    cityId: '',
    countryId: '',
    notes: '',
  });

  // Fetch provider based on slug
  const { data: provider, isLoading: loadingProvider } = useQuery({
    queryKey: ['provider', providerSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('providers')
        .select('*')
        .eq('provider_slug', providerSlug)
        .single();

      if (error) {
        console.error('Error fetching provider:', error);
        return null;
      }

      return data;
    },
  });

  // Fetch countries
  const { data: countries } = useQuery({
    queryKey: ['countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('countries')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching countries:', error);
        return [];
      }

      return data || [];
    },
  });

  // Fetch cities based on selected country
  const { data: cities, refetch: refetchCities } = useQuery({
    queryKey: ['cities', form.countryId],
    queryFn: async () => {
      if (!form.countryId) return [];

      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .eq('country_id', form.countryId)
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching cities:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!form.countryId,
  });

  useEffect(() => {
    if (form.countryId) {
      refetchCities();
    }
  }, [form.countryId, refetchCities]);

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (clientData: ClientForm) => {
      if (!user || !provider) throw new Error('User or provider not found');

      const { data, error } = await supabase
        .from('clients')
        .insert({
          first_name: clientData.firstName,
          last_name: clientData.lastName,
          email: clientData.email,
          phone: clientData.phone,
          address: clientData.address,
          city_id: clientData.cityId || null,
          country_id: clientData.countryId || null,
          notes: clientData.notes,
          provider_id: provider.id,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating client:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: "Client created successfully",
        description: "You're now connected to the provider",
      });
      navigate('/dashboard');
    },
    onError: (error: any) => {
      toast({
        title: "Error creating client",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check if provider can accept new clients
  const { data: canAcceptNewClients, isLoading: checkingLimits } = useQuery({
    queryKey: ['provider-client-limit', provider?.id],
    queryFn: async () => {
      if (!provider?.id) return true;
      
      const { data } = await supabase
        .rpc('check_provider_client_limit', { provider_id: provider.id });
      
      return data;
    },
    enabled: !!provider?.id,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    createClientMutation.mutate(form);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  if (loadingProvider || checkingLimits) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Provider Not Found</h1>
          <p className="text-gray-600">The provider link you're trying to access doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <Avatar className="w-24 h-24 mx-auto mb-4">
            <AvatarImage src={provider.profile_image_url} alt={provider.first_name} />
            <AvatarFallback>{provider.first_name[0]}{provider.last_name[0]}</AvatarFallback>
          </Avatar>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Connect with {provider.company_name || `${provider.first_name} ${provider.last_name}`}
          </h1>
          <p className="text-gray-600">
            Fill out the form below to connect with this provider.
          </p>
          <Badge className="mt-4">
            You're connecting through: {providerSlug}
          </Badge>
        </div>

        {!canAcceptNewClients ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center space-x-2 text-amber-600 mb-4">
                <Lock className="h-8 w-8" />
                <Crown className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Provider Capacity Reached</h3>
              <p className="text-gray-600 mb-6">
                This provider has reached their current client limit. You can still register, but some features may be limited until they upgrade their plan.
              </p>
              <p className="text-sm text-gray-500">
                Don't worry - you'll have full access once the provider upgrades their subscription.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="firstName">First Name</label>
                <Input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label htmlFor="lastName">Last Name</label>
                <Input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label htmlFor="email">Email</label>
                <Input
                  type="email"
                  id="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label htmlFor="phone">Phone</label>
                <Input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="address">Address</label>
                <Input
                  type="text"
                  id="address"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="countryId">Country</label>
                <Select value={form.countryId} onValueChange={(value) => setForm({ ...form, countryId: value, cityId: '' })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries?.map((country) => (
                      <SelectItem key={country.id} value={country.id}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="cityId">City</label>
                <Select value={form.cityId} onValueChange={(value) => setForm({ ...form, cityId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a city" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities?.map((city) => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="notes">Notes</label>
                <Textarea
                  id="notes"
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Any additional notes..."
                />
              </div>
              <Button type="submit" disabled={createClientMutation.isPending}>
                {createClientMutation.isPending ? 'Submitting...' : 'Connect'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

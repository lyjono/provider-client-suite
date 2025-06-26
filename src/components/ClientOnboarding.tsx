
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

interface ClientOnboardingProps {
  providerSlug: string;
}

export const ClientOnboarding = ({ providerSlug }: ClientOnboardingProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: user?.email || '',
    phone: '',
    address: '',
    cityId: '',
    countryId: '',
  });

  // Fetch existing client data for this user
  const { data: existingClient } = useQuery({
    queryKey: ['existing-client-data', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Pre-populate form with existing client data
  useEffect(() => {
    if (existingClient) {
      setFormData({
        firstName: existingClient.first_name || '',
        lastName: existingClient.last_name || '',
        email: existingClient.email || user?.email || '',
        phone: existingClient.phone || '',
        address: existingClient.address || '',
        cityId: existingClient.city_id || '',
        countryId: existingClient.country_id || '',
      });
    }
  }, [existingClient, user?.email]);

  // Fetch provider info
  const { data: provider } = useQuery({
    queryKey: ['provider-by-slug', providerSlug],
    queryFn: async () => {
      const { data } = await supabase
        .from('providers')
        .select('*, expertise_areas(name)')
        .eq('provider_slug', providerSlug)
        .single();
      return data;
    },
  });

  // Check if user already has a client record with this provider
  const { data: existingClientRecord } = useQuery({
    queryKey: ['existing-client-record', user?.id, provider?.id],
    queryFn: async () => {
      if (!user?.id || !provider?.id) return null;
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider_id', provider.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && !!provider?.id,
  });

  // Fetch countries
  const { data: countries } = useQuery({
    queryKey: ['countries'],
    queryFn: async () => {
      const { data } = await supabase.from('countries').select('*').order('name');
      return data || [];
    },
  });

  // Fetch cities based on selected country
  const { data: cities } = useQuery({
    queryKey: ['cities', formData.countryId],
    queryFn: async () => {
      if (!formData.countryId) return [];
      const { data } = await supabase
        .from('cities')
        .select('*')
        .eq('country_id', formData.countryId)
        .order('name');
      return data || [];
    },
    enabled: !!formData.countryId,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!provider) throw new Error('Provider not found');
      if (!user?.id) throw new Error('User not authenticated');

      console.log('Creating client record with provider_id:', provider.id);

      // Insert into clients table with proper provider_id
      const { error } = await supabase.from('clients').insert({
        user_id: user.id,
        provider_id: provider.id, // This is the key fix - ensuring provider_id is set
        email: formData.email,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone || null,
        address: formData.address || null,
        city_id: formData.cityId || null,
        country_id: formData.countryId || null,
      });

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      console.log('Client record created successfully');

      toast({
        title: "Connection successful!",
        description: `You're now connected with ${provider.first_name} ${provider.last_name}`,
      });

      // Refresh the page to load the client dashboard
      window.location.reload();
    } catch (error: any) {
      console.error('Error creating client record:', error);
      toast({
        title: "Error creating connection",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // If user is already connected to this provider, redirect them
  if (existingClientRecord) {
    toast({
      title: "Already connected",
      description: `You're already connected with ${provider?.first_name} ${provider?.last_name}`,
    });
    window.location.href = '/dashboard';
    return null;
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Connect with {provider.first_name} {provider.last_name}</CardTitle>
          <p className="text-gray-600">
            {provider.company_name && `${provider.company_name} - `}
            {provider.expertise_areas?.name}
          </p>
          {existingClient && (
            <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
              We've pre-filled your information. You can update any details before connecting.
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                placeholder="First Name"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
              <Input
                placeholder="Last Name"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>

            <Input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <Input
              placeholder="Phone (Optional)"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />

            <Input
              placeholder="Address (Optional)"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select value={formData.countryId} onValueChange={(value) => setFormData({ ...formData, countryId: value, cityId: '' })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Country" />
                </SelectTrigger>
                <SelectContent>
                  {countries?.map((country) => (
                    <SelectItem key={country.id} value={country.id}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={formData.cityId} onValueChange={(value) => setFormData({ ...formData, cityId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select City" />
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Connecting...' : `Connect with ${provider.first_name} ${provider.last_name}`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

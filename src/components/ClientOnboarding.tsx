
import { useState } from 'react';
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

      // Insert into clients table, not providers table
      const { error } = await supabase.from('clients').insert({
        user_id: user?.id,
        provider_id: provider.id,
        email: formData.email,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone || null,
        address: formData.address || null,
        city_id: formData.cityId || null,
        country_id: formData.countryId || null,
      });

      if (error) throw error;

      toast({
        title: "Registration successful!",
        description: `You're now connected with ${provider.first_name} ${provider.last_name}`,
      });

      // Refresh the page to load the client dashboard
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Error creating profile",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
              {loading ? 'Registering...' : 'Connect with Provider'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

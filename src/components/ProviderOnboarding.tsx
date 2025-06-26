
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';

export const ProviderOnboarding = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    email: user?.email || '',
    phone: '',
    address: '',
    cityId: '',
    countryId: '',
    expertiseAreaId: '',
    bio: '',
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

  // Fetch expertise areas
  const { data: expertiseAreas } = useQuery({
    queryKey: ['expertise_areas'],
    queryFn: async () => {
      const { data } = await supabase.from('expertise_areas').select('*').order('name');
      return data || [];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from('providers').insert({
        user_id: user?.id,
        email: formData.email,
        first_name: formData.firstName,
        last_name: formData.lastName,
        company_name: formData.companyName || null,
        phone: formData.phone || null,
        address: formData.address,
        city_id: formData.cityId || null,
        country_id: formData.countryId || null,
        expertise_area_id: formData.expertiseAreaId || null,
        bio: formData.bio || null,
      });

      if (error) throw error;

      toast({
        title: "Profile created successfully!",
        description: "Welcome to the Provider Platform",
      });

      // Refresh the page to load the dashboard
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Complete Your Provider Profile</CardTitle>
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
              placeholder="Company Name (Optional)"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            />

            <Input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <Input
              placeholder="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />

            <Input
              placeholder="Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
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

            <Select value={formData.expertiseAreaId} onValueChange={(value) => setFormData({ ...formData, expertiseAreaId: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select Area of Expertise" />
              </SelectTrigger>
              <SelectContent>
                {expertiseAreas?.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Textarea
              placeholder="Bio (Optional)"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              rows={3}
            />

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating Profile...' : 'Complete Registration'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

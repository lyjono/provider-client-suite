
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Settings, User, CreditCard } from 'lucide-react';

interface ProviderSettingsProps {
  provider: any;
}

export const ProviderSettings = ({ provider }: ProviderSettingsProps) => {
  const [formData, setFormData] = useState({
    firstName: provider.first_name || '',
    lastName: provider.last_name || '',
    companyName: provider.company_name || '',
    email: provider.email || '',
    phone: provider.phone || '',
    bio: provider.bio || '',
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Settings</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Profile Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="First Name"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
              <Input
                placeholder="Last Name"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
            <Input
              placeholder="Company Name"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            />
            <Input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <Input
              placeholder="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Textarea
              placeholder="Bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              rows={3}
            />
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5" />
              <span>Subscription</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium">Current Plan: {provider.subscription_tier?.toUpperCase()}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {provider.subscription_tier === 'free' && 'Up to 5 clients - $0/month'}
                  {provider.subscription_tier === 'starter' && 'Up to 20 clients - $29/month'}
                  {provider.subscription_tier === 'pro' && 'Unlimited clients - $79/month'}
                </p>
              </div>
              <Button variant="outline">Upgrade Plan</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

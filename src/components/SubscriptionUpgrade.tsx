
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Star, Zap } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

interface SubscriptionUpgradeProps {
  currentTier: 'free' | 'starter' | 'pro';
  onUpgrade: (tier: 'starter' | 'pro') => void;
}

export const SubscriptionUpgrade = ({ currentTier, onUpgrade }: SubscriptionUpgradeProps) => {
  const { createCheckoutSession } = useSubscription();
  const [loading, setLoading] = useState<string | null>(null);

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      clients: 5,
      icon: Star,
      features: ['Up to 5 clients', 'Basic messaging', 'Basic appointments', 'Basic documents'],
      current: currentTier === 'free'
    },
    {
      id: 'starter',
      name: 'Starter',
      price: '$29',
      clients: 20,
      icon: Zap,
      features: ['Up to 20 clients', 'Advanced messaging', 'Video calls', 'Document sharing', 'Client management'],
      current: currentTier === 'starter',
      popular: true
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$79',
      clients: 'Unlimited',
      icon: Crown,
      features: ['Unlimited clients', 'All features', 'Priority support', 'Advanced analytics', 'Custom branding'],
      current: currentTier === 'pro'
    }
  ];

  const handleUpgradeClick = async (tier: 'starter' | 'pro') => {
    try {
      setLoading(tier);
      await createCheckoutSession(tier);
      onUpgrade(tier);
      
      // Show success message and reset loading after a short delay
      toast({
        title: "Redirecting to Stripe",
        description: "You're being redirected to complete your subscription upgrade.",
      });
      
      // Reset loading state after 3 seconds to handle cases where user might close the tab
      setTimeout(() => {
        setLoading(null);
      }, 3000);
      
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setLoading(null);
      toast({
        title: "Error",
        description: "Failed to create checkout session. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Reset loading state when component unmounts or when focus returns to window
  useEffect(() => {
    const handleFocus = () => {
      // Reset loading state when user returns to the page
      if (loading) {
        setTimeout(() => {
          setLoading(null);
        }, 1000);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      setLoading(null); // Clean up on unmount
    };
  }, [loading]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Choose Your Plan</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Upgrade your subscription to manage more clients and unlock advanced features
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isLoading = loading === plan.id;
          
          return (
            <Card 
              key={plan.id} 
              className={`relative ${plan.current ? 'ring-2 ring-blue-500' : ''} ${plan.popular ? 'ring-2 ring-amber-500' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-amber-500 text-white px-3 py-1">Most Popular</Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className="flex items-center justify-center mb-3">
                  <Icon className={`h-8 w-8 ${plan.current ? 'text-blue-500' : plan.popular ? 'text-amber-500' : 'text-gray-400'}`} />
                </div>
                <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                <div className="text-3xl font-bold text-gray-900">
                  {plan.price}
                  <span className="text-sm font-normal text-gray-500">/month</span>
                </div>
                <p className="text-gray-600">
                  {typeof plan.clients === 'number' ? `Up to ${plan.clients}` : plan.clients} clients
                </p>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-4">
                  {plan.current ? (
                    <Button disabled className="w-full">
                      Current Plan
                    </Button>
                  ) : plan.id === 'free' ? (
                    <Button variant="outline" disabled className="w-full">
                      Downgrade Not Available
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => handleUpgradeClick(plan.id as 'starter' | 'pro')}
                      disabled={isLoading || loading !== null}
                      className={`w-full ${
                        plan.popular 
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600' 
                          : ''
                      }`}
                    >
                      {isLoading ? 'Processing...' : 
                       currentTier === 'free' ? 'Upgrade Now' : 
                       plan.id === 'pro' ? 'Upgrade to Pro' : 'Choose Plan'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

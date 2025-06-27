
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, CheckCircle, AlertCircle, ArrowDown } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionUpgrade } from '@/components/SubscriptionUpgrade';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

export const ProviderSubscriptionManager = () => {
  const { subscribed, subscription_tier, subscription_end, openCustomerPortal } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentTier = subscription_tier || 'free';
  const isExpired = subscription_end ? new Date(subscription_end) < new Date() : false;

  const handleUpgrade = (tier: 'starter' | 'pro') => {
    setShowUpgrade(false);
  };

  const handleManageSubscription = async () => {
    try {
      setLoading(true);
      await openCustomerPortal();
      toast({
        title: "Redirecting to Stripe",
        description: "You're being redirected to manage your subscription.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to open subscription management. Please try again.",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setLoading(false), 3000);
    }
  };

  if (showUpgrade) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Upgrade Your Plan</h2>
          <Button variant="outline" onClick={() => setShowUpgrade(false)}>
            Back
          </Button>
        </div>
        <SubscriptionUpgrade 
          currentTier={currentTier as 'free' | 'starter' | 'pro'} 
          onUpgrade={handleUpgrade}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Subscription Management</h2>
        {subscribed && (
          <Button 
            onClick={handleManageSubscription} 
            variant="outline"
            disabled={loading}
          >
            <Crown className="h-4 w-4 mr-2" />
            {loading ? 'Opening...' : 'Manage Subscription'}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Crown className="h-5 w-5" />
            <span>Current Plan</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Badge variant={subscribed ? "default" : "secondary"} className="text-sm">
                {currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} Plan
              </Badge>
              {subscribed && subscription_end && (
                <p className="text-sm text-gray-600 mt-1">
                  {isExpired ? 'Expired on' : 'Renews on'} {new Date(subscription_end).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {subscribed && !isExpired ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              <span className="text-sm font-medium">
                {subscribed && !isExpired ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">Plan Limits</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <p>• Clients: {currentTier === 'free' ? '5' : currentTier === 'starter' ? '20' : 'Unlimited'}</p>
              <p>• Features: {currentTier === 'free' ? 'Basic' : currentTier === 'starter' ? 'Advanced' : 'All Features'}</p>
              <p>• Support: {currentTier === 'pro' ? 'Priority' : 'Standard'}</p>
            </div>
          </div>

          <div className="pt-4 border-t space-y-2">
            {(!subscribed || currentTier === 'free') && (
              <Button onClick={() => setShowUpgrade(true)} className="w-full">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Button>
            )}
            
            {subscribed && currentTier !== 'free' && (
              <Button 
                onClick={handleManageSubscription} 
                variant="outline" 
                className="w-full"
                disabled={loading}
              >
                <ArrowDown className="h-4 w-4 mr-2" />
                {loading ? 'Opening Portal...' : 'Cancel Subscription (Downgrade to Free)'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

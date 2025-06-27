
import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BlurredContentProps {
  children: ReactNode;
  isBlurred: boolean;
  title?: string;
  description?: string;
  upgradeMessage?: string;
  onUpgrade?: () => void;
}

export const BlurredContent = ({
  children,
  isBlurred,
  title = "Upgrade Required",
  description = "You've reached your client limit. Upgrade your plan to interact with more clients.",
  upgradeMessage = "Upgrade Plan",
  onUpgrade
}: BlurredContentProps) => {
  if (!isBlurred) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="filter blur-sm pointer-events-none select-none opacity-30">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <Card className="bg-white/95 backdrop-blur-sm border-2 border-amber-200 shadow-lg">
          <CardContent className="p-6 text-center space-y-4">
            <div className="flex items-center justify-center space-x-2 text-amber-600">
              <Lock className="h-6 w-6" />
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-600 mb-4 max-w-xs">
                {description}
              </p>
              {onUpgrade && (
                <Button onClick={onUpgrade} className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                  <Crown className="h-4 w-4 mr-2" />
                  {upgradeMessage}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};


import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Video, Phone } from 'lucide-react';
import { VideoCall } from '@/components/VideoCall';

interface VideoCallButtonProps {
  roomId: string;
  userId: string;
  disabled?: boolean;
  variant?: 'default' | 'outline';
  size?: 'sm' | 'default' | 'lg';
}

export const VideoCallButton = ({ 
  roomId, 
  userId, 
  disabled = false, 
  variant = 'outline',
  size = 'sm'
}: VideoCallButtonProps) => {
  const [isInCall, setIsInCall] = useState(false);

  const startCall = () => {
    setIsInCall(true);
  };

  const endCall = () => {
    setIsInCall(false);
  };

  if (isInCall) {
    return <VideoCall roomId={roomId} userId={userId} onCallEnd={endCall} />;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={startCall}
      disabled={disabled}
      className="flex items-center space-x-1"
    >
      <Video className="h-4 w-4" />
      <span>Start Video Call</span>
    </Button>
  );
};

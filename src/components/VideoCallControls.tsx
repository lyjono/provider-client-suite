
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';

interface VideoCallControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  hasAudioTracks: boolean;
}

export const VideoCallControls = ({
  isAudioEnabled,
  isVideoEnabled,
  onToggleAudio,
  onToggleVideo,
  onEndCall,
  hasAudioTracks
}: VideoCallControlsProps) => {
  return (
    <div className="bg-black/80 p-4 flex justify-center space-x-4">
      <Button
        variant={isAudioEnabled ? "default" : "destructive"}
        size="lg"
        onClick={onToggleAudio}
        className="rounded-full w-14 h-14"
        disabled={!hasAudioTracks}
      >
        {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
      </Button>

      <Button
        variant={isVideoEnabled ? "default" : "destructive"}
        size="lg"
        onClick={onToggleVideo}
        className="rounded-full w-14 h-14"
      >
        {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
      </Button>

      <Button
        variant="destructive"
        size="lg"
        onClick={onEndCall}
        className="rounded-full w-14 h-14"
      >
        <PhoneOff className="h-6 w-6" />
      </Button>
    </div>
  );
};


import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useWebRTC } from '@/hooks/useWebRTC';
import { VideoCallControls } from './VideoCallControls';
import { VideoCallStatus } from './VideoCallStatus';
import { setupVideoCallSignaling } from '@/utils/videoCallSignaling';

interface VideoCallProps {
  roomId: string;
  userId: string;
  onCallEnd: () => void;
}

export const VideoCall = ({ roomId, userId, onCallEnd }: VideoCallProps) => {
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<any>(null);

  const handleRemoteStream = (stream: MediaStream) => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
    }
  };

  const handleConnectionStateChange = (connected: boolean) => {
    setIsConnected(connected);
    setIsConnecting(false);
  };

  const {
    initializePeerConnection,
    createOffer,
    handleOffer,
    handleAnswer,
    handleCandidate,
    cleanup,
    localStreamRef
  } = useWebRTC({
    onRemoteStream: handleRemoteStream,
    onConnectionStateChange: handleConnectionStateChange,
    userId,
    channelRef
  });

  const initializeVideoCall = async () => {
    try {
      setIsConnecting(true);

      const { stream } = await initializePeerConnection();
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Setup signaling
      const channel = setupVideoCallSignaling(roomId, userId, {
        onOffer: handleOffer,
        onAnswer: handleAnswer,
        onCandidate: handleCandidate,
        onUserJoin: (users) => {
          // First user (alphabetically) creates offer to avoid conflicts
          if (users.length === 2 && users.sort()[0] === userId) {
            console.log(`${userId} is initiating the call`);
            setTimeout(() => createOffer(), 1000);
          }
        }
      });

      channelRef.current = channel;

      // Set connection timeout
      setTimeout(() => {
        if (isConnecting && !isConnected) {
          console.log('Connection timeout');
          toast.error('Connection timeout. Please try again.');
          setIsConnecting(false);
        }
      }, 30000);

    } catch (error) {
      console.error('Error initializing video call:', error);
      handleInitializationError(error);
      setIsConnecting(false);
    }
  };

  const handleInitializationError = (error: any) => {
    if (error instanceof DOMException && error.name === 'NotReadableError') {
      const specificMessage = "Could not access camera/microphone. Another application or browser tab might be using it. Please close any other apps/tabs using your camera/mic and try again.";
      setPermissionsError(specificMessage);
      toast.error(specificMessage);
    } else if (error instanceof DOMException && error.name === 'NotAllowedError') {
      setPermissionsError("Camera and microphone access denied. Please allow access and try again.");
      toast.error("Camera and microphone access denied");
    } else {
      setPermissionsError("Could not initialize video call. Please try again.");
      toast.error("Could not initialize video call");
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const endCall = () => {
    cleanup();
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    onCallEnd();
  };

  useEffect(() => {
    initializeVideoCall();
    return () => endCall();
  }, [roomId, userId]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Remote video */}
      <div className="flex-1 relative">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        <VideoCallStatus 
          isConnecting={isConnecting}
          isConnected={isConnected}
          permissionsError={permissionsError}
        />

        {/* Local video (picture-in-picture) */}
        <div className="absolute bottom-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
          {!isVideoEnabled && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <p className="text-white text-xs">Camera Off</p>
            </div>
          )}
        </div>
      </div>

      <VideoCallControls
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onEndCall={endCall}
        hasAudioTracks={!!localStreamRef.current?.getAudioTracks().length}
      />
    </div>
  );
};

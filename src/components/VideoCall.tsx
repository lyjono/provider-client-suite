
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { toast } from 'sonner';

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
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);

  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  const initializeVideoCall = async () => {
    try {
      setIsConnecting(true);

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const peerConnection = new RTCPeerConnection(rtcConfiguration);
      peerConnectionRef.current = peerConnection;

      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('Received remote stream');
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setIsConnected(true);
          setIsConnecting(false);
          toast.success("Connected to call");
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && channelRef.current) {
          console.log('Sending ICE candidate:', event.candidate);
          channelRef.current.send({
            type: 'broadcast',
            event: 'signal',
            payload: { 
              type: 'candidate', 
              candidate: event.candidate,
              senderId: userId 
            }
          });
        }
      };

      // Handle connection state changes
      peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.iceConnectionState);
        if (peerConnection.iceConnectionState === 'connected') {
          setIsConnected(true);
          setIsConnecting(false);
        } else if (peerConnection.iceConnectionState === 'failed') {
          toast.error('Connection failed. Please try again.');
          setIsConnecting(false);
        }
      };

      peerConnection.onsignalingstatechange = () => {
        console.log('Signaling state:', peerConnection.signalingState);
      };

      // Setup Supabase channel for signaling
      setupSignaling(roomId);

      // Set connection timeout
      setTimeout(() => {
        if (isConnecting && !isConnected) {
          console.log('Connection timeout');
          toast.error('Connection timeout. Please try again.');
          setIsConnecting(false);
        }
      }, 30000); // 30 second timeout

    } catch (error) {
      console.error('Error initializing video call:', error);
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
      setIsConnecting(false);
    }
  };

  const setupSignaling = (roomId: string) => {
    const channel = supabase.channel(`video-call:${roomId}`);

    channel.on('broadcast', { event: 'signal' }, (payload) => {
      console.log('Received signal:', payload.payload);
      const { type, candidate, data, senderId } = payload.payload;
      
      // Ignore messages from self
      if (senderId === userId) return;

      if (type === 'offer') {
        handleOffer(data);
      } else if (type === 'answer') {
        handleAnswer(data);
      } else if (type === 'candidate') {
        handleCandidate(candidate);
      }
    });

    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState();
      const users = Object.values(presenceState).flat().map((entry: any) => entry.user);
      console.log('Users in room:', users);
      
      // First user (alphabetically) creates offer to avoid conflicts
      if (users.length === 2 && users.sort()[0] === userId) {
        console.log(`${userId} is initiating the call`);
        setTimeout(() => createOffer(), 1000); // Small delay to ensure both users are ready
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Subscribed to signaling channel:', `video-call:${roomId}`);
        await channel.track({ user: userId });
      }
    });

    channelRef.current = channel;
  };

  const createOffer = async () => {
    if (!peerConnectionRef.current || !channelRef.current) return;

    try {
      console.log('Creating offer...');
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      console.log('Sending offer:', offer);
      channelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: { 
          type: 'offer', 
          data: offer,
          senderId: userId 
        }
      });
    } catch (error) {
      console.error('Error creating offer:', error);
      toast.error("Failed to create offer");
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current || !channelRef.current) return;

    try {
      console.log('Handling offer:', offer);
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      
      console.log('Sending answer:', answer);
      channelRef.current.send({
        type: 'broadcast',
        event: 'signal',
        payload: { 
          type: 'answer', 
          data: answer,
          senderId: userId 
        }
      });
    } catch (error) {
      console.error('Error handling offer:', error);
      toast.error("Failed to handle offer");
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) return;

    try {
      console.log('Handling answer:', answer);
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('Error handling answer:', error);
      toast.error("Failed to handle answer");
    }
  };

  const handleCandidate = async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current) return;

    try {
      console.log('Adding ICE candidate:', candidate);
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
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
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    // Unsubscribe from channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    onCallEnd();
  };

  useEffect(() => {
    initializeVideoCall();

    return () => {
      endCall();
    };
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
        
        {/* Connection status */}
        <div className="absolute top-4 left-4">
          <Card className="bg-black/50 text-white border-none">
            <CardContent className="p-2">
              <span className="text-sm">
                {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Waiting for connection'}
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Permissions error */}
        {permissionsError && (
          <div className="absolute top-4 right-4 max-w-md">
            <Card className="bg-red-500/80 text-white border-none">
              <CardContent className="p-3">
                <p className="text-sm">{permissionsError}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Connecting overlay */}
        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
            <div className="text-center">
              <p className="text-xl mb-2">Connecting to call...</p>
              <p className="text-sm text-slate-300">Waiting for peer connection</p>
            </div>
          </div>
        )}

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

      {/* Controls */}
      <div className="bg-black/80 p-4 flex justify-center space-x-4">
        <Button
          variant={isAudioEnabled ? "default" : "destructive"}
          size="lg"
          onClick={toggleAudio}
          className="rounded-full w-14 h-14"
          disabled={!localStreamRef.current?.getAudioTracks().length}
        >
          {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </Button>

        <Button
          variant={isVideoEnabled ? "default" : "destructive"}
          size="lg"
          onClick={toggleVideo}
          className="rounded-full w-14 h-14"
        >
          {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
        </Button>

        <Button
          variant="destructive"
          size="lg"
          onClick={endCall}
          className="rounded-full w-14 h-14"
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
};

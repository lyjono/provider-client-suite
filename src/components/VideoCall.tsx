
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface VideoCallProps {
  roomId: string;
  userId: string;
  onCallEnd: () => void;
}

export const VideoCall = ({ roomId, userId, onCallEnd }: VideoCallProps) => {
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
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
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'candidate',
            payload: {
              candidate: event.candidate,
              senderId: userId
            }
          });
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        setIsConnected(peerConnection.connectionState === 'connected');
        if (peerConnection.connectionState === 'connected') {
          setIsConnecting(false);
        }
      };

      // Setup Supabase channel for signaling
      const channel = supabase.channel(`video-call:${roomId}`);
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'offer' }, async ({ payload }) => {
          if (payload.senderId !== userId) {
            await peerConnection.setRemoteDescription(payload.offer);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            channel.send({
              type: 'broadcast',
              event: 'answer',
              payload: { answer, senderId: userId }
            });
          }
        })
        .on('broadcast', { event: 'answer' }, async ({ payload }) => {
          if (payload.senderId !== userId) {
            await peerConnection.setRemoteDescription(payload.answer);
          }
        })
        .on('broadcast', { event: 'candidate' }, async ({ payload }) => {
          if (payload.senderId !== userId) {
            await peerConnection.addIceCandidate(payload.candidate);
          }
        })
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const users = Object.keys(presenceState);
          
          // If there are 2 users and current user is the "caller" (first alphabetically)
          if (users.length === 2 && users.sort()[0] === userId) {
            createOffer();
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ userId, online_at: new Date().toISOString() });
          }
        });

    } catch (error) {
      console.error('Error initializing video call:', error);
      toast({
        title: "Error",
        description: "Failed to initialize video call. Please check your camera and microphone permissions.",
        variant: "destructive"
      });
      setIsConnecting(false);
    }
  };

  const createOffer = async () => {
    if (!peerConnectionRef.current || !channelRef.current) return;

    try {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      channelRef.current.send({
        type: 'broadcast',
        event: 'offer',
        payload: { offer, senderId: userId }
      });
    } catch (error) {
      console.error('Error creating offer:', error);
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

        {/* Local video (picture-in-picture) */}
        <div className="absolute bottom-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="bg-black/80 p-4 flex justify-center space-x-4">
        <Button
          variant={isAudioEnabled ? "default" : "destructive"}
          size="lg"
          onClick={toggleAudio}
          className="rounded-full w-14 h-14"
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

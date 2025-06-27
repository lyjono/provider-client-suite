
import { useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface UseWebRTCProps {
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (connected: boolean) => void;
  userId: string;
  channelRef: React.MutableRefObject<any>;
}

export const useWebRTC = ({ onRemoteStream, onConnectionStateChange, userId, channelRef }: UseWebRTCProps) => {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  const initializePeerConnection = useCallback(async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      localStreamRef.current = stream;

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
        if (event.streams[0]) {
          onRemoteStream(event.streams[0]);
          onConnectionStateChange(true);
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
          onConnectionStateChange(true);
        } else if (peerConnection.iceConnectionState === 'failed') {
          toast.error('Connection failed. Please try again.');
          onConnectionStateChange(false);
        }
      };

      return { peerConnection, stream };
    } catch (error) {
      console.error('Error initializing peer connection:', error);
      throw error;
    }
  }, [onRemoteStream, onConnectionStateChange, userId, channelRef]);

  const createOffer = useCallback(async () => {
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
  }, [userId, channelRef]);

  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit) => {
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
  }, [userId, channelRef]);

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) return;

    try {
      console.log('Handling answer:', answer);
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('Error handling answer:', error);
      toast.error("Failed to handle answer");
    }
  }, []);

  const handleCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current) return;

    try {
      console.log('Adding ICE candidate:', candidate);
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
  }, []);

  return {
    initializePeerConnection,
    createOffer,
    handleOffer,
    handleAnswer,
    handleCandidate,
    cleanup,
    localStreamRef,
    peerConnectionRef
  };
};


import { supabase } from '@/integrations/supabase/client';

interface SignalingHandlers {
  onOffer: (offer: RTCSessionDescriptionInit) => void;
  onAnswer: (answer: RTCSessionDescriptionInit) => void;
  onCandidate: (candidate: RTCIceCandidateInit) => void;
  onUserJoin: (users: string[]) => void;
}

export const setupVideoCallSignaling = (
  roomId: string,
  userId: string,
  handlers: SignalingHandlers
) => {
  const channel = supabase.channel(`video-call:${roomId}`);

  channel.on('broadcast', { event: 'signal' }, (payload) => {
    console.log('Received signal:', payload.payload);
    const { type, candidate, data, senderId } = payload.payload;
    
    // Ignore messages from self
    if (senderId === userId) return;

    if (type === 'offer') {
      handlers.onOffer(data);
    } else if (type === 'answer') {
      handlers.onAnswer(data);
    } else if (type === 'candidate') {
      handlers.onCandidate(candidate);
    }
  });

  channel.on('presence', { event: 'sync' }, () => {
    const presenceState = channel.presenceState();
    const users = Object.values(presenceState).flat().map((entry: any) => entry.user);
    console.log('Users in room:', users);
    handlers.onUserJoin(users);
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Subscribed to signaling channel:', `video-call:${roomId}`);
      await channel.track({ user: userId });
    }
  });

  return channel;
};

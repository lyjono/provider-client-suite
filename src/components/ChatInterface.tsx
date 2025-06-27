import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Paperclip, Download, FileText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { BlurredContent } from '@/components/BlurredContent';
import { useProviderClientInteraction } from '@/hooks/useSubscriptionLimits';

interface ChatInterfaceProps {
  conversationId: string;
  currentUserId: string;
  otherParticipant: {
    id: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string | null;
    userType: 'client' | 'provider';
  };
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
}

export const ChatInterface = ({ conversationId, currentUserId, otherParticipant }: ChatInterfaceProps) => {
  const [messageText, setMessageText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: messages, isLoading: loading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      return data || [];
    },
  });
  
  const { canInteract } = useProviderClientInteraction(
    otherParticipant?.userType === 'client' ? otherParticipant.id : undefined
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          console.log('Change received!', payload)
          queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, queryClient])

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!messageText.trim() && !file) return;

      let file_url = null;
      let file_name = null;
      let file_size = null;

      if (file) {
        const timestamp = Date.now();
        const filePath = `chat-files/${conversationId}/${timestamp}_${file.name}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('chat-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('chat-files')
          .getPublicUrl(filePath);

        file_url = publicUrl;
        file_name = file.name;
        file_size = file.size;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            content: messageText,
            conversation_id: conversationId,
            sender_id: currentUserId,
            file_url: file_url,
            file_name: file_name,
            file_size: file_size,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setMessageText('');
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      scrollToBottom();
    },
    onError: (error) => {
      console.error('Send message error:', error);
      toast({
        title: "Error sending message",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = async () => {
    await sendMessageMutation.mutateAsync();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
  };

  const handleDownload = (message: Message) => {
    if (message.file_url) {
      window.open(message.file_url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <BlurredContent
      isBlurred={!canInteract && otherParticipant?.userType === 'client'}
      title="Client Limit Reached"
      description="You've reached your subscription limit. Upgrade to interact with more clients."
    >
      <div className="flex flex-col h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 pl-4 pr-4">
          <CardTitle className="text-lg font-medium">
            <div className="flex items-center">
              <Avatar className="mr-2 h-8 w-8">
                <AvatarImage src={otherParticipant?.profileImageUrl || ''} />
                <AvatarFallback>{otherParticipant?.firstName[0]}{otherParticipant?.lastName[0]}</AvatarFallback>
              </Avatar>
              {otherParticipant?.firstName} {otherParticipant?.lastName}
            </div>
          </CardTitle>
        </CardHeader>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`rounded-lg px-3 py-2 shadow ${message.sender_id === currentUserId ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                style={{ maxWidth: '75%' }}
              >
                {message.file_url && (
                  <div className="mb-2">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4" />
                      <a
                        href={message.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm underline"
                      >
                        {message.file_name}
                      </a>
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(message)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-sm break-words">{message.content}</p>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className={`border-t p-4 ${!canInteract && otherParticipant?.userType === 'client' ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center space-x-2">
            <Input
              type="text"
              placeholder="Type your message..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage();
                }
              }}
            />
            <label htmlFor="upload-file">
              <Button variant="secondary" size="icon">
                <Paperclip className="h-4 w-4" />
              </Button>
            </label>
            <input
              type="file"
              id="upload-file"
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
            />
            <Button onClick={handleSendMessage} disabled={sendMessageMutation.isPending}>
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </BlurredContent>
  );
};

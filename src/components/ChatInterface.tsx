
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageCircle, Send } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ChatInterfaceProps {
  userType: 'provider' | 'client';
  userId: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  message_type: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
}

interface Conversation {
  id: string;
  provider_id: string;
  client_id: string;
  last_message_at: string;
  providers?: {
    first_name: string;
    last_name: string;
    company_name?: string;
    profile_image_url?: string;
  };
  clients?: {
    first_name: string;
    last_name: string;
  };
}

export const ChatInterface = ({ userType, userId }: ChatInterfaceProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch conversations
  const { data: conversations, isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations', userId, userType],
    queryFn: async () => {
      const column = userType === 'provider' ? 'provider_id' : 'client_id';
      const { data } = await supabase
        .from('conversations')
        .select(`
          *,
          providers(first_name, last_name, company_name, profile_image_url),
          clients(first_name, last_name)
        `)
        .eq(column, userId)
        .order('last_message_at', { ascending: false });
      return data as Conversation[] || [];
    },
  });

  // Fetch messages for selected conversation
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', selectedConversation)
        .order('created_at', { ascending: true });
      return data as Message[] || [];
    },
    enabled: !!selectedConversation,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      if (!selectedConversation || !messageText.trim()) return;

      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedConversation,
        sender_id: userId,
        content: messageText.trim(),
        message_type: 'text',
      });

      if (error) throw error;

      // Update conversation's last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selectedConversation);
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ['conversations', userId, userType] });
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      toast({
        title: "Error sending message",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Select first conversation by default
  useEffect(() => {
    if (conversations && conversations.length > 0 && !selectedConversation) {
      setSelectedConversation(conversations[0].id);
    }
  }, [conversations, selectedConversation]);

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      sendMessageMutation.mutate(newMessage);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getConversationPartner = (conversation: Conversation) => {
    if (userType === 'provider') {
      return {
        name: `${conversation.clients?.first_name} ${conversation.clients?.last_name}`,
        avatar: null,
        initials: `${conversation.clients?.first_name?.[0]}${conversation.clients?.last_name?.[0]}`.toUpperCase(),
      };
    } else {
      return {
        name: conversation.providers?.company_name || 
              `${conversation.providers?.first_name} ${conversation.providers?.last_name}`,
        avatar: conversation.providers?.profile_image_url,
        initials: `${conversation.providers?.first_name?.[0]}${conversation.providers?.last_name?.[0]}`.toUpperCase(),
      };
    }
  };

  const formatMessageTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const isMyMessage = (message: Message) => {
    return message.sender_id === userId;
  };

  if (conversationsLoading) {
    return <div className="text-center py-8">Loading conversations...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Messages</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Conversations List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {conversations?.length === 0 ? (
              <p className="text-gray-600 p-4">No conversations yet</p>
            ) : (
              <div className="space-y-1">
                {conversations?.map((conversation) => {
                  const partner = getConversationPartner(conversation);
                  return (
                    <div
                      key={conversation.id}
                      onClick={() => setSelectedConversation(conversation.id)}
                      className={`flex items-center space-x-3 p-4 hover:bg-gray-50 cursor-pointer border-b ${
                        selectedConversation === conversation.id ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={partner.avatar} />
                        <AvatarFallback className="bg-blue-600 text-white text-sm">
                          {partner.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{partner.name}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(conversation.last_message_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center space-x-2">
              <MessageCircle className="h-5 w-5 text-blue-600" />
              <span>
                {selectedConversation && conversations ? 
                  getConversationPartner(conversations.find(c => c.id === selectedConversation)!).name : 
                  'Select a conversation'
                }
              </span>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!selectedConversation ? (
                <div className="text-center text-gray-600 mt-20">
                  <MessageCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p>Select a conversation to start messaging</p>
                </div>
              ) : messagesLoading ? (
                <div className="text-center py-8">Loading messages...</div>
              ) : messages?.length === 0 ? (
                <div className="text-center text-gray-600 mt-20">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <>
                  {messages?.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        isMyMessage(message) ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          isMyMessage(message)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            isMyMessage(message)
                              ? 'text-blue-100'
                              : 'text-gray-500'
                          }`}
                        >
                          {formatMessageTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message Input */}
            {selectedConversation && (
              <div className="border-t p-4">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={sendMessageMutation.isPending}
                  />
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

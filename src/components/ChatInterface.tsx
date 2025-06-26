
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, Send } from 'lucide-react';

interface ChatInterfaceProps {
  userType: 'provider' | 'client';
  userId: string;
}

export const ChatInterface = ({ userType, userId }: ChatInterfaceProps) => {
  const [newMessage, setNewMessage] = useState('');

  // Fetch conversations
  const { data: conversations, isLoading } = useQuery({
    queryKey: ['conversations', userId, userType],
    queryFn: async () => {
      const column = userType === 'provider' ? 'provider_id' : 'client_id';
      const { data } = await supabase
        .from('conversations')
        .select(`
          *,
          providers(first_name, last_name, company_name),
          clients(first_name, last_name)
        `)
        .eq(column, userId)
        .order('last_message_at', { ascending: false });
      return data || [];
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading conversations...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Messages</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            {conversations.length === 0 ? (
              <p className="text-gray-600">No conversations yet</p>
            ) : (
              <div className="space-y-3">
                {conversations.map((conversation) => (
                  <div key={conversation.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <MessageCircle className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">
                        {userType === 'provider' 
                          ? `${conversation.clients?.first_name} ${conversation.clients?.last_name}`
                          : conversation.providers?.company_name || `${conversation.providers?.first_name} ${conversation.providers?.last_name}`
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Chat</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96 border rounded-lg p-4 mb-4 overflow-y-auto bg-gray-50">
              <p className="text-gray-600 text-center">
                Advanced messaging system coming soon. Messages will appear here.
              </p>
            </div>
            <div className="flex space-x-2">
              <Input
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && setNewMessage('')}
              />
              <Button onClick={() => setNewMessage('')}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

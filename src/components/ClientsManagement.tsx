import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, User, MessageCircle } from 'lucide-react';

interface ClientsManagementProps {
  providerId: string;
}

type LeadStatus = 'contacted' | 'qualified' | 'converted' | 'archived';

export const ClientsManagement = ({ providerId }: ClientsManagementProps) => {
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [leadStatus, setLeadStatus] = useState<LeadStatus>('contacted');
  const queryClient = useQueryClient();

  // Fetch clients
  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients', providerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select(`
          *,
          cities(name),
          countries(name)
        `)
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const updateClientNotes = async () => {
    if (!selectedClient) return;

    try {
      const { error } = await supabase
        .from('clients')
        .update({
          notes: notes,
          lead_status: leadStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedClient.id);

      if (error) throw error;

      toast({
        title: "Client updated successfully",
        description: "Notes and status have been saved",
      });

      queryClient.invalidateQueries({ queryKey: ['clients', providerId] });
      setSelectedClient(null);
    } catch (error: any) {
      toast({
        title: "Error updating client",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openClientDialog = (client: any) => {
    setSelectedClient(client);
    setNotes(client.notes || '');
    setLeadStatus((client.lead_status as LeadStatus) || 'contacted');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'contacted': return 'bg-blue-500';
      case 'qualified': return 'bg-yellow-500';
      case 'converted': return 'bg-green-500';
      case 'archived': return 'bg-gray-500';
      default: return 'bg-blue-500';
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading clients...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Client Management</h2>
        <div className="text-sm text-gray-600">
          {clients.length} total clients
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.map((client) => (
          <Card key={client.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-gray-500" />
                  <CardTitle className="text-lg">
                    {client.first_name} {client.last_name}
                  </CardTitle>
                </div>
                <Badge className={getStatusColor(client.lead_status)}>
                  {client.lead_status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-gray-600">{client.email}</p>
              {client.phone && (
                <p className="text-sm text-gray-600">{client.phone}</p>
              )}
              {client.cities?.name && (
                <p className="text-sm text-gray-600">
                  {client.cities.name}, {client.countries?.name}
                </p>
              )}
              {client.notes && (
                <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                  {client.notes.substring(0, 100)}
                  {client.notes.length > 100 && '...'}
                </p>
              )}
              <div className="flex space-x-2 pt-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openClientDialog(client)}
                    >
                      Edit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {client.first_name} {client.last_name}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Lead Status</label>
                        <Select value={leadStatus} onValueChange={setLeadStatus}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="qualified">Qualified</SelectItem>
                            <SelectItem value="converted">Converted</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Notes</label>
                        <Textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Add notes about this client..."
                          rows={4}
                        />
                      </div>
                      <Button onClick={updateClientNotes} className="w-full">
                        Save Changes
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" size="sm">
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {clients.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No clients yet</h3>
            <p className="text-gray-600 mb-4">
              Share your client registration link to start getting clients
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

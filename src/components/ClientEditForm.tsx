
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

interface ClientEditFormProps {
  client: any;
  providerId: string;
}

type LeadStatus = 'contacted' | 'qualified' | 'converted' | 'archived';

export const ClientEditForm = ({ client, providerId }: ClientEditFormProps) => {
  const [notes, setNotes] = useState(client.notes || '');
  const [leadStatus, setLeadStatus] = useState<LeadStatus>(client.lead_status || 'contacted');
  const queryClient = useQueryClient();

  const updateClientMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('clients')
        .update({
          notes: notes,
          lead_status: leadStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', client.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Client updated successfully",
        description: "Notes and status have been saved",
      });
      queryClient.invalidateQueries({ queryKey: ['clients', providerId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating client",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Client Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <Input value={client.first_name} disabled />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <Input value={client.last_name} disabled />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input value={client.email} disabled />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <Input value={client.phone || 'Not provided'} disabled />
            </div>
          </div>
          
          {client.cities?.name && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <Input value={`${client.cities.name}, ${client.countries?.name}`} disabled />
            </div>
          )}

          {client.address && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <Input value={client.address} disabled />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lead Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lead Status</label>
            <Select value={leadStatus} onValueChange={(value: string) => setLeadStatus(value as LeadStatus)}>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this client..."
              rows={6}
            />
          </div>

          <Button 
            onClick={() => updateClientMutation.mutate()} 
            disabled={updateClientMutation.isPending}
            className="w-full"
          >
            {updateClientMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

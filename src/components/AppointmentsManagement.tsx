
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Video, X, Check } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useProviderClientInteraction } from '@/hooks/useSubscriptionLimits';
import { BlurredContent } from '@/components/BlurredContent';

interface AppointmentsManagementProps {
  providerId: string;
}

export const AppointmentsManagement = ({ providerId }: AppointmentsManagementProps) => {
  const queryClient = useQueryClient();

  // Fetch appointments for the provider
  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments', providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          clients(first_name, last_name, email)
        `)
        .eq('provider_id', providerId)
        .order('appointment_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Update appointment status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ appointmentId, status }: { appointmentId: string; status: 'pending' | 'confirmed' | 'completed' | 'cancelled' }) => {
      const { data, error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', appointmentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', providerId] });
      toast({
        title: "Appointment updated",
        description: "The appointment status has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating appointment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'confirmed': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const handleStatusUpdate = (appointmentId: string, status: 'pending' | 'confirmed' | 'completed' | 'cancelled') => {
    updateStatusMutation.mutate({ appointmentId, status });
  };

  if (isLoading) {
    return <div>Loading appointments...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Appointments Management</h2>
      
      {!appointments || appointments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No appointments yet</h3>
            <p className="text-gray-600">
              Clients will be able to book appointments with you through your booking system.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {appointments.map((appointment) => (
            <AppointmentCard 
              key={appointment.id}
              appointment={appointment}
              onStatusUpdate={handleStatusUpdate}
              getStatusColor={getStatusColor}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const AppointmentCard = ({ appointment, onStatusUpdate, getStatusColor }: any) => {
  const { canInteract } = useProviderClientInteraction(appointment.client_id);

  return (
    <BlurredContent
      isBlurred={!canInteract}
      title="Client Limit Reached"
      description="You've reached your subscription limit. Upgrade to interact with more clients."
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{appointment.title}</CardTitle>
            <Badge className={getStatusColor(appointment.status)}>
              {appointment.status}
            </Badge>
          </div>
          <div className="text-sm text-gray-600">
            {appointment.clients?.first_name} {appointment.clients?.last_name}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4" />
            <span>{format(new Date(appointment.appointment_date), 'PPP')}</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>{appointment.start_time} - {appointment.end_time}</span>
          </div>
          {appointment.appointment_type === 'online' ? (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Video className="h-4 w-4" />
              <span>Online Meeting</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4" />
              <span>{appointment.location || 'In-person'}</span>
            </div>
          )}
          {appointment.description && (
            <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
              {appointment.description}
            </p>
          )}
          
          {appointment.status === 'pending' && (
            <div className={`flex space-x-2 pt-2 ${!canInteract ? 'opacity-50 pointer-events-none' : ''}`}>
              <Button 
                size="sm" 
                onClick={() => onStatusUpdate(appointment.id, 'confirmed')}
                className="flex-1"
                disabled={!canInteract}
              >
                <Check className="h-4 w-4 mr-1" />
                Accept
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onStatusUpdate(appointment.id, 'cancelled')}
                disabled={!canInteract}
              >
                <X className="h-4 w-4 mr-1" />
                Decline
              </Button>
            </div>
          )}
          
          {appointment.status === 'confirmed' && (
            <div className={`flex space-x-2 pt-2 ${!canInteract ? 'opacity-50 pointer-events-none' : ''}`}>
              <Button 
                size="sm" 
                onClick={() => onStatusUpdate(appointment.id, 'completed')}
                className="flex-1"
                disabled={!canInteract}
              >
                Mark Complete
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </BlurredContent>
  );
};

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Calendar, Clock, MapPin, User, Video, Trash2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { BlurredContent } from '@/components/BlurredContent';
import { useProviderClientInteraction } from '@/hooks/useSubscriptionLimits';

interface AppointmentsManagementProps {
  providerId: string;
}

export const AppointmentsManagement = ({ providerId }: AppointmentsManagementProps) => {
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [status, setStatus] = useState<string>('pending');
  const queryClient = useQueryClient();

  const updateAppointmentStatus = async (appointmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId);

      if (error) throw error;

      toast({
        title: "Appointment updated",
        description: "Appointment status has been updated successfully.",
      });

      queryClient.invalidateQueries({ queryKey: ['appointments', providerId] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteAppointmentMutation = useMutation(
    async (appointmentId: string) => {
      const { data, error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId);

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['appointments', providerId] });
        toast({
          title: "Appointment deleted",
          description: "Appointment has been deleted successfully.",
        });
      },
      onError: (error: any) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      },
    }
  );

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments', providerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select(`
          *,
          clients(first_name, last_name, email)
        `)
        .eq('provider_id', providerId)
        .order('appointment_date', { ascending: true })
        .order('start_time', { ascending: true });
      return data || [];
    },
  });

  const openAppointmentDialog = (appointment: any) => {
    setSelectedAppointment(appointment);
    setStatus(appointment.status || 'pending');
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading appointments...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Appointments</h2>
        <div className="text-sm text-gray-600">
          {appointments?.length || 0} total appointments
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {appointments?.map((appointment) => {
          const isOverdue = new Date(appointment.appointment_date) < new Date() && appointment.status === 'pending';
          
          return (
            <AppointmentCard 
              key={appointment.id} 
              appointment={appointment} 
              isOverdue={isOverdue}
              onUpdateStatus={updateAppointmentStatus}
              onDelete={deleteAppointmentMutation.mutate}
            />
          );
        })}
      </div>

      {appointments?.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No appointments scheduled</h3>
            <p className="text-gray-600 mb-4">
              Schedule appointments to connect with your clients
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const AppointmentCard = ({ appointment, isOverdue, onUpdateStatus, onDelete }: any) => {
  const { canInteract } = useProviderClientInteraction(appointment.client_id);

  return (
    <BlurredContent
      isBlurred={!canInteract}
      title="Client Limit Reached"
      description="Upgrade your plan to manage appointments with more clients."
    >
      <Card className={`hover:shadow-md transition-shadow ${isOverdue ? 'border-red-200 bg-red-50' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-gray-500" />
              <CardTitle className="text-lg">
                {appointment.title}
              </CardTitle>
            </div>
            {isOverdue && (
              <Badge variant="destructive">Overdue</Badge>
            )}
            {appointment.status !== 'pending' && (
              <Badge className={appointment.status === 'confirmed' ? 'bg-green-500' : 'bg-gray-500'}>
                {appointment.status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-gray-600">
            <Clock className="h-4 w-4 inline-block mr-1" />
            {new Date(`${appointment.appointment_date}T${appointment.start_time}`).toLocaleTimeString()} -{' '}
            {new Date(`${appointment.appointment_date}T${appointment.end_time}`).toLocaleTimeString()}
          </p>
          <p className="text-sm text-gray-600">
            <User className="h-4 w-4 inline-block mr-1" />
            {appointment.clients?.first_name} {appointment.clients?.last_name}
          </p>
          <p className="text-sm text-gray-600">
            <MapPin className="h-4 w-4 inline-block mr-1" />
            {appointment.location}
          </p>
          <div className="flex space-x-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpdateStatus(appointment.id, 'confirmed')}
              disabled={appointment.status !== 'pending'}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Confirm
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpdateStatus(appointment.id, 'cancelled')}
              disabled={appointment.status !== 'pending'}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(appointment.id)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </BlurredContent>
  );
};

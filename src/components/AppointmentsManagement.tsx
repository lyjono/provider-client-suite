
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Plus } from 'lucide-react';

interface AppointmentsManagementProps {
  providerId: string;
}

export const AppointmentsManagement = ({ providerId }: AppointmentsManagementProps) => {
  // Fetch appointments
  const { data: appointments, isLoading } = useQuery({
    queryKey: ['provider-appointments', providerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select(`
          *,
          clients(first_name, last_name, email)
        `)
        .eq('provider_id', providerId)
        .order('appointment_date');
      return data || [];
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading appointments...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Appointment Management</h2>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Availability
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Today's Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Advanced scheduling system coming soon.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <p className="text-gray-600">No appointments scheduled</p>
            ) : (
              <div className="space-y-3">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="font-medium">{appointment.title}</p>
                      <p className="text-sm text-gray-600">
                        {appointment.clients?.first_name} {appointment.clients?.last_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {appointment.appointment_date} at {appointment.start_time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

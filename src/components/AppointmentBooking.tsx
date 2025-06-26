
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock } from 'lucide-react';

interface AppointmentBookingProps {
  clientId: string;
  providerId: string;
}

export const AppointmentBooking = ({ clientId, providerId }: AppointmentBookingProps) => {
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Fetch upcoming appointments
  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('client_id', clientId)
        .gte('appointment_date', new Date().toISOString().split('T')[0])
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
        <h2 className="text-2xl font-bold">Book Appointment</h2>
        <Button>
          <Calendar className="h-4 w-4 mr-2" />
          New Appointment
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Available Times</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Appointment booking system coming soon. Your provider will contact you to schedule appointments.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <p className="text-gray-600">No upcoming appointments</p>
            ) : (
              <div className="space-y-3">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">{appointment.title}</p>
                      <p className="text-sm text-gray-600">
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

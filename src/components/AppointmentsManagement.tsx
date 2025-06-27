
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, Video, MapPin, Settings } from 'lucide-react';
import { AvailabilityManagement } from '@/components/AvailabilityManagement';
import { VideoCallButton } from '@/components/VideoCallButton';

interface AppointmentsManagementProps {
  providerId: string;
}

export const AppointmentsManagement = ({ providerId }: AppointmentsManagementProps) => {
  const [activeTab, setActiveTab] = useState('appointments');

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
        .order('appointment_date')
        .order('start_time');
      return data || [];
    },
  });

  const formatAppointmentTime = (date: string, time: string) => {
    const appointmentDate = new Date(`${date}T${time}`);
    return appointmentDate.toLocaleString();
  };

  const getClientName = (appointment: any) => {
    return `${appointment.clients?.first_name} ${appointment.clients?.last_name}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading appointments...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Appointment Management</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="appointments" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Appointments</span>
          </TabsTrigger>
          <TabsTrigger value="availability" className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Availability</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appointments">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Today's Appointments</CardTitle>
              </CardHeader>
              <CardContent>
                {appointments.filter(apt => apt.appointment_date === new Date().toISOString().split('T')[0]).length === 0 ? (
                  <p className="text-gray-600">No appointments today</p>
                ) : (
                  <div className="space-y-3">
                    {appointments
                      .filter(apt => apt.appointment_date === new Date().toISOString().split('T')[0])
                      .map((appointment) => (
                        <div key={appointment.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{appointment.title}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(appointment.status)}`}>
                              {appointment.status}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Clock className="h-4 w-4" />
                            <span>{appointment.start_time} - {appointment.end_time}</span>
                          </div>
                          
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            {appointment.appointment_type === 'online' ? (
                              <Video className="h-4 w-4" />
                            ) : (
                              <MapPin className="h-4 w-4" />
                            )}
                            <span>
                              {appointment.appointment_type === 'online' ? 'Video Call' : appointment.location}
                            </span>
                          </div>

                          <p className="text-sm text-gray-600">
                            with {getClientName(appointment)}
                          </p>

                          {appointment.appointment_type === 'online' && appointment.video_call_link && appointment.video_call_link.startsWith('room-') && (
                            <div className="pt-2">
                              <VideoCallButton
                                roomId={appointment.video_call_link}
                                userId={providerId}
                                disabled={appointment.status !== 'confirmed'}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
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
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {appointments.map((appointment) => (
                      <div key={appointment.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">{appointment.title}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(appointment.status)}`}>
                            {appointment.status}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          <span>{formatAppointmentTime(appointment.appointment_date, appointment.start_time)}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          {appointment.appointment_type === 'online' ? (
                            <Video className="h-4 w-4" />
                          ) : (
                            <MapPin className="h-4 w-4" />
                          )}
                          <span>
                            {appointment.appointment_type === 'online' ? 'Video Call' : appointment.location}
                          </span>
                        </div>

                        <p className="text-sm text-gray-600">
                          with {getClientName(appointment)}
                        </p>

                        {appointment.appointment_type === 'online' && appointment.video_call_link && appointment.video_call_link.startsWith('room-') && (
                          <div className="pt-1">
                            <VideoCallButton
                              roomId={appointment.video_call_link}
                              userId={providerId}
                              disabled={appointment.status !== 'confirmed'}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="availability">
          <AvailabilityManagement providerId={providerId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Clock, Video, MapPin, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { VideoCallButton } from '@/components/VideoCallButton';

interface AppointmentSchedulingProps {
  clientId: string;
  providerId: string;
}

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export const AppointmentScheduling = ({ clientId, providerId }: AppointmentSchedulingProps) => {
  const queryClient = useQueryClient();
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [appointmentType, setAppointmentType] = useState<'online' | 'in_person'>('online');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');

  // Fetch provider's availability
  const { data: availabilitySlots } = useQuery({
    queryKey: ['availability-slots', providerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('provider_id', providerId)
        .eq('is_active', true)
        .order('day_of_week')
        .order('start_time');
      return data || [];
    },
  });

  // Fetch upcoming appointments
  const { data: appointments, isLoading } = useQuery({
    queryKey: ['client-appointments', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select(`
          *,
          providers(first_name, last_name, company_name)
        `)
        .eq('client_id', clientId)
        .gte('appointment_date', new Date().toISOString().split('T')[0])
        .order('appointment_date')
        .order('start_time');
      return data || [];
    },
  });

  // Book appointment mutation
  const bookAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      const { data, error } = await supabase
        .from('appointments')
        .insert([{
          client_id: clientId,
          provider_id: providerId,
          title: appointmentData.title,
          description: appointmentData.description,
          appointment_date: appointmentData.appointment_date,
          start_time: appointmentData.start_time,
          end_time: appointmentData.end_time,
          appointment_type: appointmentData.appointment_type,
          location: appointmentData.location || null,
          status: 'pending'
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-appointments'] });
      setIsBookingDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Appointment booked successfully! Your provider will confirm it soon.",
      });
    },
    onError: (error) => {
      console.error('Booking error:', error);
      toast({
        title: "Error",
        description: "Failed to book appointment",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedDate('');
    setSelectedTime('');
    setAppointmentType('online');
    setTitle('');
    setDescription('');
    setLocation('');
  };

  const handleBookAppointment = () => {
    if (!selectedDate || !selectedTime || !title) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (appointmentType === 'in_person' && !location) {
      toast({
        title: "Error",
        description: "Please provide a location for in-person appointments",
        variant: "destructive",
      });
      return;
    }

    // Calculate end time (assuming 1 hour duration for now)
    const startTime = new Date(`2000-01-01T${selectedTime}`);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    const endTimeString = endTime.toTimeString().split(' ')[0].substring(0, 5);

    bookAppointmentMutation.mutate({
      title,
      description,
      appointment_date: selectedDate,
      start_time: selectedTime,
      end_time: endTimeString,
      appointment_type: appointmentType,
      location: appointmentType === 'in_person' ? location : null
    });
  };

  const getAvailableTimesForDate = (date: string) => {
    const selectedDateObj = new Date(date);
    const dayOfWeek = selectedDateObj.getDay();
    
    const slotsForDay = availabilitySlots?.filter(slot => slot.day_of_week === dayOfWeek) || [];
    
    // Generate time slots based on availability
    const timeSlots: string[] = [];
    slotsForDay.forEach(slot => {
      const start = new Date(`2000-01-01T${slot.start_time}`);
      const end = new Date(`2000-01-01T${slot.end_time}`);
      const duration = slot.slot_duration_minutes || 60;
      
      while (start < end) {
        timeSlots.push(start.toTimeString().split(' ')[0].substring(0, 5));
        start.setMinutes(start.getMinutes() + duration);
      }
    });
    
    return timeSlots;
  };

  const formatAppointmentTime = (date: string, time: string) => {
    const appointmentDate = new Date(`${date}T${time}`);
    return appointmentDate.toLocaleString();
  };

  const getProviderName = (appointment: any) => {
    return appointment.providers?.company_name || 
           `${appointment.providers?.first_name} ${appointment.providers?.last_name}`;
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading appointments...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Schedule Appointment</h2>
        <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Book Appointment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Book New Appointment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title *</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Consultation, Follow-up, etc."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Date *</label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {selectedDate && (
                <div>
                  <label className="block text-sm font-medium mb-2">Time *</label>
                  <Select value={selectedTime} onValueChange={setSelectedTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableTimesForDate(selectedDate).map((time) => (
                        <SelectItem key={time} value={time}>
                          {new Date(`2000-01-01T${time}`).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Type *</label>
                <Select value={appointmentType} onValueChange={(value: 'online' | 'in_person') => setAppointmentType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online Video Call</SelectItem>
                    <SelectItem value="in_person">In Person</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {appointmentType === 'in_person' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Location *</label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Meeting location"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional details about the appointment"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsBookingDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleBookAppointment} 
                  disabled={bookAppointmentMutation.isPending}
                >
                  {bookAppointmentMutation.isPending ? 'Booking...' : 'Book Appointment'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <p className="text-gray-600">No upcoming appointments</p>
            ) : (
              <div className="space-y-4">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{appointment.title}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        appointment.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
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

                    {appointment.appointment_type === 'online' && appointment.video_call_link && (
                      <div className="pt-2">
                        <VideoCallButton
                          roomId={appointment.video_call_link}
                          userId={clientId}
                          disabled={appointment.status !== 'confirmed'}
                        />
                      </div>
                    )}

                    <p className="text-sm text-gray-600">
                      with {getProviderName(appointment)}
                    </p>
                    
                    {appointment.description && (
                      <p className="text-sm text-gray-600">{appointment.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Provider Availability</CardTitle>
          </CardHeader>
          <CardContent>
            {!availabilitySlots || availabilitySlots.length === 0 ? (
              <p className="text-gray-600">No availability information available</p>
            ) : (
              <div className="space-y-3">
                {availabilitySlots.map((slot) => (
                  <div key={slot.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium">{DAYS_OF_WEEK[slot.day_of_week]}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(`2000-01-01T${slot.start_time}`).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })} - {new Date(`2000-01-01T${slot.end_time}`).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {slot.slot_duration_minutes} min slots
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

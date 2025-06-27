
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Clock, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AvailabilityManagementProps {
  providerId: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
];

export const AvailabilityManagement = ({ providerId }: AvailabilityManagementProps) => {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [slotDuration, setSlotDuration] = useState('60');

  // Fetch availability slots
  const { data: availabilitySlots, isLoading } = useQuery({
    queryKey: ['availability-slots', providerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('provider_id', providerId)
        .order('day_of_week')
        .order('start_time');
      return data || [];
    },
  });

  // Add availability slot mutation
  const addSlotMutation = useMutation({
    mutationFn: async (slotData: any) => {
      const { data, error } = await supabase
        .from('availability_slots')
        .insert([{
          provider_id: providerId,
          day_of_week: parseInt(slotData.day_of_week),
          start_time: slotData.start_time,
          end_time: slotData.end_time,
          slot_duration_minutes: parseInt(slotData.slot_duration_minutes),
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      setIsAddDialogOpen(false);
      setSelectedDay('');
      setStartTime('09:00');
      setEndTime('17:00');
      setSlotDuration('60');
      toast({
        title: "Success",
        description: "Availability slot added successfully",
      });
    },
    onError: (error) => {
      console.error('Add slot error:', error);
      toast({
        title: "Error",
        description: "Failed to add availability slot",
        variant: "destructive",
      });
    },
  });

  // Delete availability slot mutation
  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const { error } = await supabase
        .from('availability_slots')
        .delete()
        .eq('id', slotId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability-slots'] });
      toast({
        title: "Success",
        description: "Availability slot deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Delete slot error:', error);
      toast({
        title: "Error",
        description: "Failed to delete availability slot",
        variant: "destructive",
      });
    },
  });

  const handleAddSlot = () => {
    if (!selectedDay || !startTime || !endTime || !slotDuration) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (startTime >= endTime) {
      toast({
        title: "Error",
        description: "End time must be after start time",
        variant: "destructive",
      });
      return;
    }

    addSlotMutation.mutate({
      day_of_week: selectedDay,
      start_time: startTime,
      end_time: endTime,
      slot_duration_minutes: slotDuration
    });
  };

  const handleDeleteSlot = (slotId: string) => {
    if (window.confirm('Are you sure you want to delete this availability slot?')) {
      deleteSlotMutation.mutate(slotId);
    }
  };

  const getDayName = (dayNumber: number) => {
    return DAYS_OF_WEEK.find(day => day.value === dayNumber)?.label || 'Unknown';
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading availability...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Availability Management</h2>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Availability
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Availability Slot</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Day of Week</label>
                <Select value={selectedDay} onValueChange={setSelectedDay}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={day.value.toString()}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Start Time</label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">End Time</label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Slot Duration (minutes)</label>
                <Select value={slotDuration} onValueChange={setSlotDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                    <SelectItem value="90">90 minutes</SelectItem>
                    <SelectItem value="120">120 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddSlot} 
                  disabled={addSlotMutation.isPending}
                >
                  {addSlotMutation.isPending ? 'Adding...' : 'Add Slot'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {availabilitySlots.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No availability set</h3>
            <p className="text-gray-600 mb-4">
              Add your availability slots so clients can book appointments with you
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Availability
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availabilitySlots.map((slot) => (
            <Card key={slot.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{getDayName(slot.day_of_week)}</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDeleteSlot(slot.id)}
                    disabled={deleteSlotMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  Duration: {slot.slot_duration_minutes} minutes
                </div>
                <div className="text-sm">
                  <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                    slot.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {slot.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

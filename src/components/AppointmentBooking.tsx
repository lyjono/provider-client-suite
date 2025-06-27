
import { AppointmentScheduling } from '@/components/AppointmentScheduling';

interface AppointmentBookingProps {
  clientId: string;
  providerId: string;
}

export const AppointmentBooking = ({ clientId, providerId }: AppointmentBookingProps) => {
  return <AppointmentScheduling clientId={clientId} providerId={providerId} />;
};

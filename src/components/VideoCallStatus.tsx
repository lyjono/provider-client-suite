
import { Card, CardContent } from '@/components/ui/card';

interface VideoCallStatusProps {
  isConnecting: boolean;
  isConnected: boolean;
  permissionsError: string | null;
}

export const VideoCallStatus = ({ isConnecting, isConnected, permissionsError }: VideoCallStatusProps) => {
  return (
    <>
      {/* Connection status */}
      <div className="absolute top-4 left-4">
        <Card className="bg-black/50 text-white border-none">
          <CardContent className="p-2">
            <span className="text-sm">
              {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Waiting for connection'}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Permissions error */}
      {permissionsError && (
        <div className="absolute top-4 right-4 max-w-md">
          <Card className="bg-red-500/80 text-white border-none">
            <CardContent className="p-3">
              <p className="text-sm">{permissionsError}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Connecting overlay */}
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
          <div className="text-center">
            <p className="text-xl mb-2">Connecting to call...</p>
            <p className="text-sm text-slate-300">Waiting for peer connection</p>
          </div>
        </div>
      )}
    </>
  );
};

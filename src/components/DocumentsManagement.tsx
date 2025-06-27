
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, Download, Trash2, Plus, Eye, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useProviderClientInteraction } from '@/hooks/useSubscriptionLimits';
import { BlurredContent } from '@/components/BlurredContent';

interface DocumentsManagementProps {
  providerId: string;
}

export const DocumentsManagement = ({ providerId }: DocumentsManagementProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');

  // Fetch clients for the provider
  const { data: clients } = useQuery({
    queryKey: ['clients', providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, first_name, last_name, email')
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch shared documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ['shared-documents', providerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_documents')
        .select(`
          *,
          clients(first_name, last_name, email)
        `)
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, clientId, description }: { file: File; clientId: string; description: string }) => {
      if (!user) throw new Error('User not authenticated');

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${providerId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('shared-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('shared-documents')
        .getPublicUrl(filePath);

      // Save document record
      const { data, error } = await supabase
        .from('shared_documents')
        .insert({
          provider_id: providerId,
          client_id: clientId,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          file_size: file.size,
          description: description || null,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-documents', providerId] });
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      setDescription('');
      setSelectedClientId('');
      toast({
        title: "Document uploaded successfully",
        description: "The document has been shared with the client.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error uploading document",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase
        .from('shared_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-documents', providerId] });
      toast({
        title: "Document deleted",
        description: "The document has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting document",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !selectedClientId) {
      toast({
        title: "Missing information",
        description: "Please select a file and client.",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({
      file: selectedFile,
      clientId: selectedClientId,
      description,
    });
  };

  const handleDelete = (documentId: string) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      deleteMutation.mutate(documentId);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return <div>Loading documents...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Documents Management</h2>
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select Client</label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.first_name} {client.last_name} ({client.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Select File</label>
                <Input
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                />
                {selectedFile && (
                  <p className="text-sm text-gray-600 mt-1">
                    Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Description (Optional)</label>
                <Textarea
                  placeholder="Add a description for this document..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={uploadMutation.isPending}>
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!documents || documents.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No documents shared yet</h3>
            <p className="text-gray-600">
              Upload documents to share them with your clients.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((document) => (
            <DocumentCard 
              key={document.id}
              document={document}
              onDelete={handleDelete}
              formatFileSize={formatFileSize}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const DocumentCard = ({ document, onDelete, formatFileSize }: any) => {
  const { canInteract } = useProviderClientInteraction(document.client_id);

  return (
    <BlurredContent
      isBlurred={!canInteract}
      title="Client Limit Reached"
      description="You've reached your subscription limit. Upgrade to interact with more clients."
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{document.file_name}</CardTitle>
              <div className="text-sm text-gray-600">
                Shared with: {document.clients?.first_name} {document.clients?.last_name}
              </div>
            </div>
            <Badge variant="secondary" className="ml-2">
              {document.file_type?.split('/')[1]?.toUpperCase() || 'FILE'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {document.description && (
            <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
              {document.description}
            </p>
          )}
          <div className="text-xs text-gray-500">
            Size: {formatFileSize(document.file_size || 0)}
          </div>
          <div className="text-xs text-gray-500">
            Uploaded: {new Date(document.created_at).toLocaleDateString()}
          </div>
          
          <div className={`flex space-x-2 pt-2 ${!canInteract ? 'opacity-50 pointer-events-none' : ''}`}>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => window.open(document.file_url, '_blank')}
              className="flex-1"
              disabled={!canInteract}
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => {
                const link = document.createElement('a');
                link.href = document.file_url;
                link.download = document.file_name;
                link.click();
              }}
              disabled={!canInteract}
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => onDelete(document.id)}
              disabled={!canInteract}
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

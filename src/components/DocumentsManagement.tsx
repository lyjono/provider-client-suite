
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Upload, Download, Trash2, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface DocumentsManagementProps {
  userType: 'provider' | 'client';
  userId: string;
}

export const DocumentsManagement = ({ userType, userId }: DocumentsManagementProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');

  // Get conversation ID for file organization
  const { data: conversation } = useQuery({
    queryKey: ['conversation-for-documents', userId, userType],
    queryFn: async () => {
      if (userType === 'provider') {
        // For providers, get any conversation they're part of (we'll use the first one for demo)
        const { data } = await supabase
          .from('conversations')
          .select('*')
          .eq('provider_id', userId)
          .limit(1);
        return data?.[0] || null;
      } else {
        // For clients, get their conversation
        const { data } = await supabase
          .from('conversations')
          .select('*')
          .eq('client_id', userId)
          .limit(1);
        return data?.[0] || null;
      }
    },
  });

  // Fetch shared documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', userId, userType],
    queryFn: async () => {
      const column = userType === 'provider' ? 'provider_id' : 'client_id';
      const { data } = await supabase
        .from('shared_documents')
        .select(`
          *,
          providers(first_name, last_name, company_name),
          clients(first_name, last_name)
        `)
        .eq(column, userId)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, description }: { file: File; description: string }) => {
      if (!conversation || !user) throw new Error('No conversation or user found');

      // Create file path: conversation_id/timestamp_filename
      const timestamp = Date.now();
      const filePath = `${conversation.id}/${timestamp}_${file.name}`;

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('shared-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('shared-documents')
        .getPublicUrl(filePath);

      // Create database record
      const documentData = {
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
        description,
        uploaded_by: user.id,
        ...(userType === 'provider' 
          ? { provider_id: userId, client_id: conversation.client_id }
          : { client_id: userId, provider_id: conversation.provider_id }
        )
      };

      const { data, error } = await supabase
        .from('shared_documents')
        .insert([documentData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setFile(null);
      setDescription('');
      setIsUploadDialogOpen(false);
      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast({
        title: "Error",
        description: "Failed to upload document",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (document: any) => {
      // Extract file path from URL
      const url = new URL(document.file_url);
      const filePath = url.pathname.split('/shared-documents/')[1];

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('shared-documents')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('shared_documents')
        .delete()
        .eq('id', document.id);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({
        title: "Success",
        description: "Document deleted successfully",
      });
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  const handleUpload = () => {
    if (!file) return;
    uploadMutation.mutate({ file, description });
  };

  const handleDownload = (document: any) => {
    window.open(document.file_url, '_blank');
  };

  const handleDelete = (document: any) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      deleteMutation.mutate(document);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const canDelete = (document: any) => {
    return document.uploaded_by === user?.id;
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading documents...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Document Management</h2>
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select File</label>
                <Input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description (optional)</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description for this document..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpload} 
                  disabled={!file || uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {documents.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
              <p className="text-gray-600 mb-4">
                Upload and share documents securely with your {userType === 'provider' ? 'clients' : 'provider'}
              </p>
              <Button onClick={() => setIsUploadDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload First Document
              </Button>
            </CardContent>
          </Card>
        ) : (
          documents.map((document) => (
            <Card key={document.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg truncate" title={document.file_name}>
                    {document.file_name}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {document.description && (
                  <p className="text-sm text-gray-600">{document.description}</p>
                )}
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Size: {formatFileSize(document.file_size || 0)}</p>
                  <p>Uploaded {new Date(document.created_at).toLocaleDateString()}</p>
                  <p>
                    By: {document.uploaded_by === user?.id ? 'You' : 
                         (userType === 'provider' ? 'Client' : 'Provider')}
                  </p>
                </div>
                <div className="flex space-x-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDownload(document)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(document.file_url, '_blank')}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  {canDelete(document) && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDelete(document)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Upload, Download, Trash2, Eye, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { BlurredContent } from '@/components/BlurredContent';
import { useProviderClientInteraction } from '@/hooks/useSubscriptionLimits';

interface DocumentsManagementProps {
  userType: 'provider' | 'client';
  userId: string;
  targetClientId?: string; // Optional - for provider viewing specific client's documents
}

interface RelationshipOption {
  id: string;
  label: string;
  conversationId: string;
}

export const DocumentsManagement = ({ userType, userId, targetClientId }: DocumentsManagementProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [selectedRelationship, setSelectedRelationship] = useState<string>('all');

  // Get all relationships for this user
  const { data: relationships } = useQuery({
    queryKey: ['relationships', userId, userType, targetClientId],
    queryFn: async () => {
      if (userType === 'provider') {
        // For providers, get all conversations with client info
        let query = supabase
          .from('conversations')
          .select(`
            id,
            client_id,
            clients(first_name, last_name)
          `)
          .eq('provider_id', userId);

        // If targetClientId is provided, filter for specific client
        if (targetClientId) {
          query = query.eq('client_id', targetClientId);
        }
        
        const { data } = await query;
        
        return data?.map(conv => ({
          id: conv.id,
          label: `${conv.clients?.first_name} ${conv.clients?.last_name}`,
          conversationId: conv.id
        })) || [];
      } else {
        // For clients, get the client record first, then find conversations
        const { data: clientRecord } = await supabase
          .from('clients')
          .select('*')
          .eq('id', userId)
          .single();

        if (!clientRecord || !clientRecord.provider_id) {
          return [];
        }

        // Get conversation with provider info
        const { data } = await supabase
          .from('conversations')
          .select(`
            id,
            provider_id,
            providers(first_name, last_name, company_name)
          `)
          .eq('client_id', userId)
          .eq('provider_id', clientRecord.provider_id);
        
        return data?.map(conv => ({
          id: conv.id,
          label: conv.providers?.company_name || 
                 `${conv.providers?.first_name} ${conv.providers?.last_name}`,
          conversationId: conv.id
        })) || [];
      }
    },
  });

  // Auto-select the first (and likely only) relationship when targetClientId is provided
  const effectiveSelectedRelationship = targetClientId && relationships?.length === 1 
    ? relationships[0].id 
    : selectedRelationship;

  // Get conversation for upload (based on selected relationship)
  const { data: selectedConversation } = useQuery({
    queryKey: ['selected-conversation', effectiveSelectedRelationship, relationships],
    queryFn: async () => {
      if (!relationships || relationships.length === 0) return null;
      
      if (effectiveSelectedRelationship === 'all' || !effectiveSelectedRelationship) {
        return relationships[0] || null;
      }
      return relationships.find(r => r.id === effectiveSelectedRelationship) || null;
    },
    enabled: !!relationships && relationships.length > 0,
  });

  const { canInteract } = useProviderClientInteraction(targetClientId);

  // Fetch shared documents with relationship filtering
  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', userId, userType, effectiveSelectedRelationship, targetClientId],
    queryFn: async () => {
      let query = supabase
        .from('shared_documents')
        .select(`
          *,
          providers(first_name, last_name, company_name),
          clients(first_name, last_name)
        `);

      // Apply filters based on user type and selected relationship
      if (userType === 'provider') {
        query = query.eq('provider_id', userId);
        
        // If targetClientId is provided, filter for specific client
        if (targetClientId) {
          query = query.eq('client_id', targetClientId);
        } else if (effectiveSelectedRelationship !== 'all') {
          // Filter by specific conversation (need to join with conversations)
          const { data: conversationData } = await supabase
            .from('conversations')
            .select('client_id')
            .eq('id', effectiveSelectedRelationship)
            .single();
          
          if (conversationData) {
            query = query.eq('client_id', conversationData.client_id);
          }
        }
      } else {
        query = query.eq('client_id', userId);
        if (effectiveSelectedRelationship !== 'all') {
          // Filter by specific conversation
          const { data: conversationData } = await supabase
            .from('conversations')
            .select('provider_id')
            .eq('id', effectiveSelectedRelationship)
            .single();
          
          if (conversationData) {
            query = query.eq('provider_id', conversationData.provider_id);
          }
        }
      }

      const { data } = await query.order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!relationships,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, description }: { file: File; description: string }) => {
      if (!selectedConversation || !user) throw new Error('No conversation or user found');

      // Create file path: conversation_id/timestamp_filename
      const timestamp = Date.now();
      const filePath = `${selectedConversation.conversationId}/${timestamp}_${file.name}`;

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('shared-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('shared-documents')
        .getPublicUrl(filePath);

      // Get conversation details to determine client and provider IDs
      const { data: conversation } = await supabase
        .from('conversations')
        .select('client_id, provider_id')
        .eq('id', selectedConversation.conversationId)
        .single();

      if (!conversation) throw new Error('Conversation not found');

      // Create database record
      const documentData = {
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
        description,
        uploaded_by: user.id,
        provider_id: conversation.provider_id,
        client_id: conversation.client_id
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

  const getRelationshipContext = (document: any) => {
    if (userType === 'provider') {
      return `Shared with ${document.clients?.first_name} ${document.clients?.last_name}`;
    } else {
      return `Shared by ${document.providers?.company_name || 
        `${document.providers?.first_name} ${document.providers?.last_name}`}`;
    }
  };

  // Get the current client name for display when targetClientId is provided
  const getCurrentClientName = () => {
    if (!targetClientId || !relationships || relationships.length === 0) return null;
    return relationships[0]?.label;
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading documents...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Document Management</h2>
        <div className="flex items-center space-x-4">
          {/* Only show relationship selector if no targetClientId and multiple relationships */}
          {!targetClientId && relationships && relationships.length > 1 && (
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-gray-600" />
              <Select value={selectedRelationship} onValueChange={setSelectedRelationship}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Relationships</SelectItem>
                  {relationships.map((rel) => (
                    <SelectItem key={rel.id} value={rel.id}>
                      {rel.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!selectedConversation}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
                {selectedConversation && (
                  <p className="text-sm text-gray-600">
                    Uploading to: {selectedConversation.label}
                  </p>
                )}
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
      </div>

      {/* Show current client context when filtering by targetClientId */}
      {targetClientId && getCurrentClientName() && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            Viewing documents for: <strong>{getCurrentClientName()}</strong>
          </p>
        </div>
      )}

      {/* Show relationship filter context when not using targetClientId */}
      {!targetClientId && effectiveSelectedRelationship !== 'all' && relationships && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            Showing documents for: <strong>
              {relationships.find(r => r.id === effectiveSelectedRelationship)?.label}
            </strong>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {documents?.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
              <p className="text-gray-600 mb-4">
                Upload and share documents securely with your {userType === 'provider' ? 'clients' : 'provider'}
              </p>
              <Button 
                onClick={() => setIsUploadDialogOpen(true)}
                disabled={!selectedConversation}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload First Document
              </Button>
            </CardContent>
          </Card>
        ) : (
          documents?.map((document) => (
            <DocumentCard 
              key={document.id}
              document={document}
              userType={userType}
              canInteract={canInteract}
              onDownload={handleDownload}
              onDelete={handleDelete}
              canDelete={canDelete(document)}
              getRelationshipContext={getRelationshipContext}
            />
          ))
        )}
      </div>
    </div>
  );
};

const DocumentCard = ({ document, userType, canInteract, onDownload, onDelete, canDelete, getRelationshipContext }: any) => {
  const shouldBlur = userType === 'provider' && !canInteract;

  return (
    <BlurredContent
      isBlurred={shouldBlur}
      title="Client Limit Reached"
      description="Upgrade your plan to access documents from more clients."
    >
      <Card className="hover:shadow-md transition-shadow">
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
            {!targetClientId && effectiveSelectedRelationship === 'all' && relationships && relationships.length > 1 && (
              <p className="text-blue-600 font-medium">
                {getRelationshipContext(document)}
              </p>
            )}
          </div>
          <div className={`flex space-x-2 pt-2 ${shouldBlur ? 'opacity-50 pointer-events-none' : ''}`}>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onDownload(document)}
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
                onClick={() => onDelete(document)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </BlurredContent>
  );
};

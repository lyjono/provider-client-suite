
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Upload, Download } from 'lucide-react';

interface DocumentsManagementProps {
  userType: 'provider' | 'client';
  userId: string;
}

export const DocumentsManagement = ({ userType, userId }: DocumentsManagementProps) => {
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

  if (isLoading) {
    return <div className="text-center py-8">Loading documents...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Document Management</h2>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
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
              <Button>
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
                  <CardTitle className="text-lg truncate">{document.file_name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {document.description && (
                  <p className="text-sm text-gray-600">{document.description}</p>
                )}
                <p className="text-xs text-gray-500">
                  Uploaded {new Date(document.created_at).toLocaleDateString()}
                </p>
                <div className="flex space-x-2 pt-2">
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

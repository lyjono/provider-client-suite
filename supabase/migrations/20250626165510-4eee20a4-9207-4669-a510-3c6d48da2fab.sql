
-- Create a storage bucket for shared documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('shared-documents', 'shared-documents', true);

-- Create RLS policies for the shared documents bucket
CREATE POLICY "Users can view shared documents" ON storage.objects
FOR SELECT USING (
  bucket_id = 'shared-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT CAST(c.id AS TEXT) FROM conversations c
    LEFT JOIN providers p ON c.provider_id = p.id
    LEFT JOIN clients cl ON c.client_id = cl.id
    WHERE (p.user_id = auth.uid()) OR (cl.user_id = auth.uid())
  )
);

CREATE POLICY "Users can upload shared documents" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'shared-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT CAST(c.id AS TEXT) FROM conversations c
    LEFT JOIN providers p ON c.provider_id = p.id
    LEFT JOIN clients cl ON c.client_id = cl.id
    WHERE (p.user_id = auth.uid()) OR (cl.user_id = auth.uid())
  )
);

CREATE POLICY "Users can delete their own shared documents" ON storage.objects
FOR DELETE USING (
  bucket_id = 'shared-documents' AND
  owner = auth.uid()
);

-- Add RLS policies for the shared_documents table
ALTER TABLE public.shared_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shared documents" ON public.shared_documents
FOR SELECT USING (
  provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()) OR
  client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
);

CREATE POLICY "Users can create shared documents" ON public.shared_documents
FOR INSERT WITH CHECK (
  provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()) OR
  client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their shared documents" ON public.shared_documents
FOR UPDATE USING (
  uploaded_by = auth.uid()
);

CREATE POLICY "Users can delete their shared documents" ON public.shared_documents
FOR DELETE USING (
  uploaded_by = auth.uid()
);

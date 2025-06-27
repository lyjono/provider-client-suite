
-- First, let's add a storage bucket for shared documents if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('shared-documents', 'shared-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Add a room_id column to appointments table for video calls
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS room_id TEXT;

-- Create a function to check if a provider can accept new clients based on their subscription tier
CREATE OR REPLACE FUNCTION check_provider_client_limit(provider_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    provider_tier provider_tier;
    current_client_count INTEGER;
    max_clients INTEGER;
BEGIN
    -- Get the provider's subscription tier
    SELECT subscription_tier INTO provider_tier
    FROM providers 
    WHERE id = provider_id;
    
    -- Count current active clients
    SELECT COUNT(*) INTO current_client_count
    FROM clients 
    WHERE provider_id = check_provider_client_limit.provider_id;
    
    -- Determine max clients based on tier
    CASE provider_tier
        WHEN 'free' THEN max_clients := 5;
        WHEN 'starter' THEN max_clients := 20;
        WHEN 'pro' THEN max_clients := 999999; -- Unlimited
        ELSE max_clients := 5; -- Default to free tier
    END CASE;
    
    RETURN current_client_count < max_clients;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if provider can interact with client (not over limit)
CREATE OR REPLACE FUNCTION can_provider_interact_with_client(provider_id UUID, client_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    provider_tier provider_tier;
    client_creation_order INTEGER;
    max_clients INTEGER;
BEGIN
    -- Get the provider's subscription tier
    SELECT subscription_tier INTO provider_tier
    FROM providers 
    WHERE id = provider_id;
    
    -- Determine max clients based on tier
    CASE provider_tier
        WHEN 'free' THEN max_clients := 5;
        WHEN 'starter' THEN max_clients := 20;
        WHEN 'pro' THEN RETURN TRUE; -- Unlimited, always allow
        ELSE max_clients := 5; -- Default to free tier
    END CASE;
    
    -- Get the creation order of this client among all clients for this provider
    SELECT COUNT(*) INTO client_creation_order
    FROM clients c1
    WHERE c1.provider_id = can_provider_interact_with_client.provider_id
    AND c1.created_at <= (
        SELECT c2.created_at 
        FROM clients c2 
        WHERE c2.id = can_provider_interact_with_client.client_id
    );
    
    -- Allow interaction if client is within the limit (first N clients)
    RETURN client_creation_order <= max_clients;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies for messages table to restrict provider interactions
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy for providers to only see messages from clients they can interact with
CREATE POLICY "providers_can_view_allowed_messages" ON messages
FOR SELECT TO authenticated
USING (
    -- Allow if user is the sender
    sender_id = auth.uid()
    OR
    -- Allow if user is a client in the conversation
    EXISTS (
        SELECT 1 FROM conversations c
        JOIN clients cl ON c.client_id = cl.id
        WHERE c.id = conversation_id 
        AND cl.user_id = auth.uid()
    )
    OR
    -- Allow if user is a provider and can interact with the client
    EXISTS (
        SELECT 1 FROM conversations c
        JOIN providers p ON c.provider_id = p.id
        WHERE c.id = conversation_id 
        AND p.user_id = auth.uid()
        AND can_provider_interact_with_client(p.id, c.client_id)
    )
);

-- Policy for inserting messages
CREATE POLICY "authenticated_users_can_insert_messages" ON messages
FOR INSERT TO authenticated
WITH CHECK (
    -- Allow clients to always send messages
    EXISTS (
        SELECT 1 FROM conversations c
        JOIN clients cl ON c.client_id = cl.id
        WHERE c.id = conversation_id 
        AND cl.user_id = auth.uid()
    )
    OR
    -- Allow providers only if they can interact with the client
    EXISTS (
        SELECT 1 FROM conversations c
        JOIN providers p ON c.provider_id = p.id
        WHERE c.id = conversation_id 
        AND p.user_id = auth.uid()
        AND can_provider_interact_with_client(p.id, c.client_id)
    )
);

-- Add RLS policies for appointments table
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policy for viewing appointments
CREATE POLICY "users_can_view_relevant_appointments" ON appointments
FOR SELECT TO authenticated
USING (
    -- Allow clients to see their appointments
    EXISTS (
        SELECT 1 FROM clients c
        WHERE c.id = client_id AND c.user_id = auth.uid()
    )
    OR
    -- Allow providers to see appointments from clients they can interact with
    EXISTS (
        SELECT 1 FROM providers p
        WHERE p.id = provider_id 
        AND p.user_id = auth.uid()
        AND can_provider_interact_with_client(p.id, appointments.client_id)
    )
);

-- Policy for updating appointments (accepting/rejecting)
CREATE POLICY "providers_can_update_allowed_appointments" ON appointments
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM providers p
        WHERE p.id = provider_id 
        AND p.user_id = auth.uid()
        AND can_provider_interact_with_client(p.id, appointments.client_id)
    )
);

-- Policy for inserting appointments
CREATE POLICY "clients_can_create_appointments" ON appointments
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM clients c
        WHERE c.id = client_id AND c.user_id = auth.uid()
    )
);

-- Add RLS policies for shared_documents table
ALTER TABLE shared_documents ENABLE ROW LEVEL SECURITY;

-- Policy for viewing shared documents
CREATE POLICY "users_can_view_relevant_documents" ON shared_documents
FOR SELECT TO authenticated
USING (
    -- Allow clients to see documents shared with them
    EXISTS (
        SELECT 1 FROM clients c
        WHERE c.id = client_id AND c.user_id = auth.uid()
    )
    OR
    -- Allow providers to see documents from clients they can interact with
    EXISTS (
        SELECT 1 FROM providers p
        WHERE p.id = provider_id 
        AND p.user_id = auth.uid()
        AND can_provider_interact_with_client(p.id, shared_documents.client_id)
    )
);

-- Policy for inserting shared documents
CREATE POLICY "users_can_upload_documents" ON shared_documents
FOR INSERT TO authenticated
WITH CHECK (
    -- Allow clients to upload documents
    EXISTS (
        SELECT 1 FROM clients c
        WHERE c.id = client_id AND c.user_id = auth.uid()
    )
    OR
    -- Allow providers to upload documents for clients they can interact with
    EXISTS (
        SELECT 1 FROM providers p
        WHERE p.id = provider_id 
        AND p.user_id = auth.uid()
        AND can_provider_interact_with_client(p.id, shared_documents.client_id)
    )
);

-- Policy for deleting shared documents
CREATE POLICY "users_can_delete_own_documents" ON shared_documents
FOR DELETE TO authenticated
USING (uploaded_by = auth.uid());

-- Add RLS policies for conversations table
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Policy for viewing conversations
CREATE POLICY "users_can_view_relevant_conversations" ON conversations
FOR SELECT TO authenticated
USING (
    -- Allow clients to see their conversations
    EXISTS (
        SELECT 1 FROM clients c
        WHERE c.id = client_id AND c.user_id = auth.uid()
    )
    OR
    -- Allow providers to see conversations with clients they can interact with
    EXISTS (
        SELECT 1 FROM providers p
        WHERE p.id = provider_id 
        AND p.user_id = auth.uid()
        AND can_provider_interact_with_client(p.id, conversations.client_id)
    )
);

-- Policy for creating conversations
CREATE POLICY "authenticated_users_can_create_conversations" ON conversations
FOR INSERT TO authenticated
WITH CHECK (
    -- Allow clients to create conversations
    EXISTS (
        SELECT 1 FROM clients c
        WHERE c.id = client_id AND c.user_id = auth.uid()
    )
    OR
    -- Allow providers to create conversations with clients they can interact with
    EXISTS (
        SELECT 1 FROM providers p
        WHERE p.id = provider_id 
        AND p.user_id = auth.uid()
        AND can_provider_interact_with_client(p.id, conversations.client_id)
    )
);

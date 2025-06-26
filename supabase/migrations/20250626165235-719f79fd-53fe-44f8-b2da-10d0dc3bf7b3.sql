
-- Drop existing policies and recreate them with correct logic
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;

-- Create a better policy for message insertion that correctly handles the user relationships
CREATE POLICY "Users can send messages in their conversations" ON public.messages
FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND
  conversation_id IN (
    SELECT c.id FROM conversations c
    LEFT JOIN providers p ON c.provider_id = p.id
    LEFT JOIN clients cl ON c.client_id = cl.id
    WHERE (p.user_id = auth.uid()) OR (cl.user_id = auth.uid())
  )
);

-- Create a better policy for message selection
CREATE POLICY "Users can view messages in their conversations" ON public.messages
FOR SELECT USING (
  conversation_id IN (
    SELECT c.id FROM conversations c
    LEFT JOIN providers p ON c.provider_id = p.id
    LEFT JOIN clients cl ON c.client_id = cl.id
    WHERE (p.user_id = auth.uid()) OR (cl.user_id = auth.uid())
  )
);

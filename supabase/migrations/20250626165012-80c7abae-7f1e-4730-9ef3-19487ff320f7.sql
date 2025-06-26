
-- Drop existing policies and recreate them with better logic
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;

-- Create a better policy for message insertion
CREATE POLICY "Users can send messages in their conversations" ON public.messages
FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND
  conversation_id IN (
    SELECT id FROM conversations 
    WHERE provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
    OR client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  )
);

-- Create a better policy for message selection
CREATE POLICY "Users can view messages in their conversations" ON public.messages
FOR SELECT USING (
  conversation_id IN (
    SELECT id FROM conversations 
    WHERE provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
    OR client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  )
);

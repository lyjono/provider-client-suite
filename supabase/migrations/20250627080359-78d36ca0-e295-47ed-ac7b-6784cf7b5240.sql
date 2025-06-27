
-- First, let's add any missing foreign key constraints and update the appointments table
-- to ensure proper relationships and add video call functionality

-- Add foreign key constraints for appointments table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'appointments_provider_id_fkey' 
        AND table_name = 'appointments'
    ) THEN
        ALTER TABLE appointments 
        ADD CONSTRAINT appointments_provider_id_fkey 
        FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'appointments_client_id_fkey' 
        AND table_name = 'appointments'
    ) THEN
        ALTER TABLE appointments 
        ADD CONSTRAINT appointments_client_id_fkey 
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key constraints for availability_slots table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'availability_slots_provider_id_fkey' 
        AND table_name = 'availability_slots'
    ) THEN
        ALTER TABLE availability_slots 
        ADD CONSTRAINT availability_slots_provider_id_fkey 
        FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create a function to generate unique video call room IDs
CREATE OR REPLACE FUNCTION generate_video_room_id()
RETURNS TEXT AS $$
BEGIN
    RETURN 'room-' || encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically generate video call links for online appointments
CREATE OR REPLACE FUNCTION set_video_call_link()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.appointment_type = 'online' AND (NEW.video_call_link IS NULL OR NEW.video_call_link = '') THEN
        NEW.video_call_link = 'https://meet.jit.si/' || generate_video_room_id();
    ELSIF NEW.appointment_type = 'in_person' THEN
        NEW.video_call_link = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists and create it
DROP TRIGGER IF EXISTS set_video_call_link_trigger ON appointments;
CREATE TRIGGER set_video_call_link_trigger
    BEFORE INSERT OR UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION set_video_call_link();

-- Enable RLS if not already enabled
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate them
DROP POLICY IF EXISTS "Providers can manage their appointments" ON appointments;
DROP POLICY IF EXISTS "Clients can view their appointments" ON appointments;
DROP POLICY IF EXISTS "Clients can create appointments" ON appointments;
DROP POLICY IF EXISTS "Providers can manage their availability" ON availability_slots;
DROP POLICY IF EXISTS "Anyone can view availability slots" ON availability_slots;

-- Providers can see appointments they're involved in
CREATE POLICY "Providers can manage their appointments" ON appointments
    FOR ALL USING (
        provider_id IN (
            SELECT id FROM providers WHERE user_id = auth.uid()
        )
    );

-- Clients can see appointments they're involved in
CREATE POLICY "Clients can view their appointments" ON appointments
    FOR SELECT USING (
        client_id IN (
            SELECT id FROM clients WHERE user_id = auth.uid()
        )
    );

-- Clients can create appointments with their providers
CREATE POLICY "Clients can create appointments" ON appointments
    FOR INSERT WITH CHECK (
        client_id IN (
            SELECT id FROM clients WHERE user_id = auth.uid()
        )
    );

-- Providers can manage their availability
CREATE POLICY "Providers can manage their availability" ON availability_slots
    FOR ALL USING (
        provider_id IN (
            SELECT id FROM providers WHERE user_id = auth.uid()
        )
    );

-- Anyone can view availability slots (needed for booking)
CREATE POLICY "Anyone can view availability slots" ON availability_slots
    FOR SELECT USING (is_active = true);

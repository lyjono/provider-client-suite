
-- Update the video call link function to generate room IDs instead of external links
CREATE OR REPLACE FUNCTION set_video_call_link()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.appointment_type = 'online' AND (NEW.video_call_link IS NULL OR NEW.video_call_link = '') THEN
        NEW.video_call_link = generate_video_room_id();
    ELSIF NEW.appointment_type = 'in_person' THEN
        NEW.video_call_link = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add a video_call_room_id column to appointments table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' AND column_name = 'video_call_room_id'
    ) THEN
        ALTER TABLE appointments ADD COLUMN video_call_room_id TEXT;
    END IF;
END $$;

-- Update existing appointments to use video_call_link as room_id
UPDATE appointments 
SET video_call_room_id = video_call_link 
WHERE appointment_type = 'online' AND video_call_link IS NOT NULL AND video_call_room_id IS NULL;

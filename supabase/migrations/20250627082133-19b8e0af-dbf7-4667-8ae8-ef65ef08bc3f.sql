
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

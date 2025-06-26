
-- Create enum types for consistent data
CREATE TYPE provider_tier AS ENUM ('free', 'starter', 'pro');
CREATE TYPE appointment_type AS ENUM ('in_person', 'online');
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
CREATE TYPE lead_status AS ENUM ('contacted', 'qualified', 'converted', 'archived');

-- Create countries table for consistent data
CREATE TABLE public.countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create cities table for consistent data
CREATE TABLE public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country_id UUID REFERENCES countries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, country_id)
);

-- Create areas of expertise for consistent data
CREATE TABLE public.expertise_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert some default expertise areas
INSERT INTO public.expertise_areas (name, description) VALUES
('Accounting', 'Financial accounting and bookkeeping services'),
('Legal', 'Legal consultation and representation'),
('Consulting', 'Business and management consulting'),
('Tax Advisory', 'Tax planning and preparation services'),
('Financial Planning', 'Personal and business financial planning'),
('HR Consulting', 'Human resources and employment services'),
('IT Consulting', 'Technology and software consulting'),
('Marketing', 'Digital marketing and brand strategy');

-- Insert some default countries
INSERT INTO public.countries (name, code) VALUES
('United States', 'US'),
('Canada', 'CA'),
('United Kingdom', 'GB'),
('Australia', 'AU'),
('Germany', 'DE'),
('France', 'FR'),
('Spain', 'ES'),
('Italy', 'IT'),
('Netherlands', 'NL'),
('Sweden', 'SE');

-- Insert some default cities
INSERT INTO public.cities (name, country_id) VALUES
('New York', (SELECT id FROM countries WHERE code = 'US')),
('Los Angeles', (SELECT id FROM countries WHERE code = 'US')),
('Chicago', (SELECT id FROM countries WHERE code = 'US')),
('Toronto', (SELECT id FROM countries WHERE code = 'CA')),
('Vancouver', (SELECT id FROM countries WHERE code = 'CA')),
('London', (SELECT id FROM countries WHERE code = 'GB')),
('Manchester', (SELECT id FROM countries WHERE code = 'GB')),
('Sydney', (SELECT id FROM countries WHERE code = 'AU')),
('Melbourne', (SELECT id FROM countries WHERE code = 'AU')),
('Berlin', (SELECT id FROM countries WHERE code = 'DE')),
('Munich', (SELECT id FROM countries WHERE code = 'DE'));

-- Create providers table
CREATE TABLE public.providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT,
  address TEXT NOT NULL,
  city_id UUID REFERENCES cities(id),
  country_id UUID REFERENCES countries(id),
  expertise_area_id UUID REFERENCES expertise_areas(id),
  subscription_tier provider_tier DEFAULT 'free',
  subscription_end_date TIMESTAMPTZ,
  stripe_customer_id TEXT,
  provider_slug TEXT UNIQUE,
  bio TEXT,
  profile_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city_id UUID REFERENCES cities(id),
  country_id UUID REFERENCES countries(id),
  lead_status lead_status DEFAULT 'contacted',
  notes TEXT,
  profile_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email, provider_id)
);

-- Create availability slots for providers
CREATE TABLE public.availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration_minutes INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create appointments table
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  appointment_type appointment_type NOT NULL,
  location TEXT, -- For in-person appointments
  video_call_link TEXT, -- For online appointments
  status appointment_status DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create chat conversations
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider_id, client_id)
);

-- Create chat messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- 'text', 'file', 'document'
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create shared documents table
CREATE TABLE public.shared_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for providers
CREATE POLICY "Providers can view their own data" ON public.providers
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Providers can update their own data" ON public.providers
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Anyone can create provider profiles" ON public.providers
  FOR INSERT WITH CHECK (true);

-- RLS Policies for clients
CREATE POLICY "Providers can view their clients" ON public.clients
  FOR SELECT USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE POLICY "Clients can view their own data" ON public.clients
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Providers can manage their clients" ON public.clients
  FOR ALL USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE POLICY "Clients can update their own data" ON public.clients
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Anyone can create client profiles" ON public.clients
  FOR INSERT WITH CHECK (true);

-- RLS Policies for availability slots
CREATE POLICY "Providers can manage their availability" ON public.availability_slots
  FOR ALL USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

-- RLS Policies for appointments
CREATE POLICY "Providers can view their appointments" ON public.appointments
  FOR SELECT USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE POLICY "Clients can view their appointments" ON public.appointments
  FOR SELECT USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "Providers can manage their appointments" ON public.appointments
  FOR ALL USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE POLICY "Clients can create appointments" ON public.appointments
  FOR INSERT WITH CHECK (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- RLS Policies for conversations
CREATE POLICY "Providers can view their conversations" ON public.conversations
  FOR SELECT USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE POLICY "Clients can view their conversations" ON public.conversations
  FOR SELECT USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "Providers can manage their conversations" ON public.conversations
  FOR ALL USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE POLICY "Clients can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their conversations" ON public.messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations 
      WHERE provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
      OR client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their conversations" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (
      SELECT id FROM conversations 
      WHERE provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid())
      OR client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
    )
  );

-- RLS Policies for shared documents
CREATE POLICY "Providers can view their shared documents" ON public.shared_documents
  FOR SELECT USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

CREATE POLICY "Clients can view their shared documents" ON public.shared_documents
  FOR SELECT USING (client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

CREATE POLICY "Users can upload documents to their relationships" ON public.shared_documents
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid() AND (
      provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()) OR
      client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
    )
  );

-- Create storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('documents', 'documents', false),
  ('profile-images', 'profile-images', true);

-- Storage policies for documents
CREATE POLICY "Users can upload documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for profile images
CREATE POLICY "Users can upload profile images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'profile-images');

CREATE POLICY "Anyone can view profile images" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-images');

-- Function to generate unique provider slug
CREATE OR REPLACE FUNCTION generate_provider_slug(first_name TEXT, last_name TEXT, company_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 1;
BEGIN
  -- Create base slug from company name or full name
  IF company_name IS NOT NULL AND company_name != '' THEN
    base_slug := lower(regexp_replace(company_name, '[^a-zA-Z0-9]', '-', 'g'));
  ELSE
    base_slug := lower(regexp_replace(first_name || '-' || last_name, '[^a-zA-Z0-9]', '-', 'g'));
  END IF;
  
  -- Remove multiple consecutive dashes and trim
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(base_slug, '-');
  
  final_slug := base_slug;
  
  -- Check if slug exists and append number if needed
  WHILE EXISTS (SELECT 1 FROM providers WHERE provider_slug = final_slug) LOOP
    final_slug := base_slug || '-' || counter;
    counter := counter + 1;
  END LOOP;
  
  RETURN final_slug;
END;
$$;

-- Trigger to automatically generate provider slug
CREATE OR REPLACE FUNCTION set_provider_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.provider_slug IS NULL OR NEW.provider_slug = '' THEN
    NEW.provider_slug := generate_provider_slug(NEW.first_name, NEW.last_name, NEW.company_name);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER provider_slug_trigger
  BEFORE INSERT OR UPDATE ON providers
  FOR EACH ROW
  EXECUTE FUNCTION set_provider_slug();

-- Function to check subscription limits
CREATE OR REPLACE FUNCTION check_client_limit(provider_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  current_tier provider_tier;
  client_count INTEGER;
  max_clients INTEGER;
BEGIN
  -- Get provider's current tier
  SELECT subscription_tier INTO current_tier 
  FROM providers 
  WHERE user_id = provider_user_id;
  
  -- Count current clients
  SELECT COUNT(*) INTO client_count
  FROM clients c
  JOIN providers p ON c.provider_id = p.id
  WHERE p.user_id = provider_user_id;
  
  -- Set limits based on tier
  CASE current_tier
    WHEN 'free' THEN max_clients := 5;
    WHEN 'starter' THEN max_clients := 20;
    WHEN 'pro' THEN max_clients := 999999; -- Unlimited
    ELSE max_clients := 5; -- Default to free
  END CASE;
  
  RETURN client_count < max_clients;
END;
$$;


-- Add new columns to providers table for enhanced landing page content
ALTER TABLE public.providers 
ADD COLUMN services TEXT[], -- Array of services offered
ADD COLUMN tagline TEXT, -- Short catchy description
ADD COLUMN years_experience INTEGER,
ADD COLUMN hourly_rate DECIMAL(10,2),
ADD COLUMN consultation_fee DECIMAL(10,2),
ADD COLUMN availability_note TEXT,
ADD COLUMN languages TEXT[], -- Languages spoken
ADD COLUMN certifications TEXT[], -- Professional certifications
ADD COLUMN education TEXT,
ADD COLUMN website_url TEXT,
ADD COLUMN linkedin_url TEXT,
ADD COLUMN twitter_url TEXT;

-- Create testimonials table
CREATE TABLE public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_title TEXT,
  content TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create service packages table
CREATE TABLE public.service_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  duration_minutes INTEGER,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;

-- RLS policies for testimonials
CREATE POLICY "Anyone can view testimonials" ON public.testimonials
  FOR SELECT USING (true);

CREATE POLICY "Providers can manage their testimonials" ON public.testimonials
  FOR ALL USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));

-- RLS policies for service packages
CREATE POLICY "Anyone can view active service packages" ON public.service_packages
  FOR SELECT USING (is_active = true);

CREATE POLICY "Providers can manage their service packages" ON public.service_packages
  FOR ALL USING (provider_id IN (SELECT id FROM providers WHERE user_id = auth.uid()));


-- Check current RLS status and create policies for public provider access
-- Enable RLS on providers table if not already enabled
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Providers are viewable by everyone" ON public.providers;
DROP POLICY IF EXISTS "Public provider access" ON public.providers;

-- Create a policy that allows everyone to view provider information
-- This is needed for the landing pages to work
CREATE POLICY "Public provider access" ON public.providers
FOR SELECT
USING (true);

-- Also ensure the related tables can be accessed for provider details
ALTER TABLE public.expertise_areas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public expertise areas access" ON public.expertise_areas;
CREATE POLICY "Public expertise areas access" ON public.expertise_areas
FOR SELECT
USING (true);

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public cities access" ON public.cities;
CREATE POLICY "Public cities access" ON public.cities
FOR SELECT
USING (true);

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public countries access" ON public.countries;
CREATE POLICY "Public countries access" ON public.countries
FOR SELECT
USING (true);

-- Allow public access to service packages and testimonials for provider landing pages
ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public service packages access" ON public.service_packages;
CREATE POLICY "Public service packages access" ON public.service_packages
FOR SELECT
USING (true);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public testimonials access" ON public.testimonials;
CREATE POLICY "Public testimonials access" ON public.testimonials
FOR SELECT
USING (true);

-- DinoPlatform Supabase Storage Configuration
-- Run this in the SQL Editor to set up buckets and policies.

-- 1. Create Buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('machine-photos', 'machine-photos', true);

INSERT INTO storage.buckets (id, name, public) 
VALUES ('operation-receipts', 'operation-receipts', false);

-- 2. Storage Policies for machine-photos (Public View, Protected Upload)
CREATE POLICY "Public machine photos are viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'machine-photos');

CREATE POLICY "Only authenticated users can upload machine photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'machine-photos');

-- 3. Storage Policies for operation-receipts (Private - Tenant Only)
-- Note: This assumes folder naming convention matches tenant_id
CREATE POLICY "Users can only access their own tenant receipts"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'operation-receipts' AND 
  (storage.foldername(name))[1] IN (
    SELECT tenant_id::text FROM profiles WHERE id = auth.uid()
  )
);

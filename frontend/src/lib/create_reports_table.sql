
-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_uid TEXT NOT NULL,
    report_type TEXT NOT NULL, /* Atorada, Rellenar, Rota, Descompuesta */
    description TEXT,
    photo_url TEXT,
    status TEXT DEFAULT 'Pending', /* Pending, Resolved */
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anon) to insert reports
CREATE POLICY "Public can insert reports" 
ON reports FOR INSERT 
TO anon 
WITH CHECK (true);

-- Allow authenticated users (owner) to view/update reports
CREATE POLICY "Owner can view reports" 
ON reports FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Owner can update reports" 
ON reports FOR UPDATE 
TO authenticated 
USING (true);

-- Storage Bucket for Report Photos
-- You'll need to create a public bucket named 'report-photos' in Supabase Storage

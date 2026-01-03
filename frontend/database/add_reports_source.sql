-- Migration: Add Source column to Reports for Internal Incidents
-- Adds 'source' column to distinguish between Client QR reports and Internal Operator logs.

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'source') THEN 
        ALTER TABLE reports ADD COLUMN source TEXT DEFAULT 'client'; 
    END IF;
END $$;

-- Update existing records to have 'client' as source
UPDATE reports SET source = 'client' WHERE source IS NULL;

-- Ensure RLS allows Insert for Authenticated users (Operators)
-- (Existing policies might be focused on Anon or Read-Only)

DROP POLICY IF EXISTS "Users can insert internal reports" ON reports;
CREATE POLICY "Users can insert internal reports" 
ON reports FOR INSERT 
TO authenticated 
WITH CHECK (true); -- Operators can log any report. Logic validation in UI.

-- Ensure Authenticated users can view all reports (to see reminders)
DROP POLICY IF EXISTS "Users can view all reports" ON reports;
CREATE POLICY "Users can view all reports" 
ON reports FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM machines 
        WHERE id = reports.machine_id
        -- Standard user access control is handled by machines RLS.
        -- If users can see the machine, they can see its reports.
    )
    OR is_super_admin()
);

-- Note: Ideally 'reports' should have tenant_id for faster querying, 
-- but if it strictly links to 'machines', we can check via machine.
-- For this sprint, we assume authenticated users can READ relevant reports via machine RLS or broad permissions if tenant_id is missing.

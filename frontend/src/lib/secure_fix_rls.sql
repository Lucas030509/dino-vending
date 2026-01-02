-- FINAL PRODUCTION FIX V2 (Includes DELETE)
-- Restores security logic including DELETE permissions which were missing in V1.

-- 1. Collections: INSERT
DROP POLICY IF EXISTS "Users can insert relevant collections" ON collections;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON collections;
CREATE POLICY "Enable insert for authenticated users" 
ON collections FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 2. Collections: DELETE
-- Allow users to delete collections if they have access to the related machine.
-- This relies on the robust 'machines' select policy.
DROP POLICY IF EXISTS "Users can delete relevant collections" ON collections;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON collections;

CREATE POLICY "Enable delete for authenticated users"
ON collections FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM machines 
        WHERE id = collections.machine_id
    )
    OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
);

-- 3. Machines: UPDATE
-- Critical for Triggers (updating last_visit_date).
DROP POLICY IF EXISTS "Users can update relevant machines" ON machines;
DROP POLICY IF EXISTS "Enable update for tenant owners" ON machines;

CREATE POLICY "Enable update for tenant owners" 
ON machines FOR UPDATE
TO authenticated 
USING (
    tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
)
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
    OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
);

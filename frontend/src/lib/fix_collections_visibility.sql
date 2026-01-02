-- Fix Collections Visibility Policy
-- Switch from strict tenant_id check to relation-based check (via machines)
-- This ensures visibility of collections even if collections.tenant_id is missing/mismatched,
-- provided the user has access to the parent machine.

DROP POLICY IF EXISTS "Users can view relevant collections" ON collections;
DROP POLICY IF EXISTS "Enable read access for all users" ON collections; -- cleanup old policies

CREATE POLICY "Users can view relevant collections" 
ON collections FOR SELECT 
TO authenticated 
USING (
    (
        EXISTS (
            SELECT 1 FROM machines 
            WHERE id = collections.machine_id
        )
    )
    OR 
    is_super_admin()
);

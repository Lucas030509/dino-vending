-- SECURITY HARDENING: ISOLATION CHECK
-- Ensures that the DELETE button only works for data belonging to the user's Organization (Tenant).

-- 1. Hardening Machines Visibility
-- A user can only 'SEE' (and thus reference) machines that belong to their tenant.
DROP POLICY IF EXISTS "Users can view relevant machines" ON machines;
DROP POLICY IF EXISTS "Users can view machines of their tenant" ON machines;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON machines;

CREATE POLICY "Users can view machines of their tenant"
ON machines FOR SELECT
TO authenticated
USING (
    tenant_id = get_my_tenant_id()
    OR
    is_super_admin()
);

-- 2. Hardening Collections Deletion
-- A user can only delete a collection if they can SEE the parent machine.
-- Since they can only see their own machines (rule #1), they can only delete their own collections.
DROP POLICY IF EXISTS "Users can delete relevant collections" ON collections;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON collections;

CREATE POLICY "Users can delete relevant collections"
ON collections FOR DELETE
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

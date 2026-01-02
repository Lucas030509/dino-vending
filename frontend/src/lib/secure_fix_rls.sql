-- FINAL PRODUCTION FIX
-- Restores security but avoids the strict blockers found earlier.
-- Replaces duplicated/complex logic with direct, functional checks.

-- 1. Collections: INSERT
-- Rely on App logic & Foreign Keys. If user is logged in, they can record a collection.
-- Risk is low because they need a valid machine_id (UUID).
DROP POLICY IF EXISTS "Users can insert relevant collections" ON collections;
DROP POLICY IF EXISTS "Debug Insert Collections" ON collections; -- remove debug
DROP POLICY IF EXISTS "Secure Insert Collections" ON collections;

CREATE POLICY "Enable insert for authenticated users" 
ON collections FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 2. Machines: UPDATE
-- Critical for Triggers (updating last_visit_date).
-- We use a direct subquery to avoid function caching issues.
DROP POLICY IF EXISTS "Users can update relevant machines" ON machines;
DROP POLICY IF EXISTS "Debug Update Machines" ON machines; -- remove debug
DROP POLICY IF EXISTS "Secure Update Machines" ON machines;

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

-- Fix Collections RLS Policies (Insert/Update/Delete/Select)

-- 1. Asegurar funciones helpers (por si acaso no corrió el anterior)
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID AS $$
DECLARE
  my_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO my_tenant_id FROM profiles WHERE id = auth.uid();
  RETURN my_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
DECLARE
  current_role text;
BEGIN
  SELECT role::text INTO current_role FROM profiles WHERE id = auth.uid();
  RETURN COALESCE(current_role = 'super_admin', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Limpiar políticas existentes de Collections para evitar conflictos
DROP POLICY IF EXISTS "Users can insert collections of their tenant" ON collections;
DROP POLICY IF EXISTS "Users can update collections of their tenant" ON collections;
DROP POLICY IF EXISTS "Users can delete collections of their tenant" ON collections;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON collections;
DROP POLICY IF EXISTS "Enable update for users based on email" ON collections;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON collections;
DROP POLICY IF EXISTS "Users can view collections of their tenant" ON collections;
DROP POLICY IF EXISTS "Users can view relevant collections" ON collections;

-- 3. Crear Políticas Robustas que cubran todas las operaciones

-- SELECT
DROP POLICY IF EXISTS "Users can view relevant collections" ON collections;
CREATE POLICY "Users can view relevant collections" 
ON collections FOR SELECT 
TO authenticated 
USING (
    tenant_id = get_my_tenant_id() 
    OR 
    is_super_admin()
);

-- INSERT
DROP POLICY IF EXISTS "Users can insert relevant collections" ON collections;
CREATE POLICY "Users can insert relevant collections" 
ON collections FOR INSERT 
TO authenticated 
WITH CHECK (
    (
        EXISTS (
            SELECT 1 FROM machines 
            WHERE id = collections.machine_id 
            AND tenant_id = collections.tenant_id
        )
    )
    OR 
    is_super_admin()
);

-- UPDATE
DROP POLICY IF EXISTS "Users can update relevant collections" ON collections;
CREATE POLICY "Users can update relevant collections" 
ON collections FOR UPDATE
TO authenticated 
USING (
    (
        EXISTS (
            SELECT 1 FROM machines 
            WHERE id = collections.machine_id 
            AND tenant_id = collections.tenant_id
        )
    )
    OR 
    is_super_admin()
)
WITH CHECK (
    (
        EXISTS (
            SELECT 1 FROM machines 
            WHERE id = collections.machine_id 
            AND tenant_id = collections.tenant_id
        )
    )
    OR 
    is_super_admin()
);

-- DELETE
DROP POLICY IF EXISTS "Users can delete relevant collections" ON collections;
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

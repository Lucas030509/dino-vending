-- POLICY FIX: Enable Tenant Creation for Super Admins
-- Este script permite que los Super Admins inserten nuevas filas en la tabla 'tenants'.
-- Es necesario para que el formulario "Registrar Nuevo Cliente" funcione.

-- 1. INSERT Permissions
DROP POLICY IF EXISTS "Super admin can create tenants" ON tenants;

CREATE POLICY "Super admin can create tenants"
ON tenants FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin()
);

-- 2. UPDATE Permissions (por si acaso editas el nombre luego)
DROP POLICY IF EXISTS "Super admin can update tenants" ON tenants;

CREATE POLICY "Super admin can update tenants"
ON tenants FOR UPDATE
TO authenticated
USING (
  is_super_admin()
);

-- 3. SELECT (Ya debería existir, pero reforzamos)
DROP POLICY IF EXISTS "Super admin can view all tenants" ON tenants;

CREATE POLICY "Super admin can view all tenants"
ON tenants FOR SELECT
TO authenticated
USING (
  is_super_admin()
);

-- 1. Create Role Enum (Safety check included)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'worker');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add role column to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'admin';

-- 3. Update Policies for Tenants table
DROP POLICY IF EXISTS "Super admin can view all tenants" ON tenants;
CREATE POLICY "Super admin can view all tenants" 
ON tenants FOR SELECT 
TO authenticated 
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
);

DROP POLICY IF EXISTS "Super admin can update all tenants" ON tenants;
CREATE POLICY "Super admin can update all tenants" 
ON tenants FOR UPDATE 
TO authenticated 
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
)
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
);

-- 4. Update Policies for Profiles table
DROP POLICY IF EXISTS "Super admin can view all profiles" ON profiles;
CREATE POLICY "Super admin can view all profiles" 
ON profiles FOR SELECT 
TO authenticated 
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
);


-- INSTRUCCIONES IMPORTANTES:
-- Ejecuta este script y luego, para convertirte en Dios (Super Admin),
-- busca tu ID de usuario (en tabla auth.users o profiles) y ejecuta esto en una nueva consulta:
-- UPDATE profiles SET role = 'super_admin' WHERE id = 'TU_UUID_AQUI';
-- O si eres el único usuario, puedes correr esto (riesgoso si hay más):
-- UPDATE profiles SET role = 'super_admin';

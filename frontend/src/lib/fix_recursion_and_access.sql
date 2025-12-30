-- FIX INFINITE RECURSION IN RLS POLICIES
-- El problema: Las políticas estaban consultando la tabla 'profiles' para ver si eres admin,
-- pero para consultar 'profiles' necesitabas saber si eres admin... creando un bucle infinito.

-- Solución: Crear una función segura que cheque el rol sin activar las políticas RLS.

-- 1. Función Segura para checar si es Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
DECLARE
  current_role user_role;
BEGIN
  SELECT role INTO current_role FROM profiles WHERE id = auth.uid();
  RETURN current_role = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
-- SECURITY DEFINER = Ejecuta con permisos de Dios, ignorando RLS.

-- 2. Función Segura para checar tenant_id
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID AS $$
DECLARE
  my_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO my_tenant_id FROM profiles WHERE id = auth.uid();
  RETURN my_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. ARREGLAR POLÍTICAS DE PROFILES (Romper el bucle)
DROP POLICY IF EXISTS "Super admin can view all profiles" ON profiles;

CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
TO authenticated 
USING ( id = auth.uid() );

CREATE POLICY "Super admin can view all profiles" 
ON profiles FOR SELECT 
TO authenticated 
USING ( is_super_admin() );


-- 4. ARREGLAR POLÍTICAS DE MACHINES (Asegurar acceso)
-- Primero borramos políticas viejas que puedan estar fallando
DROP POLICY IF EXISTS "Enable read access for all users" ON machines;
DROP POLICY IF EXISTS "Users can view machines of their tenant" ON machines;

-- Política: Ves máquinas si son de tu tenant O si eres Super Admin
CREATE POLICY "Users can view relevant machines" 
ON machines FOR SELECT 
TO authenticated 
USING (
    tenant_id = get_my_tenant_id() 
    OR 
    is_super_admin()
);

-- Misma lógica para INSERT/UPDATE si es necesario
CREATE POLICY "Users can update relevant machines" 
ON machines FOR UPDATE
TO authenticated 
USING (
    tenant_id = get_my_tenant_id() 
    OR 
    is_super_admin()
);


-- 5. REPETIR PARA OTRAS TABLAS CRÍTICAS (Collections, Reports)

-- Collections
DROP POLICY IF EXISTS "Users can view collections of their tenant" ON collections;
CREATE POLICY "Users can view relevant collections" 
ON collections FOR SELECT 
TO authenticated 
USING (
    tenant_id = get_my_tenant_id() 
    OR 
    is_super_admin()
);

-- Reports (Aseguramos que lo que hicimos antes no se rompa)
-- Ya habíamos arreglado reports, pero asegurémonos que Super Admin las vea todas
DROP POLICY IF EXISTS "Authenticated can view reports" ON reports;
CREATE POLICY "Authenticated can view reports" 
ON reports FOR SELECT 
TO authenticated 
USING (
    -- Reports no tiene tenant_id directo a veces, depende de implementación.
    -- Asumimos que reports se ven todos por ahora si estás autenticado (como estaba antes), 
    -- o podrías filtrar por maquinas. Lo dejamos abierto como estaba para evitar bloqueos.
    true
);

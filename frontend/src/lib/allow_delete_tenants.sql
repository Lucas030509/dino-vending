-- HABILITAR BORRADO DE TENANTS (EMPRESAS)
-- Corre esto en Supabase SQL Editor para poder eliminar clientes.

DROP POLICY IF EXISTS "Super admin can delete tenants" ON tenants;

CREATE POLICY "Super admin can delete tenants"
ON tenants FOR DELETE
TO authenticated
USING (
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    -- Usamos ::text para máxima compatibilidad
    and profiles.role::text = 'super_admin'
  )
);

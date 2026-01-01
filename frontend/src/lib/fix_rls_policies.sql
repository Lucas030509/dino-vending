-- Arreglar Polítcas RLS para que usen user_metadata en lugar de profiles (más robusto)

-- 1. Eliminar política vieja de inserción en machines
DROP POLICY IF EXISTS "Tenants can insert their own machines" ON public.machines;

-- 2. Crear nueva política robusta
CREATE POLICY "Tenants can insert their own machines"
ON public.machines
FOR INSERT
WITH CHECK (
  -- El tenant_id de la nueva fila debe coincidir con el tenant_id en los metadatos del usuario
  tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
);

-- 3. Asegurar que SELECT también sea robusto (opcional, pero recomendado)
DROP POLICY IF EXISTS "Tenants can view their own machines" ON public.machines;

CREATE POLICY "Tenants can view their own machines"
ON public.machines
FOR SELECT
USING (
  tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
);

-- 4. Asegurar UPDATE y DELETE
DROP POLICY IF EXISTS "Tenants can update their own machines" ON public.machines;
CREATE POLICY "Tenants can update their own machines"
ON public.machines
FOR UPDATE
USING (tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid);

DROP POLICY IF EXISTS "Tenants can delete their own machines" ON public.machines;
CREATE POLICY "Tenants can delete their own machines"
ON public.machines
FOR DELETE
USING (tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid);

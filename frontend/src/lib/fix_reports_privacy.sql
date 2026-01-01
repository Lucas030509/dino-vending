-- ASEGURAR PRIVACIDAD DE REPORTES ENTRE CLIENTES

-- 1. Habilitar RLS en la tabla reports (por si acaso)
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar política antigua de lectura (probablemente "Enable read access for all users" o similar)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.reports;
DROP POLICY IF EXISTS "Authenticated users can view reports" ON public.reports;
DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;

-- 3. Crear nueva política de LECTURA estricta
DROP POLICY IF EXISTS "Tenants can view reports of their own machines" ON public.reports;

CREATE POLICY "Tenants can view reports of their own machines"
ON public.reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.machines 
    WHERE machines.id::text = reports.machine_uid -- CAMBIO CRÍTICO: Usamos ID exacto (UUID)
    AND machines.tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
  )
);

-- Nota: Si en el futuro cambias reports para usar machine_id (UUID) en lugar de machine_uid (texto), 
-- cambia 'machines.qr_code_uid = reports.machine_uid' por 'machines.id = reports.machine_id'.
-- Según tu código actual (PublicReport.jsx), guardas 'machine_uid' con el valor del UID (ahora UUID).
-- Así que el match debería funcionar.

-- 4. Mantener política de INSERT pública (para que la gente pueda reportar sin login)
DROP POLICY IF EXISTS "Enable insert for all users" ON public.reports;
CREATE POLICY "Enable insert for all users"
ON public.reports
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 5. Permitir UPDATE (para marcar como Resuelto) solo a los dueños
DROP POLICY IF EXISTS "Tenants can update their own reports" ON public.reports;

CREATE POLICY "Tenants can update their own reports"
ON public.reports
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.machines 
    WHERE machines.id::text = reports.machine_uid
    AND machines.tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
  )
);

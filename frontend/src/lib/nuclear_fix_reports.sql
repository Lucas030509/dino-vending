-- SOLUCIÓN NUCLEAR PARA LIMPIAR POLÍTICAS DE REPORTES
-- Este script elimina TODAS las políticas existentes en la tabla 'reports' indiscriminadamente
-- y luego aplica la política estricta de privacidad.

DO $$ 
DECLARE 
    pol record; 
BEGIN 
    -- 1. Recorrer y eliminar CADA política encontrada en la tabla 'reports'
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'reports' 
    LOOP 
        RAISE NOTICE 'Eliminando política: %', pol.policyname;
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.reports', pol.policyname); 
    END LOOP; 
END $$;

-- 2. Asegurar que RLS esté activado
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 3. Crear la política de LECTURA ESTRICTA (Solo coincidencia exacta de UUID)
CREATE POLICY "Tenants can view reports of their own machines"
ON public.reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.machines 
    WHERE machines.id::text = reports.machine_uid -- Match estricto por UUID
    AND machines.tenant_id = (auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
  )
);

-- 4. Permitir INSERT público (para reportes anónimos)
CREATE POLICY "Enable insert for all users"
ON public.reports
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 5. Permitir UPDATE solo a dueños
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

-- ¡Casa limpia! ✨

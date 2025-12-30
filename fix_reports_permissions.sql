-- FIX REPORTS PERMISSIONS (Ejecuta esto en Supabase SQL Editor)

-- 1. Primero, limpiamos políticas viejas para evitar conflictos
DROP POLICY IF EXISTS "Public can insert reports" ON reports;
DROP POLICY IF EXISTS "Owner can view reports" ON reports;
DROP POLICY IF EXISTS "Owner can update reports" ON reports;
DROP POLICY IF EXISTS "Enable read access for all users" ON reports;
DROP POLICY IF EXISTS "Enable insert for all users" ON reports;
DROP POLICY IF EXISTS "Enable update for users based on email" ON reports;

-- 2. Aseguramos que RLS (Seguridad) esté activada
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICA 1: CUALQUIERA (Público + Logueado) puede crear reportes
CREATE POLICY "Anyone can create reports" 
ON reports FOR INSERT 
TO public 
WITH CHECK (true);

-- 4. POLÍTICA 2: CUALQUIERA (Público + Logueado) puede ver reportes 
-- (Necesario para que el dashboard cargue y para actualizaciones)
CREATE POLICY "Authenticated can view reports" 
ON reports FOR SELECT 
TO authenticated 
USING (true);

-- 5. POLÍTICA 3: SOLO USUARIOS LOGUEADOS pueden actualizar (Resolver)
CREATE POLICY "Authenticated can update reports" 
ON reports FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- 6. POLÍTICA 4: (Opcional pero recomendada) Permitir borrar solo a autenticados
CREATE POLICY "Authenticated can delete reports" 
ON reports FOR DELETE 
TO authenticated 
USING (true);

-- Confirmación visual
SELECT 'Permisos de reportes reparados exitosamente' as result;

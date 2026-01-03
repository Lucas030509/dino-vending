-- DEBUG: NUCLEAR RLS FIX
-- Este script es temporal para DIAGNOSTICAR el error.
-- Permite inserts y updates "libres" a usuarios autenticados para descartar errores de lógica condicional.

-- 1. Collections: Permitir INSERT a cualquier usuario autenticado (sin checks complejos)
DROP POLICY IF EXISTS "Users can insert relevant collections" ON collections;
CREATE POLICY "Debug Insert Collections" 
ON collections FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 2. Machines: Permitir UPDATE a cualquier usuario autenticado (por si hay triggers)
DROP POLICY IF EXISTS "Users can update relevant machines" ON machines;
CREATE POLICY "Debug Update Machines" 
ON machines FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

-- 3. Asegurar Select (esto ya funcionaba, pero por si acaso)
DROP POLICY IF EXISTS "Users can view relevant collections" ON collections;
CREATE POLICY "Users can view relevant collections" 
ON collections FOR SELECT 
TO authenticated 
USING (true);

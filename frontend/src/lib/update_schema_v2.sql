-- FASE 1: ACTUALIZACIÓN DE ESQUEMA V2 (Contacto, Evidencias, Calendario)

-- 1. Agregar datos de contacto a la tabla MACHINES
ALTER TABLE public.machines
ADD COLUMN IF NOT EXISTS contact_name text,
ADD COLUMN IF NOT EXISTS contact_email text,
ADD COLUMN IF NOT EXISTS contact_phone text;

-- 2. Agregar evidencias y recordatorios a la tabla COLLECTIONS
ALTER TABLE public.collections
ADD COLUMN IF NOT EXISTS evidence_photo_url text,      -- Foto de la máquina/contador
ADD COLUMN IF NOT EXISTS evidence_signature_url text,  -- Firma del encargado
ADD COLUMN IF NOT EXISTS next_visit_date date;         -- Fecha sugerida para la próxima visita

-- 3. Crear Bucket de Storage para Evidencias 'collection-evidence'
-- Nota: La creación de buckets a veces requiere hacerlo desde el UI, pero intentaremos por SQL.
-- Si falla, habrá que crearlo manual.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('collection-evidence', 'collection-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Políticas de Seguridad para el Bucket de Evidencias
-- Permitir subir archivos a usuarios autenticados
CREATE POLICY "Auth users can upload evidence" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'collection-evidence');

-- Permitir ver evidencias (Público para que se vean en el email del recibo)
CREATE POLICY "Public read access for evidence" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'collection-evidence');

-- Permitir borrar sus propias evidencias (opcional, por limpieza)
CREATE POLICY "Users can delete own evidence" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'collection-evidence' AND auth.uid() = owner);

-- ¡Listo! Esquema actualizado.

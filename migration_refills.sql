-- RUN THIS SQL IN SUPABASE SQL EDITOR

-- 1. Ampliar tabla collections para soportar rellenos (Kardex Unificado)
ALTER TABLE collections 
ADD COLUMN IF NOT EXISTS record_type TEXT DEFAULT 'collection', -- valores: 'collection', 'refill', 'maintenance'
ADD COLUMN IF NOT EXISTS inventory_refilled INTEGER DEFAULT 0, -- Cantidad de producto ingresado
ADD COLUMN IF NOT EXISTS stock_after_refill INTEGER DEFAULT 0; -- Foto del stock después de la operación

-- 2. Asegurarnos que la tabla machines tenga las columnas de inventario
ALTER TABLE machines 
ADD COLUMN IF NOT EXISTS capsule_capacity INTEGER DEFAULT 180, -- Capacidad estándar
ADD COLUMN IF NOT EXISTS current_stock_snapshot INTEGER DEFAULT 0, -- Stock actual estimado (cache)
ADD COLUMN IF NOT EXISTS last_refill_date TIMESTAMP WITH TIME ZONE;

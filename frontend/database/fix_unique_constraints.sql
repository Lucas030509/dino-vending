-- MODIFICAR REGLAS DE UNICIDAD PARA PERMITIR CÓDIGOS REPETIDOS ENTRE CLIENTES

-- 1. Eliminar la restricción actual que obliga a que el código sea único en TODA la tabla
-- Nota: El nombre de la restricción suele ser 'machines_qr_code_uid_key', pero usamos IF EXISTS por seguridad.
ALTER TABLE public.machines 
DROP CONSTRAINT IF EXISTS machines_qr_code_uid_key;

-- 2. Crear una nueva restricción "Compuesta"
-- Esto significa: "No permitas repetir el mismo 'qr_code_uid' DENTRO del mismo 'tenant_id'"
-- Pero SÍ permite que diferentes 'tenant_id' tengan el mismo 'qr_code_uid'.
ALTER TABLE public.machines
ADD CONSTRAINT machines_tenant_qr_unique UNIQUE (tenant_id, qr_code_uid);

-- ¡Listo! Ahora dos clientes distintos pueden tener una máquina llamada "DINO-01" sin problemas.

-- MIGRATION V2: LOCATIONS & MACHINES RESTRUCTURING
-- Goal: Move from Flat Model to Relational (Locations -> Machines)

-- 1. Create table 'locations'
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID, -- We will fill this from machines
    name TEXT NOT NULL,
    address TEXT,
    google_maps_url TEXT,
    coordinates TEXT,
    district TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for locations
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view locations of their tenant" 
ON locations FOR SELECT 
USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage locations of their tenant" 
ON locations FOR ALL 
USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));


-- 2. Modify 'machines' table to add new columns
ALTER TABLE machines ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);
ALTER TABLE machines ADD COLUMN IF NOT EXISTS nickname TEXT; -- 'Alias' (e.g. Juguete, Pelota)
ALTER TABLE machines ADD COLUMN IF NOT EXISTS sku TEXT; -- User wants SKU/Serial
ALTER TABLE machines ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'Juguete Mixto'; -- Catalog type

-- 3. Store Procedures to Migrate Data
-- This block does the heavy lifting:
-- a) Creates a Location for each existing Machine row (which currently represents a location)
-- b) Links the Machine row to the new Location
-- c) Explodes 'machine_count' > 1 into multiple machine rows
DO $$
DECLARE
    m_record RECORD;
    new_loc_id UUID;
    i INT;
    existing_count INT;
BEGIN
    FOR m_record IN SELECT * FROM machines WHERE location_id IS NULL LOOP
        
        -- 3.1 Create Location
        -- We use the current 'location_name' as the Location Name (e.g. "Alex Pizza")
        INSERT INTO locations (tenant_id, name, address, google_maps_url)
        VALUES (m_record.tenant_id, m_record.location_name, m_record.address, m_record.maps_url)
        RETURNING id INTO new_loc_id;

        -- 3.2 Update the PRIMARY/ORIGINAL machine row
        -- This row keeps its ID, so old collections remain linked to it (representing 'Machine 1')
        -- We set its new location_id, and assign a default Alias
        UPDATE machines SET 
            location_id = new_loc_id,
            nickname = 'Máquina 1',
            sku = 'SKU-' || substr(m_record.id::text, 1, 8), -- Temporary SKU from UUID
            machine_count = 1 -- Reset to 1, as this row now represents just ONE unit
        WHERE id = m_record.id;
        
        -- 3.3 Handle Multiple Machines (Explode)
        existing_count := m_record.machine_count;
        IF existing_count IS NULL OR existing_count < 1 THEN
             existing_count := 1;
        END IF;

        IF existing_count > 1 THEN
            FOR i IN 2..existing_count LOOP
                -- Insert NEW machine unit
                INSERT INTO machines (
                    tenant_id, 
                    location_id, 
                    location_name, -- Keep legacy name for now to avoid breaking UI temporarily
                    qr_code_uid, 
                    capsule_capacity, 
                    machine_count, 
                    nickname,
                    sku,
                    product_type,
                    current_status
                )
                VALUES (
                    m_record.tenant_id,
                    new_loc_id,
                    m_record.location_name, -- Legacy
                    m_record.qr_code_uid || '-' || i, -- Append suffix to ensure uniqueness if unique constraint exists
                    m_record.capsule_capacity, -- Inherit capacity
                    1, -- Single unit
                    'Máquina ' || i, -- Alias
                    'SKU-' || substr(uuid_generate_v4()::text, 1, 8), -- Generate new SKU
                    'Juguete Mixto', -- Default
                    'Active'
                );
            END LOOP;
        END IF;
        
    END LOOP;
END $$;


-- 4. Collections Table Update (Optional but Recommended)
-- Add location_id to collections to speed up location-based reporting
ALTER TABLE collections ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);

-- Backfill collections.location_id based on machine.location_id
UPDATE collections c
SET location_id = m.location_id
FROM machines m
WHERE c.machine_id = m.id AND c.location_id IS NULL;


-- PERFORMANCE INDEXES MIGRATION
-- Purpose: Speed up RLS checks and common joins (Locations, Machines, Collections)

-- 1. Index for RLS on locations (tenant_id)
-- This is critical because every select check: "tenant_id IN (SELECT tenant_id FROM profiles...)"
CREATE INDEX IF NOT EXISTS idx_locations_tenant_id ON locations(tenant_id);

-- 2. Index for joining Machines to Locations
-- Used in "Puntos de Venta" grouping and Reports
CREATE INDEX IF NOT EXISTS idx_machines_location_id ON machines(location_id);

-- 3. Index for RLS on machines (tenant_id)
CREATE INDEX IF NOT EXISTS idx_machines_tenant_id ON machines(tenant_id);

-- 4. Index for Collections (Filtering by Date and Machine)
-- Common usage: "Last 50 collections", "Collections for this machine"
CREATE INDEX IF NOT EXISTS idx_collections_machine_date ON collections(machine_id, collection_date DESC);
CREATE INDEX IF NOT EXISTS idx_collections_tenant_date ON collections(tenant_id, collection_date DESC);

-- 5. Index for Reports (Status filtering)
CREATE INDEX IF NOT EXISTS idx_reports_status_tenant ON reports(tenant_id, status);

-- 6. Index for Collections (Location ID) - Since we added location_id in v2
CREATE INDEX IF NOT EXISTS idx_collections_location_id ON collections(location_id);

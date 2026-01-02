-- MASTER SECURITY POLICY (Consolidated)
-- Stores all Row Level Security (RLS) policies for DinoVending in one source of truth.
-- Replaces fragmented scripts: fix_rls*, secure_fix*, verify_security*, etc.

-- 0. Enable RLS on all sensitive tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- 1. Helper Functions (Essential for Policies)
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT tenant_id FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. PROFILES (Users)
-- Users can view their own profile. Super Admins can view all.
DROP POLICY IF EXISTS "Profiles visibility" ON profiles;
CREATE POLICY "Profiles visibility" ON profiles FOR SELECT TO authenticated 
USING ( id = auth.uid() OR is_super_admin() );

-- Users can update only their own profile.
DROP POLICY IF EXISTS "Profiles self-update" ON profiles;
CREATE POLICY "Profiles self-update" ON profiles FOR UPDATE TO authenticated 
USING ( id = auth.uid() ) WITH CHECK ( id = auth.uid() );


-- 3. MACHINES (Assets)
-- View/Edit: Only machines belonging to the user's Tenant.
DROP POLICY IF EXISTS "Machines tenant isolation" ON machines;
DROP POLICY IF EXISTS "Users can view machines of their tenant" ON machines; -- cleanup old

CREATE POLICY "Machines tenant isolation" ON machines FOR ALL TO authenticated
USING (
    tenant_id = get_my_tenant_id() OR is_super_admin()
)
WITH CHECK (
    tenant_id = get_my_tenant_id() OR is_super_admin()
);


-- 4. COLLECTIONS (Financial Data)
-- Strict Hierarchy: Can only interact if you can SEE the parent Machine.
-- This prevents deleting/viewing data from other tenants even if IDs are guessed.
DROP POLICY IF EXISTS "Collections machinery link" ON collections;
DROP POLICY IF EXISTS "Users can view relevant collections" ON collections; -- cleanup old
DROP POLICY IF EXISTS "Users can delete relevant collections" ON collections; -- cleanup old

CREATE POLICY "Collections machinery link" ON collections FOR ALL TO authenticated
USING (
    (EXISTS (SELECT 1 FROM machines WHERE id = collections.machine_id))
    OR is_super_admin()
)
WITH CHECK (
    (EXISTS (SELECT 1 FROM machines WHERE id = collections.machine_id))
    OR is_super_admin()
);


-- 5. ROUTES (Logistics)
-- Routes belong to a Tenant.
DROP POLICY IF EXISTS "Routes tenant isolation" ON routes;
CREATE POLICY "Routes tenant isolation" ON routes FOR ALL TO authenticated
USING ( tenant_id = get_my_tenant_id() OR is_super_admin() )
WITH CHECK ( tenant_id = get_my_tenant_id() OR is_super_admin() );

-- Route Stops follow the Route.
DROP POLICY IF EXISTS "RouteStops route link" ON route_stops;
CREATE POLICY "RouteStops route link" ON route_stops FOR ALL TO authenticated
USING ( EXISTS (SELECT 1 FROM routes WHERE id = route_stops.route_id) )
WITH CHECK ( EXISTS (SELECT 1 FROM routes WHERE id = route_stops.route_id) );


-- 6. REPORTS (Incidents & QR)
-- View/Edit: Link via Machine visibility (robust) OR Tenant ID if available.
DROP POLICY IF EXISTS "Reports visibility" ON reports;
DROP POLICY IF EXISTS "Users can view all reports" ON reports; -- cleanup old

CREATE POLICY "Reports visibility" ON reports FOR SELECT TO authenticated
USING (
    (EXISTS (SELECT 1 FROM machines WHERE id = reports.machine_id))
    OR (tenant_id = get_my_tenant_id())
    OR is_super_admin()
);

-- Insert: Allow operators to insert (validation logic handles data integrity)
DROP POLICY IF EXISTS "Reports insert" ON reports;
CREATE POLICY "Reports insert" ON reports FOR INSERT TO authenticated WITH CHECK (true);


-- 7. TENANTS (Organizations)
-- Only Super Admins can manage Tenants. Users can view their own.
DROP POLICY IF EXISTS "Tenants visibility" ON tenants;
CREATE POLICY "Tenants visibility" ON tenants FOR SELECT TO authenticated
USING ( id = get_my_tenant_id() OR is_super_admin() );

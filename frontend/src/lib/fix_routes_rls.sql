-- FIX ROUTES RLS
-- The previous policies relied on 'auth.jwt() -> user_metadata', which might be missing for some users.
-- We switch to using the robust 'get_my_tenant_id()' function which checks the 'profiles' table.

-- 1. Routes Policies
DROP POLICY IF EXISTS "Users can view routes for their tenant" ON public.routes;
DROP POLICY IF EXISTS "Users can insert routes for their tenant" ON public.routes;
DROP POLICY IF EXISTS "Users can update routes for their tenant" ON public.routes;
DROP POLICY IF EXISTS "Users can delete routes for their tenant" ON public.routes;

CREATE POLICY "Users can view routes for their tenant" ON public.routes
    FOR SELECT USING (
        tenant_id = get_my_tenant_id() OR is_super_admin()
    );

CREATE POLICY "Users can insert routes for their tenant" ON public.routes
    FOR INSERT WITH CHECK (
        tenant_id = get_my_tenant_id() OR is_super_admin()
    );

CREATE POLICY "Users can update routes for their tenant" ON public.routes
    FOR UPDATE USING (
        tenant_id = get_my_tenant_id() OR is_super_admin()
    );

CREATE POLICY "Users can delete routes for their tenant" ON public.routes
    FOR DELETE USING (
        tenant_id = get_my_tenant_id() OR is_super_admin()
    );

-- 2. Route Stops Policies
-- We allow access if the user has access to the parent route.
DROP POLICY IF EXISTS "Users can view stops for their tenant's routes" ON public.route_stops;
DROP POLICY IF EXISTS "Users can insert stops for their tenant's routes" ON public.route_stops;
DROP POLICY IF EXISTS "Users can update stops for their tenant's routes" ON public.route_stops;
DROP POLICY IF EXISTS "Users can delete stops for their tenant's routes" ON public.route_stops;

CREATE POLICY "Users can view stops for their tenant's routes" ON public.route_stops
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.routes 
            WHERE routes.id = route_stops.route_id 
            -- We implicit rely on routes RLS here? No, better be explicit or use the same check
            AND (routes.tenant_id = get_my_tenant_id() OR is_super_admin())
        )
    );

CREATE POLICY "Users can insert stops for their tenant's routes" ON public.route_stops
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.routes 
            WHERE routes.id = route_stops.route_id 
            AND (routes.tenant_id = get_my_tenant_id() OR is_super_admin())
        )
    );

CREATE POLICY "Users can update stops for their tenant's routes" ON public.route_stops
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.routes 
            WHERE routes.id = route_stops.route_id 
            AND (routes.tenant_id = get_my_tenant_id() OR is_super_admin())
        )
    );

CREATE POLICY "Users can delete stops for their tenant's routes" ON public.route_stops
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.routes 
            WHERE routes.id = route_stops.route_id 
            AND (routes.tenant_id = get_my_tenant_id() OR is_super_admin())
        )
    );

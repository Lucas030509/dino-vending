-- Create routes table
CREATE TABLE IF NOT EXISTS public.routes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES auth.users(id),
    scheduled_date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'canceled')),
    name TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create route_stops table (junction table for machines in a route)
CREATE TABLE IF NOT EXISTS public.route_stops (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE,
    machine_id UUID REFERENCES public.machines(id),
    stop_order INTEGER,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'visited', 'skipped')),
    completion_time TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;

-- Policies for routes
CREATE POLICY "Users can view routes for their tenant" ON public.routes
    FOR SELECT USING (tenant_id = (select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "Users can insert routes for their tenant" ON public.routes
    FOR INSERT WITH CHECK (tenant_id = (select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "Users can update routes for their tenant" ON public.routes
    FOR UPDATE USING (tenant_id = (select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "Users can delete routes for their tenant" ON public.routes
    FOR DELETE USING (tenant_id = (select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid);

-- Policies for route_stops
-- (Indirectly secured via route_id, but good to be explicit or leave open to route owner)
-- Using a join policy can be expensive, so we often rely on the fact that you can only create stops for a route you can see.
-- But for strictness:

CREATE POLICY "Users can view stops for their tenant's routes" ON public.route_stops
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.routes 
            WHERE routes.id = route_stops.route_id 
            AND routes.tenant_id = (select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
        )
    );

CREATE POLICY "Users can insert stops for their tenant's routes" ON public.route_stops
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.routes 
            WHERE routes.id = route_stops.route_id 
            AND routes.tenant_id = (select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
        )
    );

CREATE POLICY "Users can update stops for their tenant's routes" ON public.route_stops
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.routes 
            WHERE routes.id = route_stops.route_id 
            AND routes.tenant_id = (select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
        )
    );

CREATE POLICY "Users can delete stops for their tenant's routes" ON public.route_stops
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.routes 
            WHERE routes.id = route_stops.route_id 
            AND routes.tenant_id = (select auth.jwt() -> 'user_metadata' ->> 'tenant_id')::uuid
        )
    );

-- Add simple indexes for performance
CREATE INDEX IF NOT EXISTS idx_routes_tenant ON public.routes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_routes_date ON public.routes(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_stops_route ON public.route_stops(route_id);

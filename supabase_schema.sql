-- DinoPlatform Supabase Schema
-- Phase 1: Cimientos

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLE tenants
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLE profiles (Extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'owner')),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLE machines
CREATE TABLE machines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    qr_code_uid TEXT UNIQUE NOT NULL,
    location_name TEXT NOT NULL,
    address TEXT,
    maps_url TEXT,
    machine_capacity INT DEFAULT 0,
    denomination DECIMAL(10, 2) DEFAULT 0.00,
    current_status TEXT DEFAULT 'active'
);

-- 5. TABLE incident_reports
CREATE TABLE incident_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id UUID REFERENCES machines(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL,
    description TEXT,
    photo_path TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLE operation_logs
CREATE TABLE operation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id UUID REFERENCES machines(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    operation_type TEXT NOT NULL, -- 'refill', 'cash_collection', etc.
    amount_collected DECIMAL(10, 2) DEFAULT 0.00,
    commission_paid DECIMAL(10, 2) DEFAULT 0.00,
    photo_refill_path TEXT,
    photo_cash_path TEXT,
    photo_receipt_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;

-- 7. RLS POLICIES

-- Profiles: Users can only see their own profile
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

-- Tenants: Users can see the tenant they belong to
CREATE POLICY "Users can view their tenant" 
ON tenants FOR SELECT 
USING (id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Machines: Users can see/edit machines of their tenant
CREATE POLICY "Users can view machines of their tenant" 
ON machines FOR SELECT 
USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins/Owners can manage machines" 
ON machines FOR ALL 
USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));

-- Incident Reports: Public can insert, but only tenant staff can view/edit
CREATE POLICY "Anyone can report an incident" 
ON incident_reports FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Tenant users can view reports" 
ON incident_reports FOR SELECT 
USING (machine_id IN (SELECT id FROM machines WHERE tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())));

-- Operation Logs: Only tenant staff can view/insert
CREATE POLICY "Tenant users can manage logs" 
ON operation_logs FOR ALL 
USING (machine_id IN (SELECT id FROM machines WHERE tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())));

-- 8. TRIGGER FOR AUTO-PROFILE CREATION
-- This function creates a profile automatically when a user signs up.
-- NOTE: The tenant_id will need to be assigned manually or via an invite system later.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (new.id, 'staff'); -- Default role
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


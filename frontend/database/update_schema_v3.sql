-- Update Schema V3: Business Logic Expansion
-- Adds operational hours, closed days, and advanced contract types (Rent vs Commission)

-- 1. Add Operational Columns
ALTER TABLE machines 
ADD COLUMN IF NOT EXISTS closed_days text[] DEFAULT '{}', -- Array of days e.g. ['Sunday', 'Saturday']
ADD COLUMN IF NOT EXISTS opening_time time,
ADD COLUMN IF NOT EXISTS closing_time time;

-- 2. Add Financial Contract Columns
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'commission' CHECK (contract_type IN ('commission', 'rent')),
ADD COLUMN IF NOT EXISTS rent_periodicity text CHECK (rent_periodicity IN ('Mensual', 'Bimestral', 'Trimestral', 'Semestral', 'Anual')),
ADD COLUMN IF NOT EXISTS rent_amount numeric DEFAULT 0;

-- 3. Comment for documentation
COMMENT ON COLUMN machines.closed_days IS 'Days of the week when the location is closed. Used to skip dates in route planning.';
COMMENT ON COLUMN machines.rent_amount IS 'Fixed amount paid to location owner if contract_type is rent.';

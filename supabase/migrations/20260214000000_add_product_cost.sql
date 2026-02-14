-- Migration to add product_unit_cost to tenants table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS product_unit_cost NUMERIC DEFAULT 2.5;

-- Update RLS policies (usually not needed for adding columns if SELECT * is used, but good to keep in mind)

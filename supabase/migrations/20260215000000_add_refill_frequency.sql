-- Add refill_frequency column to machines
ALTER TABLE machines ADD COLUMN IF NOT EXISTS refill_frequency TEXT DEFAULT 'Quincenal';

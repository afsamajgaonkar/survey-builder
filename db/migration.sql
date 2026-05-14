-- Add expiry_date to surveys
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP;

-- Add soft-delete (Recycle Bin) support
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;

-- Ensure role is on users (should already be there from schema.sql)
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';
    EXCEPTION
        WHEN duplicate_column THEN RAISE NOTICE 'column role already exists in users.';
    END;
END;
$$;

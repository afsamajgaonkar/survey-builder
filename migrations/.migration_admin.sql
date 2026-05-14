-- ! DEPRECATED !
-- everything is now handled by `schema.sql`. this script should not be ran anymore.

-- =============================================
-- Admin Management System - Migration
-- Run this against your PostgreSQL database
-- =============================================

-- 1. Add is_banned flag to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;

-- 2. Ensure role column exists with constraint
DO $$
BEGIN
    BEGIN
        ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';
    EXCEPTION
        WHEN duplicate_column THEN RAISE NOTICE 'column role already exists in users.';
    END;
END;
$$;

-- Add CHECK constraint if not already present (safe approach)
DO $$
BEGIN
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));
EXCEPTION
    WHEN others THEN RAISE NOTICE 'Could not add role check constraint.';
END;
$$;

-- 3. Create user_activity table
CREATE TABLE IF NOT EXISTS user_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast queries by user and time
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC);

-- 4. Update existing methods for updateRole and updateUser (add to User model manually)

-- 5. Seed a default admin user
-- Password: Admin@123 (bcrypt hash generated with cost 10)
-- Uncomment and adjust if you need a seed admin:
-- INSERT INTO users (username, email, password, role)
-- VALUES ('admin', 'admin@surveybuilder.com', '$2a$10$XmSLPcRXbK.xhFOW2WpBB.c/I1M8h0K0hY1X5dJrF/o3V/LfTqsmy', 'admin')
-- ON CONFLICT (email) DO NOTHING;

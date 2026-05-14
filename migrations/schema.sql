-- =============================================
-- Survey Builder - PostgreSQL Database Schema
-- =============================================

-- Create database (run separately if needed)
-- CREATE DATABASE surveybuilder;

-- Session store table (for connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  "sid" VARCHAR NOT NULL COLLATE "default",
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  PRIMARY KEY ("sid")
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  email_verified BOOLEAN DEFAULT false,
  verification_token VARCHAR(1024),
  created_at TIMESTAMP DEFAULT NOW(),
  is_banned BOOLEAN DEFAULT FALSE,
  theme VARCHAR(50) DEFAULT 'default'
);

-- Surveys table
CREATE TABLE IF NOT EXISTS surveys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  share_link VARCHAR(100) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP DEFAULT NULL,
  expiry_date TIMESTAMP,
  expires_at TIMESTAMP,
  is_deleted BOOLEAN DEFAULT false,
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  survey_id INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR(50) NOT NULL CHECK (question_type IN ('mcq', 'short', 'long', 'checkbox', 'rating')),
  options JSONB,
  is_required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0
);

-- Responses table (one row per submission)
CREATE TABLE IF NOT EXISTS responses (
  id SERIAL PRIMARY KEY,
  survey_id INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
  respondent_name VARCHAR(200),
  submitted_at TIMESTAMP DEFAULT NOW()
);

-- Answers table (one row per question per submission)
CREATE TABLE IF NOT EXISTS answers (
  id SERIAL PRIMARY KEY,
  response_id INTEGER REFERENCES responses(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  answer_value TEXT
);

-- User activity table
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);





-- Survey template table
CREATE TABLE IF NOT EXISTS survey_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  questions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Survey invitations
CREATE TABLE IF NOT EXISTS survey_invitations (
  id SERIAL PRIMARY KEY,
  survey_id INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  sent_at TIMESTAMP DEFAULT NOW(),
  opened_at TIMESTAMP,
  responded_at TIMESTAMP
);

-- File uploads
CREATE TABLE IF NOT EXISTS file_uploads (
  id SERIAL PRIMARY KEY,
  response_id INTEGER REFERENCES responses(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL,
  filename VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes INTEGER,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Skip rules
CREATE TABLE IF NOT EXISTS skip_rules (
  id SERIAL PRIMARY KEY,
  survey_id INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  condition_value TEXT NOT NULL,
  jump_to_question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE
);

-- Indexing for faster search
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at DESC);

-- Create default admin user (password: admin123 - bcrypt hashed)
-- You can insert this after running the schema
-- INSERT INTO users (username, email, password, role) VALUES ('admin', 'admin@surveybuilder.com', '$2a$10$...hashed...', 'admin');

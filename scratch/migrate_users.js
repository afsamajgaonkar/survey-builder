const pool = require('../config/db');

async function migrate() {
    try {
        console.log('Starting migration...');
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(50);');
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(50);');
        console.log('✅ Migration successful: Added first_name and last_name columns.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();

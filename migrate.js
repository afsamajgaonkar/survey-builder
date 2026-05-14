require('dotenv').config();
const pool = require('./config/db');

async function migrate() {
    try {
        await pool.query(`
            ALTER TABLE surveys 
            ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
        `);
        console.log('Migration successful');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}
migrate();

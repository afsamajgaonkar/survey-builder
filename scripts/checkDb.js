const pool = require('../config/db');
async function check() {
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log('TABLES:', tables.rows.map(r => r.table_name));
    const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'surveys' ORDER BY ordinal_position");
    console.log('SURVEY COLS:', cols.rows.map(r => r.column_name));
    process.exit(0);
}
check().catch(e => { console.error(e.message); process.exit(1); });

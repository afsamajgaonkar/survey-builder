require('dotenv').config();
const pool = require('./config/db');

async function upgradeUser() {
    try {
        await pool.query("UPDATE users SET role = 'admin' WHERE email = 'areen16032004@gmail.com'");
        console.log('Successfully upgraded areen16032004@gmail.com to admin!');
    } catch (err) {
        console.error('Failed:', err);
    } finally {
        process.exit();
    }
}
upgradeUser();

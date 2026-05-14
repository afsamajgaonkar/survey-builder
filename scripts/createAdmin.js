/**
 * One-time script to create the default admin user.
 * Run with: node scripts/createAdmin.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function createAdmin() {
    const username = 'admin';
    const email    = 'admin@surveybuilder.com';
    const password = 'Admin@123';   // ← change this if you want a different password
    const role     = 'admin';

    try {
        // Check if admin already exists
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            console.log('✅ Admin user already exists. No action taken.');
            process.exit(0);
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await pool.query(
            'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)',
            [username, email, hashedPassword, role]
        );

        console.log('✅ Admin user created successfully!');
        console.log(`   Email   : ${email}`);
        console.log(`   Password: ${password}`);
        console.log('   ⚠️  Change the password after first login!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error creating admin:', err.message);
        process.exit(1);
    }
}

createAdmin();

const pool = require('../config/db');

const User = {
    async findById(id) {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0];
    },

    async findByEmail(email) {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0];
    },

    async findByUsername(username) {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        return result.rows[0];
    },

    async create(username, email, hashedPassword, role = 'user', verificationToken = null) {
        const result = await pool.query(
            'INSERT INTO users (username, email, password, role, email_verified, verification_token) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [username, email, hashedPassword, role, false, verificationToken]
        );
        return result.rows[0];
    },

    /** Find a user by their email-verification token. */
    async findByVerificationToken(token) {
        const result = await pool.query(
            'SELECT * FROM users WHERE verification_token = $1',
            [token]
        );
        return result.rows[0];
    },

    /** Mark the user as email-verified and clear the token. */
    async verifyEmail(userId) {
        await pool.query(
            'UPDATE users SET email_verified = TRUE, verification_token = NULL WHERE id = $1',
            [userId]
        );
    },

    /**
     * Get all users with id, username, email, role, is_banned, created_at.
     * Sorted newest first.
     */
    async getAll() {
        const result = await pool.query(
            'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC'
        );
        return result.rows;
    },

    async getCount() {
        const result = await pool.query('SELECT COUNT(*) FROM users');
        return parseInt(result.rows[0].count);
    },

    /**
     * Update a user's role (admin/user).
     */
    async updateRole(userId, role) {
        await pool.query(
            'UPDATE users SET role = $1 WHERE id = $2',
            [role, userId]
        );
    },

    /**
     * Update username, email, and role for a user.
     */
    async updateUser(userId, username, email, role) {
        await pool.query(
            'UPDATE users SET username = $1, email = $2, role = $3 WHERE id = $4',
            [username, email, role, userId]
        );
    },

    /**
     * Update a user's password.
     */
    async updatePassword(userId, hashedPassword) {
        await pool.query(
            'UPDATE users SET password = $1 WHERE id = $2',
            [hashedPassword, userId]
        );
    },

    /**
     * Permanently delete a user and all associated data (CASCADE handles relations).
     */
    async deleteById(userId) {
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
};

module.exports = User;

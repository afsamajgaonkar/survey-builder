const pool = require('../config/db');

const Activity = {
    /**
     * Log a user activity event.
     * @param {number} userId - The user's DB id
     * @param {string} action - Human-readable action string e.g. "login", "create survey"
     */
    async log(userId, action) {
        try {
            await pool.query(
                `INSERT INTO user_activity (user_id, action) VALUES ($1, $2)`,
                [userId, action]
            );
        } catch (err) {
            // Non-critical: log to console but never crash the request
            console.error('[Activity] Failed to log activity:', err.message);
        }
    },

    /**
     * Get recent activities with username, action, and timestamp.
     * @param {number} limit - Max rows to return (default 50)
     */
    async getRecent(limit = 50) {
        const result = await pool.query(
            `SELECT ua.id, u.username, ua.action, ua.created_at
             FROM user_activity ua
             JOIN users u ON ua.user_id = u.id
             ORDER BY ua.created_at DESC
             LIMIT $1`,
            [limit]
        );
        return result.rows;
    },

    /**
     * Get all activities for a specific user.
     * @param {number} userId
     */
    async getByUser(userId) {
        const result = await pool.query(
            `SELECT id, action, created_at FROM user_activity
             WHERE user_id = $1 ORDER BY created_at DESC`,
            [userId]
        );
        return result.rows;
    },

    /**
     * Get total activity count.
     */
    async getCount() {
        const result = await pool.query(`SELECT COUNT(*) FROM user_activity`);
        return parseInt(result.rows[0].count);
    },

    /**
     * Delete an activity by its ID
     * @param {number} activityId
     */
    async delete(activityId) {
        await pool.query('DELETE FROM user_activity WHERE id = $1', [activityId]);
    }
};

module.exports = Activity;

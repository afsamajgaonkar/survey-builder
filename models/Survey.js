const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const Survey = {
    async create(userId, title, description, expiryDate = null, theme = 'default') {
        const shareLink = uuidv4().split('-')[0] + uuidv4().split('-')[1];
        const result = await pool.query(
            'INSERT INTO surveys (user_id, title, description, share_link, expiry_date, theme) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [userId, title, description, shareLink, expiryDate || null, theme]
        );
        return result.rows[0];
    },

    // Automatically move expired surveys to the recycle bin
    async autoTrashExpired() {
        await pool.query('UPDATE surveys SET deleted_at = NOW() WHERE expiry_date < NOW() AND deleted_at IS NULL');
    },

    async findById(id) {
        const result = await pool.query('SELECT * FROM surveys WHERE id = $1', [id]);
        return result.rows[0];
    },

    async findByUserId(userId) {
        const result = await pool.query(
            'SELECT s.*, (SELECT COUNT(*) FROM responses r WHERE r.survey_id = s.id) as response_count FROM surveys s WHERE s.user_id = $1 AND s.deleted_at IS NULL ORDER BY s.created_at DESC',
            [userId]
        );
        return result.rows;
    },

    // Soft-delete: move to Recycle Bin
    async softDelete(id) {
        await pool.query('UPDATE surveys SET deleted_at = NOW() WHERE id = $1', [id]);
    },

    // List trashed surveys for a user
    async findTrashed(userId) {
        const result = await pool.query(
            'SELECT s.*, (SELECT COUNT(*) FROM responses r WHERE r.survey_id = s.id) as response_count FROM surveys s WHERE s.user_id = $1 AND s.deleted_at IS NOT NULL ORDER BY s.deleted_at DESC',
            [userId]
        );
        return result.rows;
    },

    // All trashed surveys (admin)
    async findAllTrashed() {
        const result = await pool.query(
            `SELECT s.*, u.username as author, (SELECT COUNT(*) FROM responses r WHERE r.survey_id = s.id) as response_count
             FROM surveys s JOIN users u ON s.user_id = u.id
             WHERE s.deleted_at IS NOT NULL ORDER BY s.deleted_at DESC`
        );
        return result.rows;
    },

    // Restore from Recycle Bin
    async restore(id) {
        await pool.query('UPDATE surveys SET deleted_at = NULL WHERE id = $1', [id]);
    },

    // Permanent delete
    async hardDelete(id) {
        await pool.query('DELETE FROM surveys WHERE id = $1', [id]);
    },

    // Count trashed surveys for a user
    async getDeletedCount(userId) {
        const result = await pool.query(
            'SELECT COUNT(*) FROM surveys WHERE user_id = $1 AND deleted_at IS NOT NULL',
            [userId]
        );
        return parseInt(result.rows[0].count);
    },

    async findByShareLink(shareLink) {
        const result = await pool.query('SELECT * FROM surveys WHERE share_link = $1', [shareLink]);
        return result.rows[0];
    },

    async getAll() {
        const result = await pool.query(
            `SELECT s.*, u.username as author, 
       (SELECT COUNT(*) FROM responses r WHERE r.survey_id = s.id) as response_count 
       FROM surveys s JOIN users u ON s.user_id = u.id
       WHERE s.deleted_at IS NULL
       ORDER BY s.created_at DESC`
        );
        return result.rows;
    },

    async update(id, title, description, isActive, expiryDate = null, theme = 'default') {
        const result = await pool.query(
            'UPDATE surveys SET title = $1, description = $2, is_active = $3, expiry_date = $4, theme = $5, updated_at = NOW() WHERE id = $6 RETURNING *',
            [title, description, isActive, expiryDate || null, theme, id]
        );
        return result.rows[0];
    },

    async delete(id) {
        await pool.query('DELETE FROM surveys WHERE id = $1', [id]);
    },

    async addQuestion(surveyId, questionText, questionType, options, isRequired, sortOrder) {
        const result = await pool.query(
            'INSERT INTO questions (survey_id, question_text, question_type, options, is_required, sort_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [surveyId, questionText, questionType, options ? JSON.stringify(options) : null, isRequired, sortOrder]
        );
        return result.rows[0];
    },

    async getQuestions(surveyId) {
        const result = await pool.query(
            'SELECT * FROM questions WHERE survey_id = $1 ORDER BY sort_order ASC',
            [surveyId]
        );
        return result.rows;
    },

    async deleteQuestions(surveyId) {
        await pool.query('DELETE FROM questions WHERE survey_id = $1', [surveyId]);
    },

    async getCount() {
        const result = await pool.query('SELECT COUNT(*) FROM surveys');
        return parseInt(result.rows[0].count);
    },

    async getCountByUserId(userId) {
        const result = await pool.query('SELECT COUNT(*) FROM surveys WHERE user_id = $1', [userId]);
        return parseInt(result.rows[0].count);
    }
};

module.exports = Survey;

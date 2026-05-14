const pool = require('../config/db');

const Invitation = {
    async create(surveyId, email, token) {
        const result = await pool.query(
            'INSERT INTO survey_invitations (survey_id, email, token) VALUES ($1, $2, $3) RETURNING *',
            [surveyId, email, token]
        );
        return result.rows[0];
    },

    async findByToken(token) {
        const result = await pool.query('SELECT * FROM survey_invitations WHERE token = $1', [token]);
        return result.rows[0];
    },

    async findBySurvey(surveyId) {
        const result = await pool.query(
            'SELECT * FROM survey_invitations WHERE survey_id = $1 ORDER BY sent_at DESC',
            [surveyId]
        );
        return result.rows;
    },

    async markOpened(token) {
        await pool.query(
            'UPDATE survey_invitations SET opened_at = NOW() WHERE token = $1 AND opened_at IS NULL',
            [token]
        );
    },

    async markResponded(surveyId, email) {
        await pool.query(
            'UPDATE survey_invitations SET responded_at = NOW() WHERE survey_id = $1 AND email = $2 AND responded_at IS NULL',
            [surveyId, email]
        );
    },

    async findByEmail(surveyId, email) {
        const result = await pool.query(
            'SELECT * FROM survey_invitations WHERE survey_id = $1 AND email = $2',
            [surveyId, email]
        );
        return result.rows[0];
    }
};

module.exports = Invitation;

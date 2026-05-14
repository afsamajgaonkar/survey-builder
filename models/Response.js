const pool = require('../config/db');

const Response = {
    async create(surveyId, respondentName) {
        const result = await pool.query(
            'INSERT INTO responses (survey_id, respondent_name) VALUES ($1, $2) RETURNING *',
            [surveyId, respondentName || 'Anonymous']
        );
        return result.rows[0];
    },

    async saveAnswers(responseId, answers) {
        // answers is an array of { questionId, answerValue }
        const promises = answers.map((a) =>
            pool.query(
                'INSERT INTO answers (response_id, question_id, answer_value) VALUES ($1, $2, $3)',
                [responseId, a.questionId, typeof a.answerValue === 'object' ? JSON.stringify(a.answerValue) : a.answerValue]
            )
        );
        await Promise.all(promises);
    },

    async getBySurveyId(surveyId) {
        const result = await pool.query(
            'SELECT * FROM responses WHERE survey_id = $1 ORDER BY submitted_at DESC',
            [surveyId]
        );
        return result.rows;
    },

    async getAnswersByResponseId(responseId) {
        const result = await pool.query(
            `SELECT a.*, q.question_text, q.question_type, q.options 
       FROM answers a 
       JOIN questions q ON a.question_id = q.id 
       WHERE a.response_id = $1 
       ORDER BY q.sort_order ASC`,
            [responseId]
        );
        return result.rows;
    },

    async getDetailedBySurveyId(surveyId) {
        const responses = await pool.query(
            'SELECT * FROM responses WHERE survey_id = $1 ORDER BY submitted_at DESC',
            [surveyId]
        );

        const detailed = [];
        for (const resp of responses.rows) {
            const answers = await pool.query(
                `SELECT a.*, q.question_text, q.question_type 
         FROM answers a JOIN questions q ON a.question_id = q.id 
         WHERE a.response_id = $1 ORDER BY q.sort_order ASC`,
                [resp.id]
            );
            detailed.push({ ...resp, answers: answers.rows });
        }
        return detailed;
    },

    async getCountBySurveyId(surveyId) {
        const result = await pool.query('SELECT COUNT(*) FROM responses WHERE survey_id = $1', [surveyId]);
        return parseInt(result.rows[0].count);
    },

    async getTotalCount() {
        const result = await pool.query('SELECT COUNT(*) FROM responses');
        return parseInt(result.rows[0].count);
    },

    async getTotalCountByUserId(userId) {
        const result = await pool.query(
            'SELECT COUNT(*) FROM responses r JOIN surveys s ON r.survey_id = s.id WHERE s.user_id = $1',
            [userId]
        );
        return parseInt(result.rows[0].count);
    },

    async findById(id) {
        const result = await pool.query('SELECT * FROM responses WHERE id = $1', [id]);
        return result.rows[0];
    },

    async delete(id) {
        // Answers are likely set to CASCADE on response_id, but let's be explicit if needed or just delete response
        // In most Postgres setups for this project, I've seen CASCADE. 
        // If not, I'll delete answers first just in case.
        await pool.query('DELETE FROM answers WHERE response_id = $1', [id]);
        await pool.query('DELETE FROM responses WHERE id = $1', [id]);
    }
};

module.exports = Response;

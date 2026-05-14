const pool = require('../config/db');

const Template = {
    async getAll() {
        const result = await pool.query('SELECT * FROM survey_templates ORDER BY category, name');
        return result.rows;
    },

    async findById(id) {
        const result = await pool.query('SELECT * FROM survey_templates WHERE id = $1', [id]);
        return result.rows[0];
    }
};

module.exports = Template;

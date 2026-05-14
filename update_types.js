require('dotenv').config();
const pool = require('./config/db');

async function updateSchema() {
    try {
        // Drop the constraint if it exists (the name is usually table_column_check)
        await pool.query('ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_question_type_check;');
        
        // Add the new constraint with all types
        await pool.query(`ALTER TABLE questions ADD CONSTRAINT questions_question_type_check 
            CHECK (question_type IN ('mcq', 'short', 'long', 'checkbox', 'rating', 'file', 'dropdown', 'yesno', 'datetime'));`);
            
        console.log('Successfully updated question_type check constraint!');
    } catch (err) {
        console.error('Failed:', err);
    } finally {
        process.exit();
    }
}
updateSchema();

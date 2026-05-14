require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Running migrations...');

        // Module 2: Survey Themes
        await client.query(`ALTER TABLE surveys ADD COLUMN IF NOT EXISTS theme VARCHAR(50) DEFAULT 'default'`);
        console.log('✅ Module 2: Added theme column to surveys');

        // Module 3: Survey Templates
        await client.query(`
            CREATE TABLE IF NOT EXISTS survey_templates (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                category VARCHAR(100),
                questions JSONB NOT NULL DEFAULT '[]',
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Module 3: Created survey_templates table');

        // Module 1: Email Invitations
        await client.query(`
            CREATE TABLE IF NOT EXISTS survey_invitations (
                id SERIAL PRIMARY KEY,
                survey_id INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
                email VARCHAR(255) NOT NULL,
                token VARCHAR(255) UNIQUE NOT NULL,
                sent_at TIMESTAMP DEFAULT NOW(),
                opened_at TIMESTAMP,
                responded_at TIMESTAMP
            )
        `);
        console.log('✅ Module 1: Created survey_invitations table');

        // Module 5: File Uploads
        await client.query(`
            CREATE TABLE IF NOT EXISTS file_uploads (
                id SERIAL PRIMARY KEY,
                response_id INTEGER REFERENCES responses(id) ON DELETE CASCADE,
                question_id INTEGER NOT NULL,
                filename VARCHAR(500) NOT NULL,
                original_name VARCHAR(500) NOT NULL,
                mime_type VARCHAR(100),
                size_bytes INTEGER,
                uploaded_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Module 5: Created file_uploads table');

        // Module 6: Skip Logic
        await client.query(`
            CREATE TABLE IF NOT EXISTS skip_rules (
                id SERIAL PRIMARY KEY,
                survey_id INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
                question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
                condition_value TEXT NOT NULL,
                jump_to_question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ Module 6: Created skip_rules table');

        // Seed Templates
        const existingTemplates = await client.query('SELECT COUNT(*) FROM survey_templates');
        if (parseInt(existingTemplates.rows[0].count) === 0) {
            const templates = [
                {
                    name: 'Customer Satisfaction',
                    description: 'Measure how happy your customers are with your product or service.',
                    category: 'Business',
                    questions: JSON.stringify([
                        { text: 'How satisfied are you with our product/service overall?', type: 'rating', required: true },
                        { text: 'How likely are you to recommend us to a friend or colleague?', type: 'rating', required: true },
                        { text: 'What did you like most about our service?', type: 'long', required: false },
                        { text: 'What could we improve?', type: 'long', required: false },
                        { text: 'How did you hear about us?', type: 'mcq', required: false, options: ['Social Media', 'Friend/Colleague', 'Search Engine', 'Advertisement', 'Other'] }
                    ])
                },
                {
                    name: 'Employee Feedback',
                    description: 'Collect anonymous feedback from your team about the workplace.',
                    category: 'HR',
                    questions: JSON.stringify([
                        { text: 'How satisfied are you with your current role?', type: 'rating', required: true },
                        { text: 'Do you feel your work is recognized and appreciated?', type: 'mcq', required: true, options: ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'] },
                        { text: 'How would you rate communication within your team?', type: 'rating', required: true },
                        { text: 'What do you enjoy most about working here?', type: 'long', required: false },
                        { text: 'What changes would improve your work experience?', type: 'long', required: false }
                    ])
                },
                {
                    name: 'Event Registration',
                    description: 'Collect sign-up information for your upcoming event.',
                    category: 'Events',
                    questions: JSON.stringify([
                        { text: 'What is your full name?', type: 'short', required: true },
                        { text: 'What is your email address?', type: 'short', required: true },
                        { text: 'Which sessions are you interested in attending?', type: 'checkbox', required: true, options: ['Opening Keynote', 'Workshop A', 'Workshop B', 'Panel Discussion', 'Networking Lunch', 'Closing Ceremony'] },
                        { text: 'Do you have any dietary requirements?', type: 'mcq', required: false, options: ['None', 'Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-Free'] },
                        { text: 'Any questions or special requests?', type: 'long', required: false }
                    ])
                },
                {
                    name: 'Product Feedback',
                    description: 'Gather insights on a specific product from your users.',
                    category: 'Product',
                    questions: JSON.stringify([
                        { text: 'How easy is the product to use?', type: 'rating', required: true },
                        { text: 'Which features do you use most often?', type: 'checkbox', required: true, options: ['Feature A', 'Feature B', 'Feature C', 'Feature D'] },
                        { text: 'What is the most important missing feature?', type: 'short', required: false },
                        { text: 'How does our product compare to alternatives you have tried?', type: 'mcq', required: false, options: ['Much Better', 'Slightly Better', 'About the Same', 'Slightly Worse', 'Much Worse'] },
                        { text: 'Any other feedback?', type: 'long', required: false }
                    ])
                },
                {
                    name: 'Course Evaluation',
                    description: 'Let students rate and provide feedback on a course or training.',
                    category: 'Education',
                    questions: JSON.stringify([
                        { text: 'How would you rate the overall quality of this course?', type: 'rating', required: true },
                        { text: 'Was the course content relevant to your needs?', type: 'mcq', required: true, options: ['Very Relevant', 'Somewhat Relevant', 'Neutral', 'Not Very Relevant', 'Not Relevant at All'] },
                        { text: 'How would you rate the instructor\'s teaching style?', type: 'rating', required: true },
                        { text: 'What was the most valuable part of this course?', type: 'long', required: false },
                        { text: 'What topics should be added or improved?', type: 'long', required: false }
                    ])
                }
            ];

            for (const t of templates) {
                await client.query(
                    'INSERT INTO survey_templates (name, description, category, questions) VALUES ($1, $2, $3, $4)',
                    [t.name, t.description, t.category, t.questions]
                );
            }
            console.log('✅ Module 3: Seeded 5 survey templates');
        } else {
            console.log('ℹ️  Templates already seeded, skipping');
        }

        console.log('\n🎉 All migrations complete!');
    } catch (err) {
        console.error('❌ Migration error:', err.message);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();

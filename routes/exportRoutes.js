const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const Survey = require('../models/Survey');
const Response = require('../models/Response');
const { ensureAuthenticated } = require('../middleware/auth');

// Export survey responses to CSV
router.get('/:id/export', ensureAuthenticated, async (req, res) => {
    try {
        const survey = await Survey.findById(req.params.id);
        if (!survey) {
            req.flash('error_msg', 'Survey not found');
            return res.redirect('/dashboard');
        }
        
        // Check authorization (owner or admin)
        if (survey.user_id !== req.user.id && req.user.role !== 'admin') {
            req.flash('error_msg', 'Not authorized');
            return res.redirect('/dashboard');
        }

        const responses = await Response.getDetailedBySurveyId(survey.id);
        const questions = await Survey.getQuestions(survey.id);

        if (responses.length === 0) {
            req.flash('error_msg', 'No responses to export');
            return res.redirect(`/surveys/${survey.id}/responses`);
        }

        // Prepare data for CSV
        const csvData = [];
        responses.forEach(r => {
            const row = {
                'Response ID': r.id,
                'Respondent Name': r.respondent_name || 'Anonymous',
                'Submitted At': new Date(r.submitted_at).toLocaleString(),
            };

            // Map each answer to its corresponding question text
            r.answers.forEach(a => {
                const question = questions.find(q => q.id === a.question_id);
                if (question) {
                    let answerValue = a.answer_value;
                    try {
                        // Attempt to parse array values (like checkboxes)
                        const parsed = JSON.parse(answerValue);
                        if (Array.isArray(parsed)) {
                            answerValue = parsed.join(', ');
                        }
                    } catch (e) {
                         // Not JSON, keep as is
                    }
                    row[question.question_text] = answerValue;
                }
            });

            csvData.push(row);
        });

        const parser = new Parser();
        const csv = parser.parse(csvData);

        res.header('Content-Type', 'text/csv');
        res.attachment(`Survey_Responses_${survey.id}.csv`);
        res.send(csv);

    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error exporting data');
        res.redirect('/dashboard');
    }
});

module.exports = router;

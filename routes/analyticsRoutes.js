const express = require('express');
const router = express.Router();
const Survey = require('../models/Survey');
const Response = require('../models/Response');
const { ensureAuthenticated } = require('../middleware/auth');

// View Analytics Page
router.get('/survey/:id', ensureAuthenticated, async (req, res) => {
    try {
        const survey = await Survey.findById(req.params.id);
        if (!survey) {
            req.flash('error_msg', 'Survey not found');
            return res.redirect('/dashboard');
        }
        if (survey.user_id !== req.user.id && req.user.role !== 'admin') {
            req.flash('error_msg', 'Not authorized');
            return res.redirect('/dashboard');
        }

        res.render('analytics', { title: `Analytics - ${survey.title}`, survey });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error loading analytics page');
        res.redirect('/dashboard');
    }
});

// API endpoint to get aggregated data for charts
router.get('/survey/:id/data', ensureAuthenticated, async (req, res) => {
    try {
        const survey = await Survey.findById(req.params.id);
        if (!survey || (survey.user_id !== req.user.id && req.user.role !== 'admin')) {
            return res.status(403).json({ error: 'Not authorized or survey not found' });
        }

        const questions = await Survey.getQuestions(survey.id);
        const responses = await Response.getDetailedBySurveyId(survey.id);

        const analyticsData = [];

        for (const question of questions) {
            const dataObj = {
                questionId: question.id,
                questionText: question.question_text,
                questionType: question.question_type,
                totalAnswers: 0
            };

            // Only aggregate for mcq, checkbox, rating, dropdown, and yesno types
            if (['mcq', 'checkbox', 'rating', 'dropdown', 'yesno'].includes(question.question_type)) {
                const distribution = {};
                
                responses.forEach(resp => {
                    const answer = resp.answers.find(a => a.question_id === question.id);
                    if (answer && answer.answer_value) {
                        dataObj.totalAnswers++;
                        let val = answer.answer_value;
                        if (question.question_type === 'checkbox') {
                            try {
                                const parsed = JSON.parse(val);
                                if (Array.isArray(parsed)) {
                                    parsed.forEach(opt => {
                                        distribution[opt] = (distribution[opt] || 0) + 1;
                                    });
                                }
                            } catch (e) {}
                        } else {
                            distribution[val] = (distribution[val] || 0) + 1;
                        }
                    }
                });

                dataObj.labels = Object.keys(distribution);
                dataObj.data = Object.values(distribution);
            } else if (['short', 'long', 'datetime'].includes(question.question_type)) {
                // Return a list of up to latest 50 text responses
                const textAnswers = [];
                responses.forEach(resp => {
                    const answer = resp.answers.find(a => a.question_id === question.id);
                    if (answer && answer.answer_value && answer.answer_value.trim() !== '') {
                        dataObj.totalAnswers++;
                        if (textAnswers.length < 50) {
                            textAnswers.push({
                                respondent: resp.respondent_name || 'Anonymous',
                                date: resp.submitted_at,
                                text: answer.answer_value
                            });
                        }
                    }
                });
                dataObj.textAnswers = textAnswers;
            }
            
            analyticsData.push(dataObj);
        }

        res.json(analyticsData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

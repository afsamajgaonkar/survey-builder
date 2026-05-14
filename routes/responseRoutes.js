const express = require('express');
const router = express.Router();
const Survey = require('../models/Survey');
const Response = require('../models/Response');
const Activity = require('../models/Activity');
const { ensureAuthenticated } = require('../middleware/auth');

// Public survey page (accessible via share link)
router.get('/s/:shareLink', async (req, res) => {
    try {
        await Survey.autoTrashExpired();
        const survey = await Survey.findByShareLink(req.params.shareLink);
        if (!survey) {
            return res.status(404).render('404', { title: 'Survey Not Found' });
        }
        if (!survey.is_active) {
            return res.render('survey-closed', { title: 'Survey Closed', survey });
        }
        if (survey.expiry_date && new Date() > new Date(survey.expiry_date)) {
            return res.render('survey-closed', { title: 'Survey Expired', survey });
        }
        if (survey.deleted_at) {
            return res.status(404).render('404', { title: 'Survey Not Found' });
        }
        const questions = await Survey.getQuestions(survey.id);
        res.render('survey-respond', { title: survey.title, survey, questions, submitted: false });
    } catch (err) {
        console.error(err);
        res.status(500).render('404', { title: 'Error' });
    }
});

// Submit response
router.post('/s/:shareLink/submit', async (req, res) => {
    try {
        const survey = await Survey.findByShareLink(req.params.shareLink);
        if (!survey || !survey.is_active) {
            return res.status(404).render('404', { title: 'Survey Not Found' });
        }
        if (survey.expiry_date && new Date() > new Date(survey.expiry_date)) {
             return res.render('survey-closed', { title: 'Survey Expired', survey });
        }
        if (survey.deleted_at) {
            return res.status(404).render('404', { title: 'Survey Not Found' });
        }

        const { respondent_name } = req.body;
        const questions = await Survey.getQuestions(survey.id);

        // Create response record
        const response = await Response.create(survey.id, respondent_name);
        
        // Log activity for the survey owner
        await Activity.log(survey.user_id, 'Received a survey response');

        // Collect answers
        const answers = [];
        for (const q of questions) {
            let answerValue = req.body[`question_${q.id}`];

            // Handle checkbox (multiple values)
            if (q.question_type === 'checkbox' && Array.isArray(answerValue)) {
                answerValue = JSON.stringify(answerValue);
            } else if (q.question_type === 'checkbox' && answerValue) {
                answerValue = JSON.stringify([answerValue]);
            }

            if (answerValue !== undefined && answerValue !== '') {
                answers.push({ questionId: q.id, answerValue: answerValue });
            }
        }

        // ✅ Backend guard: reject if no answers provided at all
        if (answers.length === 0) {
            req.flash('error_msg', 'Please answer at least one question before submitting.');
            return res.redirect(`/s/${req.params.shareLink}`);
        }

        await Response.saveAnswers(response.id, answers);

        // Log activity for the survey owner
        await Activity.log(survey.user_id, 'Received a survey response');

        res.render('survey-respond', {
            title: 'Thank You!',
            survey,
            questions,
            submitted: true,
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error submitting response');
        res.redirect(`/s/${req.params.shareLink}`);
    }
});

// View responses for a survey (owner only)
router.get('/surveys/:id/responses', ensureAuthenticated, async (req, res) => {
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

        const questions = await Survey.getQuestions(survey.id);
        const responses = await Response.getDetailedBySurveyId(survey.id);
        const responseCount = responses.length;

        res.render('responses', {
            title: `Responses - ${survey.title}`,
            survey,
            questions,
            responses,
            responseCount,
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error loading responses');
        res.redirect('/dashboard');
    }
});

// Delete a response (owner only)
router.post('/responses/:id/delete', ensureAuthenticated, async (req, res) => {
    try {
        const response = await Response.findById(req.params.id);
        if (!response) {
            req.flash('error_msg', 'Response not found');
            return res.redirect('back');
        }

        const survey = await Survey.findById(response.survey_id);
        if (!survey || (survey.user_id !== req.user.id && req.user.role !== 'admin')) {
            req.flash('error_msg', 'Not authorized');
            return res.redirect('back');
        }

        await Response.delete(req.params.id);
        req.flash('success_msg', 'Response deleted successfully');
        res.redirect(`/surveys/${survey.id}/responses`);
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error deleting response');
        res.redirect('back');
    }
});

module.exports = router;

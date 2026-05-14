const express = require('express');
const router = express.Router();
const Survey = require('../models/Survey');

// Serve the embed-friendly (no header/footer) version of a survey
router.get('/:shareLink', async (req, res) => {
    try {
        const survey = await Survey.findByShareLink(req.params.shareLink);
        if (!survey || !survey.is_active) {
            return res.status(404).send('<p style="font-family:sans-serif;padding:20px;color:#666;">Survey not found or no longer active.</p>');
        }

        // Check expiry
        if (survey.expiry_date && new Date(survey.expiry_date) < new Date()) {
            return res.status(410).send('<p style="font-family:sans-serif;padding:20px;color:#666;">This survey has expired.</p>');
        }

        const questions = await Survey.getQuestions(survey.id);
        res.render('survey-embed', { title: survey.title, survey, questions });
    } catch (err) {
        console.error(err);
        res.status(500).send('<p>Error loading survey.</p>');
    }
});

module.exports = router;

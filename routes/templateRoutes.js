const express = require('express');
const router = express.Router();
const Template = require('../models/Template');
const Survey = require('../models/Survey');
const Activity = require('../models/Activity');
const { ensureAuthenticated } = require('../middleware/auth');

// List all templates
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        const templates = await Template.getAll();
        // Group by category
        const grouped = templates.reduce((acc, t) => {
            if (!acc[t.category]) acc[t.category] = [];
            acc[t.category].push(t);
            return acc;
        }, {});
        res.render('templates', { title: 'Survey Templates', grouped });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error loading templates');
        res.redirect('/dashboard');
    }
});

// Use a template — clone it into a new survey
router.post('/:id/use', ensureAuthenticated, async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);
        if (!template) {
            req.flash('error_msg', 'Template not found');
            return res.redirect('/templates');
        }

        const survey = await Survey.create(req.user.id, template.name, template.description || '');
        await Activity.log(req.user.id, `Created survey from template: ${template.name}`);

        const questions = Array.isArray(template.questions) ? template.questions : JSON.parse(template.questions);
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            await Survey.addQuestion(
                survey.id,
                q.text,
                q.type,
                q.options || null,
                q.required || false,
                i
            );
        }

        req.flash('success_msg', `Survey created from "${template.name}" template! Customize it below.`);
        res.redirect(`/surveys/${survey.id}/edit`);
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error creating survey from template');
        res.redirect('/templates');
    }
});

module.exports = router;

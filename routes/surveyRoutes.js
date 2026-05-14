const express = require('express');
const router = express.Router();
const Survey = require('../models/Survey');
const Activity = require('../models/Activity');
const { ensureAuthenticated } = require('../middleware/auth');

// ── Meaningful-text validator ──────────────────────────────────────────────
// Returns an error string if the text is gibberish/spam, or null if it's OK.
function validateMeaningfulText(text, fieldName, minLen = 3) {
    const t = (text || '').trim();
    if (!t) return `${fieldName} is required.`;
    if (t.length < minLen) return `${fieldName} must be at least ${minLen} characters.`;

    // Reject strings made of a single repeated character (e.g. "aaaaaaa", "------")
    if (/^(.)\1+$/.test(t)) return `${fieldName} contains repeated characters. Please enter meaningful text.`;

    const lower = t.toLowerCase().replace(/\s/g, '');

    // Reject strings where >70% chars are consonants with no vowel groups (gibberish pattern)
    const vowels = new Set(['a','e','i','o','u']);
    const letters = lower.replace(/[^a-z]/g, '');
    if (letters.length >= 6) {
        const vowelCount = [...letters].filter(c => vowels.has(c)).length;
        const ratio = vowelCount / letters.length;
        if (ratio < 0.1) return `${fieldName} doesn't appear to contain real words. Please describe your survey properly.`;
    }

    // Reject pure numbers / symbols with no real words
    if (/^[\d\s\W]+$/.test(t)) return `${fieldName} must contain real words, not just numbers or symbols.`;

    return null; // valid
}

// Show survey builder (create new)
router.get('/new', ensureAuthenticated, (req, res) => {
    res.render('survey-builder', { title: 'Create Survey', survey: null, questions: [] });
});

// Create a new survey
router.post('/', ensureAuthenticated, async (req, res) => {
    try {
        const { title, description, expiry_date } = req.body;
        let questions = req.body.questions;

        // ── Validate title ──
        const titleErr = validateMeaningfulText(title, 'Survey Title', 5);
        if (titleErr) {
            req.flash('error_msg', titleErr);
            return res.redirect('/surveys/new');
        }

        // ── Validate description (optional but if provided must be meaningful) ──
        if (description && description.trim().length > 0) {
            const descErr = validateMeaningfulText(description, 'Description', 10);
            if (descErr) {
                req.flash('error_msg', descErr);
                return res.redirect('/surveys/new');
            }
        }

        // ── Validate expiry date ──
        if (expiry_date) {
            if (new Date(expiry_date) < new Date()) {
                req.flash('error_msg', 'Expiry date cannot be in the past.');
                return res.redirect('/surveys/new');
            }
        }

        // Normalise questions
        if (questions && !Array.isArray(questions)) questions = Object.values(questions);

        // ── Validate each question text ──
        if (questions && Array.isArray(questions)) {
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                if (!q || !q.text || !q.text.trim()) continue;
                const qErr = validateMeaningfulText(q.text, `Question ${i + 1}`, 5);
                if (qErr) {
                    req.flash('error_msg', qErr);
                    return res.redirect('/surveys/new');
                }
            }
        }

        // Create survey
        const survey = await Survey.create(req.user.id, title.trim(), description ? description.trim() : '', expiry_date || null, req.body.theme || 'default');
        await Activity.log(req.user.id, 'Created a survey');

        if (questions && Array.isArray(questions)) {
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                if (!q || !q.text || !q.text.trim()) continue;
                let options = null;
                if ((q.type === 'mcq' || q.type === 'checkbox' || q.type === 'dropdown') && q.options) {
                    const opts = Array.isArray(q.options) ? q.options : Object.values(q.options);
                    options = opts.filter((opt) => opt && opt.trim());
                }
                await Survey.addQuestion(survey.id, q.text.trim(), q.type, options, q.required === 'true' || q.required === true, i);
            }
        }

        req.flash('success_msg', 'Survey created successfully!');
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error creating survey. Please try again.');
        res.redirect('/surveys/new');
    }
});

// Edit survey form
router.get('/:id/edit', ensureAuthenticated, async (req, res) => {
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
        res.render('survey-builder', { title: 'Edit Survey', survey, questions });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error loading survey');
        res.redirect('/dashboard');
    }
});

// Update survey
router.post('/:id/update', ensureAuthenticated, async (req, res) => {
    try {
        const survey = await Survey.findById(req.params.id);
        if (!survey || (survey.user_id !== req.user.id && req.user.role !== 'admin')) {
            req.flash('error_msg', 'Not authorized');
            return res.redirect('/dashboard');
        }

        const { title, description, is_active, expiry_date } = req.body;
        let questions = req.body.questions;

        // ── Validate title ──
        const titleErr = validateMeaningfulText(title, 'Survey Title', 5);
        if (titleErr) {
            req.flash('error_msg', titleErr);
            return res.redirect(`/surveys/${req.params.id}/edit`);
        }

        // ── Validate description if provided ──
        if (description && description.trim().length > 0) {
            const descErr = validateMeaningfulText(description, 'Description', 10);
            if (descErr) {
                req.flash('error_msg', descErr);
                return res.redirect(`/surveys/${req.params.id}/edit`);
            }
        }

        // ── Validate expiry date ──
        if (expiry_date) {
            if (new Date(expiry_date) < new Date()) {
                req.flash('error_msg', 'Expiry date cannot be in the past.');
                return res.redirect(`/surveys/${req.params.id}/edit`);
            }
        }

        // Normalise questions
        if (questions && !Array.isArray(questions)) questions = Object.values(questions);

        // ── Validate each question text ──
        if (questions && Array.isArray(questions)) {
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                if (!q || !q.text || !q.text.trim()) continue;
                const qErr = validateMeaningfulText(q.text, `Question ${i + 1}`, 5);
                if (qErr) {
                    req.flash('error_msg', qErr);
                    return res.redirect(`/surveys/${req.params.id}/edit`);
                }
            }
        }

        await Survey.update(req.params.id, title.trim(), description ? description.trim() : '', is_active === 'true' || is_active === 'on', expiry_date || null, req.body.theme || 'default');

        // Delete old questions and re-add
        await Survey.deleteQuestions(req.params.id);
        if (questions && Array.isArray(questions)) {
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                if (!q || !q.text || !q.text.trim()) continue;
                let options = null;
                if ((q.type === 'mcq' || q.type === 'checkbox' || q.type === 'dropdown') && q.options) {
                    const opts = Array.isArray(q.options) ? q.options : Object.values(q.options);
                    options = opts.filter((opt) => opt && opt.trim());
                }
                await Survey.addQuestion(req.params.id, q.text.trim(), q.type, options, q.required === 'true' || q.required === true, i);
            }
        }

        req.flash('success_msg', 'Survey updated successfully!');
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error updating survey');
        res.redirect('/dashboard');
    }
});

// Soft-delete survey (move to Recycle Bin)
router.post('/:id/trash', ensureAuthenticated, async (req, res) => {
    try {
        const survey = await Survey.findById(req.params.id);
        if (!survey || (survey.user_id !== req.user.id && req.user.role !== 'admin')) {
            req.flash('error_msg', 'Not authorized');
            return res.redirect('/dashboard');
        }
        await Survey.softDelete(req.params.id);
        await Activity.log(req.user.id, 'Moved survey to recycle bin');
        req.flash('success_msg', 'Survey moved to Recycle Bin');
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error moving survey to bin');
        res.redirect('/dashboard');
    }
});

// Restore survey from Recycle Bin
router.post('/:id/restore', ensureAuthenticated, async (req, res) => {
    try {
        const survey = await Survey.findById(req.params.id);
        if (!survey || (survey.user_id !== req.user.id && req.user.role !== 'admin')) {
            req.flash('error_msg', 'Not authorized');
            return res.redirect('/recycle-bin');
        }
        await Survey.restore(req.params.id);
        req.flash('success_msg', 'Survey restored successfully');
        res.redirect('/recycle-bin');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error restoring survey');
        res.redirect('/recycle-bin');
    }
});

// Permanently delete survey
router.post('/:id/delete', ensureAuthenticated, async (req, res) => {
    try {
        const survey = await Survey.findById(req.params.id);
        if (!survey || (survey.user_id !== req.user.id && req.user.role !== 'admin')) {
            req.flash('error_msg', 'Not authorized');
            return res.redirect('/recycle-bin');
        }
        await Survey.hardDelete(req.params.id);
        await Activity.log(req.user.id, 'Deleted a survey permanently');
        req.flash('success_msg', 'Survey permanently deleted');
        res.redirect('/recycle-bin');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error deleting survey');
        res.redirect('/recycle-bin');
    }
});

// Preview survey
router.get('/:id/preview', ensureAuthenticated, async (req, res) => {
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
        res.render('survey-preview', { title: survey.title, survey, questions });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error loading survey preview');
        res.redirect('/dashboard');
    }
});

// Empty entire Recycle Bin (bulk hard-delete all trashed)
router.post('/empty-bin', ensureAuthenticated, async (req, res) => {
    try {
        const pool = require('../config/db');
        await pool.query(
            'DELETE FROM surveys WHERE user_id = $1 AND deleted_at IS NOT NULL',
            [req.user.id]
        );
        req.flash('success_msg', 'Recycle Bin emptied — all surveys permanently deleted');
        res.redirect('/recycle-bin');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error emptying recycle bin');
        res.redirect('/recycle-bin');
    }
});

module.exports = router;

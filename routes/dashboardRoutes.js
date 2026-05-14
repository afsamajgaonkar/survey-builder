const express = require('express');
const router = express.Router();
const Survey = require('../models/Survey');
const Response = require('../models/Response');
const User = require('../models/User');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');

// User Dashboard
router.get('/dashboard', ensureAuthenticated, async (req, res) => {
    try {
        await Survey.autoTrashExpired();
        const surveys = await Survey.findByUserId(req.user.id);
        const totalSurveys = surveys.length;
        const totalResponses = await Response.getTotalCountByUserId(req.user.id);
        const activeSurveys = surveys.filter((s) => s.is_active).length;
        const recycleBinCount = await Survey.getDeletedCount(req.user.id);

        res.render('dashboard', {
            title: 'Dashboard',
            surveys,
            totalSurveys,
            totalResponses,
            activeSurveys,
            recycleBinCount,
        });
    } catch (err) {
        console.error('Dashboard error:', err.message);
        req.flash('error_msg', 'Error loading dashboard');
        res.redirect('/');
    }
});

// Recycle Bin page
router.get('/recycle-bin', ensureAuthenticated, async (req, res) => {
    try {
        const trashedSurveys = await Survey.findTrashed(req.user.id);
        res.render('recycle-bin', {
            title: 'Recycle Bin',
            trashedSurveys,
        });
    } catch (err) {
        console.error('Recycle bin error:', err.message);
        req.flash('error_msg', 'Error loading recycle bin');
        res.redirect('/dashboard');
    }
});

module.exports = router;

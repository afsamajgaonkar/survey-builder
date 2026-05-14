const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Survey = require('../models/Survey');
const Response = require('../models/Response');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { ensureAuthenticated } = require('../middleware/auth');
const { ensureAdmin } = require('../middleware/admin');

// ========== ADMIN DASHBOARD ==========

// Admin Dashboard Overview
router.get('/', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const allSurveys = await Survey.getAll();
        const allUsers = await User.getAll();
        const totalSurveys = await Survey.getCount();
        const totalResponses = await Response.getTotalCount();
        const totalUsers = await User.getCount();
        const adminCount = allUsers.filter(u => u.role === 'admin').length;
        const recentActivities = await Activity.getRecent(50);

        res.render('admin', {
            title: 'Admin Dashboard',
            allSurveys,
            allUsers,
            totalSurveys,
            totalResponses,
            totalUsers,
            adminCount,
            recentActivities,
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error loading admin dashboard');
        res.redirect('/dashboard');
    }
});

// ========== USER CRUD ==========

// View single user details and their surveys
router.get('/users/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const targetUser = await User.findById(userId);
        
        if (!targetUser) {
            req.flash('error_msg', 'User not found');
            return res.redirect('/admin');
        }

        const userSurveys = await Survey.findByUserId(userId);
        const trashedSurveys = await Survey.findTrashed(userId);
        const userActivities = await Activity.getByUser(userId);

        res.render('admin-user', {
            title: `User: ${targetUser.username}`,
            targetUser,
            userSurveys,
            trashedSurveys,
            userActivities
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error loading user details');
        res.redirect('/admin');
    }
});

// Update user role (toggle admin/user)
router.post('/users/:id/role', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        // Prevent admin from demoting themselves
        if (userId === req.user.id) {
            req.flash('error_msg', 'You cannot change your own role');
            return res.redirect('/admin');
        }

        const { role } = req.body;
        if (!['user', 'admin'].includes(role)) {
            req.flash('error_msg', 'Invalid role specified');
            return res.redirect('/admin');
        }

        await User.updateRole(userId, role);
        req.flash('success_msg', `User role updated to "${role}" successfully`);
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error updating user role');
        res.redirect('/admin');
    }
});

// Update user details (username, email, role)
router.post('/users/:id/edit', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { username, email, role } = req.body;

        if (!username || !email || !role) {
            req.flash('error_msg', 'All fields are required');
            return res.redirect('/admin');
        }

        if (!['user', 'admin'].includes(role)) {
            req.flash('error_msg', 'Invalid role specified');
            return res.redirect('/admin');
        }

        // Prevent admin from changing their own role
        if (userId === req.user.id && role !== req.user.role) {
            req.flash('error_msg', 'You cannot change your own role');
            return res.redirect('/admin');
        }

        await User.updateUser(userId, username, email, role);
        req.flash('success_msg', `User "${username}" updated successfully`);
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error updating user');
        res.redirect('/admin');
    }
});

// Reset user password (admin sets new password)
router.post('/users/:id/reset-password', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            req.flash('error_msg', 'Password must be at least 6 characters');
            return res.redirect('/admin');
        }

        const pool = require('../config/db');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);

        req.flash('success_msg', 'User password has been reset successfully');
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error resetting password');
        res.redirect('/admin');
    }
});

// Delete user
router.post('/users/:id/delete', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // Prevent admin from deleting themselves
        if (userId === req.user.id) {
            req.flash('error_msg', 'You cannot delete your own account');
            return res.redirect('/admin');
        }

        const user = await User.findById(userId);
        if (!user) {
            req.flash('error_msg', 'User not found');
            return res.redirect('/admin');
        }

        await User.deleteById(userId);
        req.flash('success_msg', `User "${user.username}" and all their data deleted successfully`);
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error deleting user: ' + err.message);
        res.redirect('/admin');
    }
});

// Create new user (admin-created)
router.post('/users/create', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const { username, email, password, role } = req.body;

        if (!username || !email || !password) {
            req.flash('error_msg', 'All fields are required');
            return res.redirect('/admin');
        }

        if (password.length < 6) {
            req.flash('error_msg', 'Password must be at least 6 characters');
            return res.redirect('/admin');
        }

        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            req.flash('error_msg', 'A user with that email already exists');
            return res.redirect('/admin');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        await User.create(username, email, hashedPassword, role || 'user');

        req.flash('success_msg', `User "${username}" created successfully`);
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error creating user');
        res.redirect('/admin');
    }
});

// ========== SURVEY CRUD ==========

// Toggle survey active/inactive
router.post('/surveys/:id/toggle', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const survey = await Survey.findById(req.params.id);
        if (!survey) {
            req.flash('error_msg', 'Survey not found');
            return res.redirect('/admin');
        }

        await Survey.update(survey.id, survey.title, survey.description, !survey.is_active, survey.expiry_date);
        req.flash('success_msg', `Survey "${survey.title}" ${survey.is_active ? 'deactivated' : 'activated'} successfully`);
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error toggling survey status');
        res.redirect('/admin');
    }
});

// Delete a survey (permanent)
router.post('/surveys/:id/delete', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const survey = await Survey.findById(req.params.id);
        if (!survey) {
            req.flash('error_msg', 'Survey not found');
            return res.redirect('/admin');
        }
        
        await Survey.delete(req.params.id);
        req.flash('success_msg', `Survey "${survey.title}" deleted permanently by Admin`);
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error deleting survey');
        res.redirect('/admin');
    }
});
// Delete an activity
router.post('/activity/:id/delete', ensureAuthenticated, ensureAdmin, async (req, res) => {
    try {
        const activityId = req.params.id;
        await Activity.delete(activityId);
        req.flash('success_msg', 'Activity deleted successfully');
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        require('fs').writeFileSync('d:\\project S\\surveybuilder\\surveybuilder\\error_log.txt', err.stack || err.message);
        req.flash('error_msg', 'Error deleting activity');
        res.redirect('/admin');
    }
});

module.exports = router;

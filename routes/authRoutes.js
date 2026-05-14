const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { forwardAuthenticated } = require('../middleware/auth');
const { sendVerificationEmail } = require('../config/mailer');

// Register Page
router.get('/register', forwardAuthenticated, (req, res) => {
    res.render('register', { title: 'Register' });
});

// Register Handle
router.post('/register', async (req, res) => {
    const { firstName, lastName, email, password, password2 } = req.body;
    let errors = [];

    // Validation
    if (!firstName || !lastName || !email || !password || !password2) {
        errors.push({ msg: 'Please fill in all fields' });
    }

    // Last Name alphabetic validation
    const nameRegex = /^[A-Za-z\s]+$/;
    if (lastName && !nameRegex.test(lastName)) {
        errors.push({ msg: 'Last name must contain only letters' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
        errors.push({ msg: 'Please enter the correct credential' });
    }

    if (password !== password2) {
        errors.push({ msg: 'Passwords do not match' });
    }

    // Password: min 8 chars, at least one letter and one number (special chars allowed)
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*[0-9]).{8,}$/;
    if (password && !passwordRegex.test(password)) {
        errors.push({ msg: 'Password must be at least 8 characters and contain both letters and numbers' });
    }

    if (errors.length > 0) {
        return res.render('register', { title: 'Register', errors, firstName, lastName, email });
    }

    try {
        const existingEmail = await User.findByEmail(email);
        if (existingEmail) {
            errors.push({ msg: 'Email is already registered' });
            return res.render('register', { title: 'Register', errors, firstName, lastName, email });
        }

        // Combine firstName + lastName into a unique username
        let baseUsername = `${firstName.toLowerCase().replace(/\s/g, '')}${lastName.toLowerCase().replace(/\s/g, '')}`;
        let username = baseUsername;
        let counter = 1;
        while (await User.findByUsername(username)) {
            username = `${baseUsername}${counter++}`;
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Generate a unique verification token
        const verificationToken = uuidv4();

        const newUser = await User.create(username, email, hashedPassword, 'user', verificationToken);
        await Activity.log(newUser.id, 'Registered new account (pending email verification)');

        // Send verification email — catch separately so a bad email config shows a helpful error
        try {
            await sendVerificationEmail(email, verificationToken);
        } catch (emailErr) {
            console.error('❌ Email send failed:', emailErr.message);
            // Delete the user so they can re-register once email is configured
            await User.deleteById(newUser.id);
            return res.render('register', {
                title: 'Register',
                errors: [{
                    msg: '⚠️ Could not send verification email. Please contact the administrator to configure the email settings.'
                }],
                firstName, lastName, email
            });
        }

        // Redirect to a 'check your inbox' page
        res.render('email-sent', {
            title: 'Verify Your Email',
            email
        });
    } catch (err) {
        console.error(err);
        res.render('register', { title: 'Register', errors: [{ msg: 'Server error. Please try again.' }], firstName, lastName, email });
    }
});

// ── Email Verification ─────────────────────────────────────────────────────────
router.get('/verify-email', async (req, res) => {
    const { token } = req.query;

    if (!token) {
        req.flash('error_msg', 'Invalid verification link.');
        return res.redirect('/auth/login');
    }

    try {
        const user = await User.findByVerificationToken(token);

        if (!user) {
            return res.render('verify-email', {
                title: 'Email Verification',
                status: 'invalid'
            });
        }

        // Mark the user as verified
        await User.verifyEmail(user.id);
        await Activity.log(user.id, 'Email verified — account activated');

        // Auto-login the user after verification
        req.logIn(user, (err) => {
            if (err) {
                req.flash('success_msg', 'Email verified! Please log in.');
                return res.redirect('/auth/login');
            }
            return res.render('verify-email', {
                title: 'Email Verified',
                status: 'success',
                user
            });
        });
    } catch (err) {
        console.error(err);
        res.render('verify-email', {
            title: 'Email Verification',
            status: 'error'
        });
    }
});

// Login Page
router.get('/login', forwardAuthenticated, (req, res) => {
    res.render('login', { title: 'Login' });
});

// Login Handle
router.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            req.flash('error_msg', info ? info.message : 'Login failed');
            return res.redirect('/auth/login');
        }


        req.logIn(user, async (loginErr) => {
            if (loginErr) return next(loginErr);

            await Activity.log(user.id, 'Logged in');

            if (user.role === 'admin') {
                return res.redirect('/admin');
            }
            return res.redirect('/dashboard');
        });
    })(req, res, next);
});

// Forgot Password Page
router.get('/forgot-password', forwardAuthenticated, (req, res) => {
    res.render('forgot-password', { title: 'Forgot Password' });
});

// Forgot Password Handle
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    let errors = [];

    if (!email) {
        errors.push({ msg: 'Please enter your email' });
        return res.render('forgot-password', { title: 'Forgot Password', errors });
    }

    try {
        const user = await User.findByEmail(email);
        if (!user) {
            errors.push({ msg: 'No account with that email found' });
            return res.render('forgot-password', { title: 'Forgot Password', errors });
        }

        // Render reset password page
        res.render('reset-password', { title: 'Reset Password', email: user.email });
    } catch (err) {
        console.error(err);
        res.render('forgot-password', { title: 'Forgot Password', errors: [{ msg: 'Server error. Please try again.' }] });
    }
});

// Reset Password Handle
router.post('/reset-password', async (req, res) => {
    const { email, password, password2 } = req.body;
    let errors = [];

    if (!password || !password2) {
        errors.push({ msg: 'Please enter a new password' });
    }
    if (password !== password2) {
        errors.push({ msg: 'Passwords do not match' });
    }
    if (password && password.length < 6) {
        errors.push({ msg: 'Password must be at least 6 characters' });
    }

    if (errors.length > 0) {
        return res.render('reset-password', { title: 'Reset Password', errors, email });
    }

    try {
        const user = await User.findByEmail(email);
        if (!user) {
            req.flash('error_msg', 'Invalid request');
            return res.redirect('/auth/forgot-password');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await User.updatePassword(user.id, hashedPassword);

        await Activity.log(user.id, 'Password reset successfully');

        req.flash('success_msg', 'Password has been reset! You can now log in.');
        res.redirect('/auth/login');
    } catch (err) {
        console.error(err);
        res.render('reset-password', { title: 'Reset Password', errors: [{ msg: 'Server error. Please try again.' }], email });
    }
});

// Logout
router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.flash('success_msg', 'You have logged out successfully');
        res.redirect('/auth/login');
    });
});

module.exports = router;

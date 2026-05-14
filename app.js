const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const passport = require('passport');
const flash = require('express-flash');
const methodOverride = require('method-override');
const path = require('path');
require('dotenv').config();

const pool = require('./config/db');

// Initialize Passport config
const initializePassport = require('./config/passport');
initializePassport(passport);

const app = express();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Method override for PUT/DELETE
app.use(methodOverride('_method'));

// Session - PostgreSQL store
app.use(
    session({
        store: new pgSession({
            pool: pool,
            tableName: 'session',
            createTableIfMissing: true,
        }),
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 1 day
    })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// Global variables for templates
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.user || null;
    next();
});

// ========== ROUTES ==========

// Remove splash screen, redirect directly to home
app.get('/', (req, res) => {
    res.redirect('/home');
});

// Home page
app.get('/home', (req, res) => {
    res.render('home', { title: 'Survey Builder' });
});

// Auth routes
app.use('/auth', require('./routes/authRoutes'));

// Survey routes
app.use('/surveys', require('./routes/surveyRoutes'));

// Response routes (public + authenticated)
app.use('/', require('./routes/responseRoutes'));

// Export routes
app.use('/survey', require('./routes/exportRoutes'));

// Analytics routes
app.use('/analytics', require('./routes/analyticsRoutes'));

// Dashboard routes
app.use('/', require('./routes/dashboardRoutes'));

// Admin routes
app.use('/admin', require('./routes/adminRoutes'));

// ── New Modules ────────────────────────────────────────────────────────────
// Module 3: Survey Templates
app.use('/templates', require('./routes/templateRoutes'));

// Module 1: Email Invitations & Tracking
app.use('/', require('./routes/invitationRoutes'));

// Module 4: Embeddable Surveys
app.use('/embed', require('./routes/embedRoutes'));
// ──────────────────────────────────────────────────────────────────────────

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', { title: 'Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('==== SERVER ERROR ====');
    console.error('URL:', req.originalUrl);
    console.error('Error:', err.message);
    console.error(err.stack);
    
    if (res.headersSent) {
        return next(err);
    }
    
    res.status(500).render('404', {
        title: 'Server Error',
        user: req.user || null,
        success_msg: '',
        error_msg: err.message || 'An internal server error occurred.',
        error: ''
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Survey Builder running on http://localhost:${PORT}`);
});

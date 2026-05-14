// Middleware to check if user is authenticated
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        if (req.user.is_banned) {
            req.logout((err) => {
                if (err) console.error('[Auth Middleware] Logout error:', err);
            });
            req.flash('error_msg', 'Your account has been banned. Please contact support.');
            return res.redirect('/auth/login');
        }
        return next();
    }
    req.flash('error_msg', 'Please log in to access this page');
    res.redirect('/auth/login');
}

// Middleware to check if user is NOT authenticated (for login/register pages)
function forwardAuthenticated(req, res, next) {
    if (!req.isAuthenticated()) {
        return next();
    }
    res.redirect('/dashboard');
}

// Middleware to check if user is admin
function ensureAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.role === 'admin') {
        return next();
    }
    req.flash('error_msg', 'You do not have permission to access this page');
    res.redirect('/dashboard');
}

module.exports = { ensureAuthenticated, forwardAuthenticated, ensureAdmin };

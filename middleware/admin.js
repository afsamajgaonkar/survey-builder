/**
 * middleware/admin.js
 * Restricts route access to authenticated admin users only.
 * Prevents banned users from accessing any route (double-checked here too).
 */

function ensureAdmin(req, res, next) {
    if (!req.isAuthenticated()) {
        req.flash('error_msg', 'Please log in to access this page');
        return res.redirect('/auth/login');
    }

    if (req.user.is_banned) {
        req.logout((err) => {
            if (err) console.error('[Admin Middleware] Logout error:', err);
        });
        req.flash('error_msg', 'Your account has been banned. Please contact support.');
        return res.redirect('/auth/login');
    }

    if (req.user.role !== 'admin') {
        return res.status(403).send('403 Forbidden: Not authorized as admin');
    }

    return next();
}

module.exports = { ensureAdmin };

const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/User');

function initialize(passport) {
    const authenticateUser = async (req, email, password, done) => {
        try {
            const user = await User.findByEmail(email);
            if (!user) {
                return done(null, false, { message: 'No account found with that email' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return done(null, false, { message: 'Incorrect password' });
            }

            if (!user.email_verified) {
                return done(null, false, { message: 'Please verify your email before logging in. Check your inbox for the verification link.' });
            }

            if (user.is_banned) {
                return done(null, false, { message: 'Your account has been banned. Please contact support.' });
            }
            if (req.body.isAdminLogin === 'true' && user.role !== 'admin') {
                return done(null, false, { message: 'Not authorized as admin' });
            }

            return done(null, user);
        } catch (err) {
            return done(err);
        }
    };

    passport.use(
        new LocalStrategy({ usernameField: 'email', passReqToCallback: true }, authenticateUser)
    );

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    });
}

module.exports = initialize;

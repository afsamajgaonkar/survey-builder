const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const Survey = require('../models/Survey');
const Invitation = require('../models/Invitation');
const Activity = require('../models/Activity');
const { ensureAuthenticated } = require('../middleware/auth');

// Reuse the mailer transporter
const transporter = (process.env.EMAIL_USER && process.env.EMAIL_PASS &&
    process.env.EMAIL_USER !== 'your_gmail@gmail.com')
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    }) : null;

// GET invitation list for a survey
router.get('/surveys/:id/invitations', ensureAuthenticated, async (req, res) => {
    try {
        const survey = await Survey.findById(req.params.id);
        if (!survey || survey.user_id !== req.user.id) {
            req.flash('error_msg', 'Not authorized');
            return res.redirect('/dashboard');
        }
        const invitations = await Invitation.findBySurvey(req.params.id);
        res.render('survey-invite', { title: 'Email Invitations', survey, invitations });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error loading invitations');
        res.redirect('/dashboard');
    }
});

// POST send invitations
router.post('/surveys/:id/invitations', ensureAuthenticated, async (req, res) => {
    try {
        const survey = await Survey.findById(req.params.id);
        if (!survey || survey.user_id !== req.user.id) {
            req.flash('error_msg', 'Not authorized');
            return res.redirect('/dashboard');
        }

        const emailsRaw = req.body.emails || '';
        const emails = emailsRaw.split(/[\s,;]+/).map(e => e.trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

        if (emails.length === 0) {
            req.flash('error_msg', 'Please enter at least one valid email address');
            return res.redirect(`/surveys/${req.params.id}/invitations`);
        }

        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        let sent = 0, skipped = 0;

        for (const email of emails) {
            // Skip if already invited
            const existing = await Invitation.findByEmail(req.params.id, email);
            if (existing) { skipped++; continue; }

            const token = uuidv4();
            await Invitation.create(req.params.id, email, token);

            const trackUrl = `${baseUrl}/invitations/track/${token}`;
            const surveyUrl = `${baseUrl}/s/${survey.share_link}`;

            if (transporter) {
                try {
                    await transporter.sendMail({
                        from: `"SurveyBuilder" <${process.env.EMAIL_USER}>`,
                        to: email,
                        subject: `You're invited: ${survey.title}`,
                        html: `
                        <!DOCTYPE html><html><body style="margin:0;padding:0;background:#0f0c29;font-family:'Segoe UI',Arial,sans-serif;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0c29;padding:40px 0;">
                          <tr><td align="center">
                            <table width="560" cellpadding="0" cellspacing="0"
                                   style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;border:1px solid rgba(255,255,255,0.1);">
                              <tr><td style="background:linear-gradient(135deg,#667eea,#764ba2);padding:28px;text-align:center;">
                                <h1 style="margin:0;color:#fff;font-size:22px;">📋 Survey Invitation</h1>
                              </td></tr>
                              <tr><td style="padding:36px;">
                                <p style="color:#c5c5e8;font-size:15px;margin:0 0 16px;">You've been invited to fill out a survey:</p>
                                <h2 style="color:#fff;margin:0 0 20px;font-size:20px;">${survey.title}</h2>
                                ${survey.description ? `<p style="color:#a0a0c0;font-size:14px;margin:0 0 24px;">${survey.description}</p>` : ''}
                                <table cellpadding="0" cellspacing="0" width="100%"><tr>
                                  <td align="center" style="padding:0 0 24px;">
                                    <a href="${trackUrl}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;font-size:16px;font-weight:600;text-decoration:none;border-radius:10px;">
                                      ✍️ Take the Survey
                                    </a>
                                  </td>
                                </tr></table>
                                <p style="color:#8888aa;font-size:13px;margin:0;">Or visit: <a href="${surveyUrl}" style="color:#667eea;">${surveyUrl}</a></p>
                              </td></tr>
                              <tr><td style="padding:16px 36px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
                                <p style="color:#555577;font-size:12px;margin:0;">© 2026 SurveyBuilder. You received this because someone invited you to participate.</p>
                              </td></tr>
                            </table>
                          </td></tr>
                        </table></body></html>`
                    });
                    sent++;
                } catch (e) {
                    console.error('Email send error:', e.message);
                }
            } else {
                console.log(`[DEV] Invitation for ${email}: ${trackUrl}`);
                sent++;
            }
        }

        await Activity.log(req.user.id, `Sent ${sent} survey invitations`);
        req.flash('success_msg', `Sent ${sent} invitation(s)${skipped > 0 ? `, ${skipped} already invited` : ''}`);
        res.redirect(`/surveys/${req.params.id}/invitations`);
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error sending invitations');
        res.redirect('/dashboard');
    }
});

// Track email open (redirect to survey)
router.get('/invitations/track/:token', async (req, res) => {
    try {
        const inv = await Invitation.findByToken(req.params.token);
        if (inv) {
            await Invitation.markOpened(req.params.token);
            const survey = await Survey.findById(inv.survey_id);
            if (survey) return res.redirect(`/s/${survey.share_link}`);
        }
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.redirect('/');
    }
});

module.exports = router;

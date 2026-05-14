require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

console.log('Testing with:', process.env.EMAIL_USER);

transporter.sendMail({
    from: `"SurveyBuilder" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: 'SurveyBuilder — Email Test ✅',
    html: '<h2>Email is working!</h2><p>Your SurveyBuilder email setup is configured correctly.</p>'
}).then(info => {
    console.log('✅ SUCCESS! Email sent. Message ID:', info.messageId);
    console.log('Check your inbox at:', process.env.EMAIL_USER);
}).catch(err => {
    console.error('❌ FAILED:', err.message);
    console.error('Code:', err.code);
});

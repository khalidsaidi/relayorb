const sgMail = require('@sendgrid/mail');
const apiKey = process.env.SENDGRID_API_KEY;

if (!apiKey) {
  console.log("SENDGRID_API_KEY not set");
  process.exit(1);
}

sgMail.setApiKey(apiKey);

const msg = {
  to: 'khalidsaidi66@gmail.com',
  from: 'alerts@relayorb.app',
  subject: 'Test Alert - Pipeline Alerts Working',
  text: 'This is a test to verify SendGrid is working.',
  html: '<strong>This is a test to verify SendGrid is working.</strong>',
};

sgMail.send(msg)
  .then(() => {
    console.log('Email sent successfully!');
  })
  .catch((error) => {
    console.error('SendGrid Error:', error.message);
    if (error.response) {
      console.error('Response body:', JSON.stringify(error.response.body, null, 2));
    }
  });

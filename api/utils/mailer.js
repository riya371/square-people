const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const EMAILS_DIR = path.join(__dirname, '..', 'emails');

const SUBJECTS = {
  invite: 'You\'re invited to join {{companyName}} on SquarePeople',
  'password-reset': 'Reset your SquarePeople password',
  'leave-submitted': 'New leave request from {{employeeName}}',
  'leave-decision': 'Your leave request was {{decision}}',
};

function render(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (data[k] ?? ''));
}

function loadTemplate(name) {
  const html = fs.readFileSync(path.join(EMAILS_DIR, `${name}.html`), 'utf8');
  const text = fs.readFileSync(path.join(EMAILS_DIR, `${name}.txt`), 'utf8');
  return { html, text };
}

class ConsoleMailer {
  async send({ to, template, data }) {
    const subject = render(SUBJECTS[template] || `[${template}]`, data);
    const { text } = loadTemplate(template);
    const body = render(text, data);
    // eslint-disable-next-line no-console
    console.log('\n=== [ConsoleMailer] ===');
    console.log(`To:      ${to}`);
    console.log(`From:    ${env.RESEND_FROM || 'SquarePeople <no-reply@example.test>'}`);
    console.log(`Subject: ${subject}`);
    console.log('---');
    console.log(body);
    console.log('=== end ===\n');
    return { delivered: 'console', to, subject };
  }
}

class ResendMailer {
  constructor(apiKey, from) {
    const { Resend } = require('resend');
    this.client = new Resend(apiKey);
    this.from = from;
  }
  async send({ to, template, data }) {
    const subject = render(SUBJECTS[template] || `[${template}]`, data);
    const { html, text } = loadTemplate(template);
    const result = await this.client.emails.send({
      from: this.from,
      to,
      subject,
      html: render(html, data),
      text: render(text, data),
    });
    return { delivered: 'resend', to, subject, id: result.id };
  }
}

function makeMailer() {
  if (env.MAIL_DRIVER === 'resend' && env.RESEND_API_KEY && env.RESEND_FROM) {
    return new ResendMailer(env.RESEND_API_KEY, env.RESEND_FROM);
  }
  return new ConsoleMailer();
}

module.exports = { mailer: makeMailer(), ConsoleMailer, ResendMailer };

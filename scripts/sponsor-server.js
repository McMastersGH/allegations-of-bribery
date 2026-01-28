#!/usr/bin/env node
// scripts/sponsor-server.js
// Simple Express endpoint to receive sponsor inquiries and forward via SMTP.
// Configure the following environment variables before running:
// SPONSOR_SMTP_HOST, SPONSOR_SMTP_PORT, SPONSOR_SMTP_USER, SPONSOR_SMTP_PASS, SPONSOR_TO_EMAIL
// Example run: SPONSOR_SMTP_HOST=smtp.example.com SPONSOR_SMTP_PORT=587 SPONSOR_SMTP_USER=user SPONSOR_SMTP_PASS=pass SPONSOR_TO_EMAIL=you@example.com node scripts/sponsor-server.js

import express from 'express';
import nodemailer from 'nodemailer';
import process from 'process';
import Resend from 'resend';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

function createTransporter() {
  const host = process.env.SPONSOR_SMTP_HOST;
  const port = parseInt(process.env.SPONSOR_SMTP_PORT || '587', 10);
  const user = process.env.SPONSOR_SMTP_USER;
  const pass = process.env.SPONSOR_SMTP_PASS;
  if (!host || !user || !pass || !process.env.SPONSOR_TO_EMAIL) {
    console.error('Missing SMTP configuration. Set SPONSOR_SMTP_HOST, SPONSOR_SMTP_USER, SPONSOR_SMTP_PASS, SPONSOR_TO_EMAIL');
    return null;
  }
  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

app.post('/sponsor', async (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ error: 'Missing fields' });

  const to = process.env.SPONSOR_TO_EMAIL;
  if (!to) return res.status(500).json({ error: 'SPONSOR_TO_EMAIL not set' });

  const fromAddress = process.env.SPONSOR_FROM_EMAIL || process.env.SPONSOR_SMTP_USER || `no-reply@${req.hostname}`;

  // Prefer Resend API when configured
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const html = `
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${(message || '').replace(/\n/g, '<br/>')}</p>
      `;

      await resend.emails.send({
        from: fromAddress,
        to,
        subject: `Sponsorship inquiry from ${name}`,
        html,
        reply_to: email
      });

      return res.json({ ok: true, via: 'resend' });
    } catch (err) {
      console.error('Resend error', err);
      return res.status(500).json({ error: 'Failed to send via Resend' });
    }
  }

  // Fallback to SMTP via nodemailer
  const transporter = createTransporter();
  if (!transporter) return res.status(500).json({ error: 'SMTP not configured' });

  const mail = {
    from: `${fromAddress}`,
    to,
    subject: `Sponsorship inquiry from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    replyTo: email
  };

  try {
    await transporter.sendMail(mail);
    res.json({ ok: true, via: 'smtp' });
  } catch (err) {
    console.error('sendMail error', err);
    res.status(500).json({ error: 'Failed to send' });
  }
});

app.listen(PORT, () => console.log(`Sponsor server listening on http://localhost:${PORT}`));

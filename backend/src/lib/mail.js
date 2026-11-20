import nodemailer from 'nodemailer';
import { config } from '../config.js';

const { host, port, user, pass, from } = config.smtp;
const transport = host && user && pass
  ? nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass }, connectionTimeout: 15000, greetingTimeout: 15000 })
  : null;

if (!transport) console.warn('[mail] SMTP not configured: emails will be printed to the server log instead.');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function sendMail(to, subject, text, action) {
  const url = action?.url;
  if (!transport) {
    console.log(`\n[mail:fallback] To: ${to}\n[mail:fallback] Subject: ${subject}\n[mail:fallback] ${text.replace(/\n/g, '\n[mail:fallback] ')}\n${url ? `[mail:fallback] LINK: ${url}\n` : ''}`);
    return;
  }
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1b2624">
    <h2 style="color:#12332f">Exquis Upskill</h2>
    ${text.split('\n').map((l) => `<p style="line-height:1.5">${esc(l)}</p>`).join('')}
    ${url ? `<p><a href="${esc(url)}" style="background:#1d7a6f;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">${esc(action.label || 'Open')}</a></p><p style="font-size:12px;color:#667">Or paste this link: ${esc(url)}</p>` : ''}
  </div>`;
  try {
    await transport.sendMail({ from: from || user, to, subject, text: url ? `${text}\n\n${url}` : text, html });
  } catch (e) {
    console.error(`[mail] failed to send to ${to}: ${e.message}`);
    if (url) console.log(`[mail:fallback] LINK for ${to}: ${url}`);
  }
}

/**
 * Contact form (P4-02): validation, delivery to the shop inbox through the email adapter, email_log.
 * Turnstile + rate limiting are applied by the route action before `sendContactMessage()`.
 */
import { z } from 'zod';
import type { Executor } from '../db/index.ts';
import { emailLog } from '../db/schema.ts';
import type { EmailAdapter } from '../adapters/email.ts';
import type { Lang } from '../../i18n/paths.ts';
import { m } from '../../paraglide/messages.js';

export const CONTACT_LIMIT = { max: 5, windowSec: 3600 } as const;

export function contactSchema(lang: Lang) {
	const o = { locale: lang };
	return z.object({
		name: z.string().trim().min(1, m.contact_err_name({}, o)).max(120, m.contact_err_name({}, o)),
		email: z
			.string()
			.trim()
			.toLowerCase()
			.pipe(z.email(m.contact_err_email({}, o)))
			.pipe(z.string().max(254, m.contact_err_email({}, o))),
		orderNumber: z
			.string()
			.trim()
			.toUpperCase()
			.max(20, m.contact_err_order({}, o))
			.refine((v) => !v || /^[A-Z0-9-]{3,20}$/.test(v), m.contact_err_order({}, o))
			.default(''),
		message: z.string().trim().min(10, m.contact_err_message({}, o)).max(3000, m.contact_err_message({}, o))
	});
}
export type ContactInput = z.infer<ReturnType<typeof contactSchema>>;

export const escapeHtml = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Internal (Dutch) notification to the shop inbox. The customer's address is the reply-to. */
export function contactEmail(input: ContactInput, lang: Lang) {
	const rows: [string, string][] = [
		['Naam', input.name],
		['E-mail', input.email],
		['Bestelnummer', input.orderNumber || '—'],
		['Taal', lang.toUpperCase()]
	];
	const subject = `Contactformulier: ${input.name}${input.orderNumber ? ` (${input.orderNumber})` : ''}`;
	const html = `<!doctype html><html lang="nl"><body style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">
<h2 style="font-family:Georgia,serif;font-weight:400">Nieuw bericht via het contactformulier</h2>
<table cellpadding="4">${rows.map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${escapeHtml(v)}</td></tr>`).join('')}</table>
<p style="white-space:pre-wrap;border-left:3px solid #ccc;padding-left:12px">${escapeHtml(input.message)}</p>
<p style="color:#777">Antwoord rechtstreeks op deze e-mail om de klant te antwoorden.</p></body></html>`;
	const text = `${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${input.message}\n`;
	return { subject, html, text };
}

export async function sendContactMessage(
	db: Executor,
	email: EmailAdapter,
	inbox: string,
	input: ContactInput,
	lang: Lang
) {
	const mail = contactEmail(input, lang);
	try {
		const { id } = await email.send({
			to: inbox,
			subject: mail.subject,
			html: mail.html,
			text: mail.text,
			template: 'contact',
			replyTo: input.email
		});
		await db
			.insert(emailLog)
			.values({ to: inbox, template: 'contact', locale: lang, subject: mail.subject, providerId: id, status: 'sent' });
		return true;
	} catch (e) {
		await db.insert(emailLog).values({
			to: inbox,
			template: 'contact',
			locale: lang,
			subject: mail.subject,
			status: 'failed',
			error: String(e).slice(0, 500)
		});
		return false;
	}
}

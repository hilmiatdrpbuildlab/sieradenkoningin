/**
 * Newsletter double opt-in (P4-06).
 *   subscribe → row `pending` + random token (only its SHA-256 is stored) → confirmation email
 *   confirm   → `confirmed` → sync to the newsletter adapter (Brevo / mock)
 *   unsubscribe → `unsubscribed` → adapter.unsubscribe
 * Invariant (unit-tested): only CONFIRMED subscribers are ever synced to the newsletter provider.
 */
import { eq } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { emailLog, newsletterSubscribers } from '../db/schema.ts';
import type { EmailAdapter } from '../adapters/email.ts';
import type { NewsletterAdapter } from '../adapters/newsletter.ts';
import { randomToken, sha256Hex } from '../crypto.ts';
import { localizeHref, type Lang } from '../../i18n/paths.ts';
import { m } from '../../paraglide/messages.js';
import { escapeHtml } from './contact.ts';

/** A pending confirmation link stays valid this long. */
export const PENDING_TTL_MS = 7 * 86400_000;
const SOURCE_RE = /^[a-z0-9_-]{1,30}$/;

export type SubscriberStatus = 'pending' | 'confirmed' | 'unsubscribed';
export const shouldSync = (status: SubscriberStatus | string | null | undefined) => status === 'confirmed';

export function confirmUrl(siteUrl: string, lang: Lang, token: string) {
	return `${siteUrl.replace(/\/$/, '')}${localizeHref('/newsletter/confirm', lang)}?token=${encodeURIComponent(token)}`;
}

export function confirmationEmail(url: string, lang: Lang) {
	const o = { locale: lang };
	const subject = m.nlmail_subject({}, o);
	const html = `<!doctype html><html lang="${lang === 'fr' ? 'fr-BE' : 'nl-BE'}"><body style="margin:0;background:#EBE1D8;font-family:Arial,Helvetica,sans-serif;color:#492520">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff" cellpadding="0" cellspacing="0">
<tr><td style="background:#391617;color:#EBE1D8;text-align:center;padding:24px;font-family:Georgia,serif;letter-spacing:4px;font-size:18px">SIERADENKONINGIN</td></tr>
<tr><td style="padding:32px 32px 8px;font-family:Georgia,serif;font-size:26px;color:#391617">${escapeHtml(m.nlmail_heading({}, o))}</td></tr>
<tr><td style="padding:8px 32px 24px;font-size:15px;line-height:1.6">${escapeHtml(m.nlmail_text({}, o))}</td></tr>
<tr><td style="padding:0 32px 32px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#391617;color:#EBE1D8;text-decoration:none;padding:14px 28px;font-size:12px;letter-spacing:2px;text-transform:uppercase">${escapeHtml(m.nlmail_button({}, o))}</a></td></tr>
<tr><td style="padding:0 32px 32px;font-size:12px;color:#875543;line-height:1.5">${escapeHtml(m.nlmail_ignore({}, o))}</td></tr>
</table></td></tr></table></body></html>`;
	const text = `${m.nlmail_heading({}, o)}\n\n${m.nlmail_text({}, o)}\n\n${url}\n\n${m.nlmail_ignore({}, o)}\n`;
	return { subject, html, text };
}

export interface SubscribeDeps {
	email: EmailAdapter;
	siteUrl: string;
}

/**
 * Starts (or restarts) the double opt-in. Already-confirmed addresses get no new email and the caller
 * shows the same neutral response (no account enumeration).
 */
export async function subscribe(
	db: Executor,
	deps: SubscribeDeps,
	input: { email: string; lang: Lang; source?: string | null }
): Promise<'sent' | 'already' | 'failed'> {
	const email = input.email.trim().toLowerCase();
	const source = input.source && SOURCE_RE.test(input.source) ? input.source : null;
	const [existing] = await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email));
	if (existing?.status === 'confirmed') return 'already';
	const token = randomToken(24);
	const tokenHash = await sha256Hex(token);
	const now = new Date();
	await db
		.insert(newsletterSubscribers)
		.values({ email, locale: input.lang, status: 'pending', token: tokenHash, source, updatedAt: now })
		.onConflictDoUpdate({
			target: newsletterSubscribers.email,
			set: {
				locale: input.lang,
				status: 'pending',
				token: tokenHash,
				source: source ?? existing?.source ?? null,
				confirmedAt: null,
				updatedAt: now
			}
		});
	const mail = confirmationEmail(confirmUrl(deps.siteUrl, input.lang, token), input.lang);
	try {
		const { id } = await deps.email.send({
			to: email,
			subject: mail.subject,
			html: mail.html,
			text: mail.text,
			template: 'newsletter_confirm'
		});
		await db.insert(emailLog).values({
			to: email,
			template: 'newsletter_confirm',
			locale: input.lang,
			subject: mail.subject,
			providerId: id,
			status: 'sent'
		});
		return 'sent';
	} catch (e) {
		await db.insert(emailLog).values({
			to: email,
			template: 'newsletter_confirm',
			locale: input.lang,
			subject: mail.subject,
			status: 'failed',
			error: String(e).slice(0, 500)
		});
		return 'failed';
	}
}

async function byToken(db: Executor, token: string | null | undefined) {
	if (!token || token.length < 16 || token.length > 200) return null;
	const [row] = await db
		.select()
		.from(newsletterSubscribers)
		.where(eq(newsletterSubscribers.token, await sha256Hex(token)));
	return row ?? null;
}

/** Pushes the subscriber to the provider — ONLY when the stored status is `confirmed`. */
export async function syncSubscriber(db: Executor, adapter: NewsletterAdapter, email: string) {
	const [row] = await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email));
	if (!row || !shouldSync(row.status)) return false;
	await adapter.upsertContact(row.email, row.locale, row.source);
	await db
		.update(newsletterSubscribers)
		.set({ syncedAt: new Date() })
		.where(eq(newsletterSubscribers.email, row.email));
	return true;
}

export async function confirmSubscription(
	db: Executor,
	adapter: NewsletterAdapter,
	token: string | null | undefined,
	now = new Date()
) {
	const row = await byToken(db, token);
	if (!row || row.status === 'unsubscribed') return { ok: false as const };
	if (row.status === 'pending') {
		if (now.getTime() - row.updatedAt.getTime() > PENDING_TTL_MS) return { ok: false as const };
		await db
			.update(newsletterSubscribers)
			.set({ status: 'confirmed', confirmedAt: now, updatedAt: now })
			.where(eq(newsletterSubscribers.email, row.email));
	}
	try {
		await syncSubscriber(db, adapter, row.email);
	} catch (e) {
		// The subscription stands; syncedAt stays null so a retry job can pick it up.
		console.error('[newsletter] sync failed', e);
	}
	return { ok: true as const, email: row.email };
}

export async function unsubscribeByToken(db: Executor, adapter: NewsletterAdapter, token: string | null | undefined) {
	const row = await byToken(db, token);
	if (!row) return { ok: false as const };
	const wasSynced = row.status === 'confirmed' || !!row.syncedAt;
	await db
		.update(newsletterSubscribers)
		.set({ status: 'unsubscribed', updatedAt: new Date() })
		.where(eq(newsletterSubscribers.email, row.email));
	if (wasSynced) {
		try {
			await adapter.unsubscribe(row.email);
		} catch (e) {
			console.error('[newsletter] provider unsubscribe failed', e);
		}
	}
	return { ok: true as const };
}

export async function tokenIsKnown(db: Executor, token: string | null | undefined) {
	return !!(await byToken(db, token));
}

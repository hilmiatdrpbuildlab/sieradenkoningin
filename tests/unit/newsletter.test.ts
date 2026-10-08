/** P4-06 — double opt-in: unconfirmed emails never sync to the newsletter provider. */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { createDb } from '#lib/server/db/index.ts';
import { emailLog, newsletterSubscribers } from '#lib/server/db/schema.ts';
import {
	confirmSubscription,
	PENDING_TTL_MS,
	shouldSync,
	subscribe,
	syncSubscriber,
	unsubscribeByToken
} from '#lib/server/services/newsletter.ts';
import type { EmailAdapter, OutgoingEmail } from '#lib/server/adapters/email.ts';
import type { NewsletterAdapter } from '#lib/server/adapters/newsletter.ts';

const { db, close } = createDb(process.env.DATABASE_URL ?? 'postgres://sk@localhost:54329/sieradenkoningin', 2);
const stamp = Date.now();
const A = `nl-test-a-${stamp}@example.invalid`;
const B = `nl-test-b-${stamp}@example.invalid`;

let sent: OutgoingEmail[] = [];
const email: EmailAdapter = {
	provider: 'mock',
	send: async (e) => {
		sent.push(e);
		return { id: `test-${sent.length}` };
	}
};
const newsletter = () =>
	({
		provider: 'mock',
		upsertContact: vi.fn(async () => {}),
		unsubscribe: vi.fn(async () => {})
	}) satisfies NewsletterAdapter;
const tokenFrom = (e: OutgoingEmail) => decodeURIComponent(/token=([^"&\s]+)/.exec(e.text)![1]);
const row = async (addr: string) =>
	(await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, addr)))[0];

beforeEach(() => {
	sent = [];
});
afterAll(async () => {
	await db.delete(newsletterSubscribers).where(inArray(newsletterSubscribers.email, [A, B]));
	await db.delete(emailLog).where(inArray(emailLog.to, [A, B]));
	await close();
});

describe('double opt-in', () => {
	it('only confirmed status may sync', () => {
		expect(shouldSync('confirmed')).toBe(true);
		expect(shouldSync('pending')).toBe(false);
		expect(shouldSync('unsubscribed')).toBe(false);
	});

	it('subscribe stores a pending row, emails a confirmation link and does NOT sync', async () => {
		const nl = newsletter();
		expect(
			await subscribe(
				db,
				{ email, siteUrl: 'https://shop.example' },
				{ email: A.toUpperCase(), lang: 'fr', source: 'footer' }
			)
		).toBe('sent');
		const r = await row(A);
		expect(r.status).toBe('pending');
		expect(r.locale).toBe('fr');
		expect(r.source).toBe('footer');
		expect(sent).toHaveLength(1);
		expect(sent[0].text).toContain('https://shop.example/fr/newsletter/confirmer?token=');
		expect(r.token).not.toBe(tokenFrom(sent[0])); // only the hash is stored
		expect(await syncSubscriber(db, nl, A)).toBe(false);
		expect(nl.upsertContact).not.toHaveBeenCalled();
		const [log] = await db.select().from(emailLog).where(eq(emailLog.to, A));
		expect(log.template).toBe('newsletter_confirm');
	});

	it('a wrong or expired token never confirms or syncs', async () => {
		const nl = newsletter();
		await subscribe(db, { email, siteUrl: 'https://shop.example' }, { email: B, lang: 'nl' });
		expect((await confirmSubscription(db, nl, 'not-the-right-token-123456')).ok).toBe(false);
		const token = tokenFrom(sent[0]);
		expect((await confirmSubscription(db, nl, token, new Date(Date.now() + PENDING_TTL_MS + 60_000))).ok).toBe(false);
		expect((await row(B)).status).toBe('pending');
		expect(nl.upsertContact).not.toHaveBeenCalled();
	});

	it('confirming syncs exactly once with locale and source', async () => {
		const nl = newsletter();
		await subscribe(db, { email, siteUrl: 'https://shop.example' }, { email: A, lang: 'nl', source: 'home' });
		const res = await confirmSubscription(db, nl, tokenFrom(sent[0]));
		expect(res.ok).toBe(true);
		const r = await row(A);
		expect(r.status).toBe('confirmed');
		expect(r.confirmedAt).toBeTruthy();
		expect(r.syncedAt).toBeTruthy();
		expect(nl.upsertContact).toHaveBeenCalledTimes(1);
		expect(nl.upsertContact).toHaveBeenCalledWith(A, 'nl', 'home');
	});

	it('already-confirmed addresses get no new email', async () => {
		expect(await subscribe(db, { email, siteUrl: 'https://shop.example' }, { email: A, lang: 'nl' })).toBe('already');
		expect(sent).toHaveLength(0);
	});

	it('unsubscribed addresses are never synced again, even with the old link', async () => {
		const nl = newsletter();
		await subscribe(db, { email, siteUrl: 'https://shop.example' }, { email: B, lang: 'nl' });
		const token = tokenFrom(sent[0]);
		expect((await unsubscribeByToken(db, nl, token)).ok).toBe(true);
		expect((await row(B)).status).toBe('unsubscribed');
		expect((await confirmSubscription(db, nl, token)).ok).toBe(false);
		expect(await syncSubscriber(db, nl, B)).toBe(false);
		expect(nl.upsertContact).not.toHaveBeenCalled();
	});
});

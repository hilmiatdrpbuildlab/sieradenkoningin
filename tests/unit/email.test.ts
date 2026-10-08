/** P2-08 — transactional email templates (Svelte → HTML via svelte/server), NL + FR snapshots. */
import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { renderEmail, sendEmail, type OrderEmailData } from '#lib/server/services/email.ts';
import { emailLog } from '#lib/server/db/schema.ts';
import { memoryEmail, openTestDb } from './checkout-fixtures.ts';

const data: OrderEmailData = {
	number: 'SK-2026-000042',
	firstName: 'Ann',
	placedAt: '2026-10-08T10:00:00.000Z',
	lines: [
		{ name: 'DEMO Klaverring', variantLabel: 'Goud · maat 52', qty: 1, lineTotalFormatted: '€ 49,95' },
		{ name: 'DEMO Armband', variantLabel: 'Zilver', qty: 2, lineTotalFormatted: '€ 59,90' }
	],
	subtotalFormatted: '€ 109,85',
	discountFormatted: '€ 10,99',
	discountCode: 'DEMO10',
	shippingFormatted: null,
	totalFormatted: '€ 98,86',
	vatFormatted: '€ 17,16',
	shippingMethod: 'home',
	shippingAddress: { name: 'Ann DEMO', line1: 'Demostraat 1', postalCode: '1000', city: 'Brussel', country: 'BE' },
	servicePoint: null,
	giftWrap: true,
	giftMessage: 'Voor jou <3',
	deliveryEstimate: 'vrijdag 9 oktober',
	orderUrl: 'https://example.invalid/nl/bedankt/SK-2026-000042?t=token',
	shopUrl: 'https://example.invalid/nl',
	storeName: 'Sieradenkoningin',
	storeEmail: 'hallo@example.invalid',
	returnDays: 14
};

describe('email templates', () => {
	for (const locale of ['nl', 'fr'] as const) {
		for (const template of ['order_confirmation', 'payment_failed'] as const) {
			it(`${template} (${locale}) renders to a stable, self-contained HTML document`, () => {
				const { subject, html, text } = renderEmail(template, locale, data);
				expect(subject).toContain('SK-2026-000042');
				expect(html.startsWith('<!doctype html>')).toBe(true);
				expect(html).toContain(`lang="${locale}-BE"`);
				// email-safe: inline styles only, no CSS variables, no <style>/<script>, no hydration markers
				expect(html).not.toMatch(/var\(--|<style|<script|<!--/);
				expect(html).toContain('♛'); // crown
				if (template === 'order_confirmation') expect(html).toContain('Voor jou &lt;3'); // user text is escaped
				expect(text).toContain('DEMO Klaverring');
				expect({ subject, html }).toMatchSnapshot();
			});
		}
	}

	it('uses the requested locale regardless of the ambient one', () => {
		expect(renderEmail('order_confirmation', 'fr', data).subject).toBe('Merci pour votre commande SK-2026-000042');
		expect(renderEmail('order_confirmation', 'nl', data).subject).toBe('Bedankt voor je bestelling SK-2026-000042');
		expect(renderEmail('payment_failed', 'fr', data).html).toContain('Réessayer le paiement');
	});

	it('shows the pickup point instead of the address for pickup orders', () => {
		const { html } = renderEmail('order_confirmation', 'nl', {
			...data,
			shippingMethod: 'pickup',
			servicePoint: { name: 'DEMO bpost punt', street: 'Marktplein 1', postalCode: '1000', city: 'Brussel' }
		});
		expect(html).toContain('Afhaalpunt');
		expect(html).toContain('DEMO bpost punt');
	});
});

describe('sendEmail', () => {
	const { db, close } = openTestDb();
	afterAll(() => close());

	it('sends through the adapter and writes email_log', async () => {
		const email = memoryEmail();
		const refId = `TEST-${crypto.randomUUID().slice(0, 8)}`;
		await sendEmail(
			{ db, email },
			{ to: 'ann@example.com', template: 'order_confirmation', locale: 'fr', data, refId }
		);
		expect(email.sent).toHaveLength(1);
		expect(email.sent[0]).toMatchObject({
			to: 'ann@example.com',
			template: 'order_confirmation',
			subject: 'Merci pour votre commande SK-2026-000042'
		});
		const [log] = await db.select().from(emailLog).where(eq(emailLog.refId, refId));
		expect(log).toMatchObject({ status: 'sent', locale: 'fr', template: 'order_confirmation', providerId: 'mem-1' });
	});

	it('logs a failure and rethrows (so the job is retried)', async () => {
		const refId = `TEST-${crypto.randomUUID().slice(0, 8)}`;
		const broken = { provider: 'mock' as const, send: async () => Promise.reject(new Error('smtp down')) };
		await expect(
			sendEmail({ db, email: broken }, { to: 'ann@example.com', template: 'payment_failed', locale: 'nl', data, refId })
		).rejects.toThrow('smtp down');
		const [log] = await db.select().from(emailLog).where(eq(emailLog.refId, refId));
		expect(log).toMatchObject({ status: 'failed', error: 'smtp down' });
	});
});

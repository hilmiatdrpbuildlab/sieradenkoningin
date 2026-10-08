/**
 * Transactional email (P2-08). Templates are Svelte components in `components/email/*`, rendered to
 * an HTML string with `render()` from 'svelte/server' (inline styles only), sent through the
 * `email` adapter (Postmark, or the mock writer → .data/emails/*.html) and logged in `email_log`.
 */
import { render } from 'svelte/server';
import type { Component } from 'svelte';
import { eq } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { emailLog, orderLines, orders } from '../db/schema.ts';
import type { EmailAdapter } from '../adapters/email.ts';
import type { JobRow, JobDeps } from '../jobs/index.ts';
import { getSettings } from './settings.ts';
import { estimateDelivery, thanksPath } from './orders.ts';
import { tr } from '../../i18n/index.ts';
import type { Lang } from '../../i18n/paths.ts';
import type { OrderEmailData } from '../../components/email/types.ts';
import OrderConfirmation from '../../components/email/OrderConfirmation.svelte';
import PaymentFailed from '../../components/email/PaymentFailed.svelte';
import { m } from '../../paraglide/messages.js';

export type { OrderEmailData };

interface TemplateDef<D> {
	component: Component<{ locale: Lang; data: D }>;
	subject: (data: D, locale: Lang) => string;
	text: (data: D, locale: Lang) => string;
}

const orderText = (d: OrderEmailData, locale: Lang, intro: string) =>
	[
		intro,
		'',
		`${m.email_order_number({}, { locale })}: ${d.number}`,
		...d.lines.map((l) => `${l.qty} × ${l.name} (${l.variantLabel}) — ${l.lineTotalFormatted}`),
		'',
		`${m.email_total({}, { locale })}: ${d.totalFormatted}`,
		'',
		d.orderUrl
	].join('\n');

export const TEMPLATES = {
	order_confirmation: {
		component: OrderConfirmation,
		subject: (d, locale) => m.email_order_confirmation_subject({ number: d.number }, { locale }),
		text: (d, locale) => orderText(d, locale, m.email_order_confirmation_intro({ name: d.firstName }, { locale }))
	} satisfies TemplateDef<OrderEmailData>,
	payment_failed: {
		component: PaymentFailed,
		subject: (d, locale) => m.email_payment_failed_subject({ number: d.number }, { locale }),
		text: (d, locale) => orderText(d, locale, m.email_payment_failed_intro({ name: d.firstName }, { locale }))
	} satisfies TemplateDef<OrderEmailData>
};
export type TemplateName = keyof typeof TEMPLATES;

/** Strips HTML comments — Svelte's hydration markers (`<!--[0-->`, `<!---->` …) are useless in an email. */
const clean = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');

/** Renders a template to a complete HTML document + plain-text alternative. */
export function renderEmail<T extends TemplateName>(template: T, locale: Lang, data: OrderEmailData) {
	const def = TEMPLATES[template] as TemplateDef<OrderEmailData>;
	const subject = def.subject(data, locale);
	const { body } = render(def.component, { props: { locale, data } });
	const html = `<!doctype html><html lang="${locale === 'fr' ? 'fr-BE' : 'nl-BE'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:0;background:#ebe1d8;">${clean(body)}</body></html>`;
	return { subject, html, text: def.text(data, locale) };
}

const escapeHtml = (s: string) =>
	s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export interface SendEmailDeps {
	db: Executor;
	email: EmailAdapter;
}

/** Renders, sends and logs one email. Throws when sending fails (after logging) so jobs retry. */
export async function sendEmail(
	deps: SendEmailDeps,
	input: {
		to: string;
		template: TemplateName;
		locale: Lang;
		data: OrderEmailData;
		refId?: string | null;
		replyTo?: string;
	}
) {
	const { subject, html, text } = renderEmail(input.template, input.locale, input.data);
	try {
		const { id } = await deps.email.send({
			to: input.to,
			subject,
			html,
			text,
			template: input.template,
			replyTo: input.replyTo || undefined
		});
		await deps.db
			.insert(emailLog)
			.values({
				to: input.to,
				template: input.template,
				locale: input.locale,
				subject,
				providerId: id,
				status: 'sent',
				refId: input.refId ?? null
			});
		return { id };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await deps.db
			.insert(emailLog)
			.values({
				to: input.to,
				template: input.template,
				locale: input.locale,
				subject,
				status: 'failed',
				error: message.slice(0, 2000),
				refId: input.refId ?? null
			});
		throw err;
	}
}

/** Builds the template data for an order (snapshot lines; never live product data). */
export async function orderEmailData(
	db: Executor,
	orderId: string,
	siteUrl: string
): Promise<{ data: OrderEmailData; locale: Lang; to: string } | null> {
	const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
	if (!order) return null;
	const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, order.id));
	const s = await getSettings(db, ['shipping', 'store', 'return_days']);
	const locale: Lang = order.locale === 'fr' ? 'fr' : 'nl';
	const fp = (c: number) =>
		new Intl.NumberFormat(locale === 'fr' ? 'fr-BE' : 'nl-BE', { style: 'currency', currency: 'EUR' }).format(c / 100);
	const site = siteUrl.replace(/\/$/, '');
	const delivery = estimateDelivery(order.placedAt, s.shipping);
	return {
		to: order.email,
		locale,
		data: {
			number: order.number,
			firstName: order.shippingAddress.name.split(' ')[0] ?? '',
			placedAt: order.placedAt.toISOString(),
			lines: lines.map((l) => ({
				name: tr(l.name, locale),
				variantLabel: tr(l.variantLabel, locale),
				qty: l.qty,
				lineTotalFormatted: fp(l.lineTotal)
			})),
			subtotalFormatted: fp(order.subtotal),
			discountFormatted: order.discountTotal > 0 ? fp(order.discountTotal) : null,
			discountCode: order.discountCode,
			shippingFormatted: order.shippingTotal > 0 ? fp(order.shippingTotal) : null,
			totalFormatted: fp(order.total),
			vatFormatted: fp(order.vatTotal),
			shippingMethod: order.shippingMethod,
			shippingAddress: order.shippingAddress,
			servicePoint: order.servicePoint
				? {
						name: order.servicePoint.name,
						street: order.servicePoint.street,
						postalCode: order.servicePoint.postalCode,
						city: order.servicePoint.city
					}
				: null,
			giftWrap: order.giftWrap,
			giftMessage: order.giftMessage,
			deliveryEstimate: new Intl.DateTimeFormat(locale === 'fr' ? 'fr-BE' : 'nl-BE', {
				weekday: 'long',
				day: 'numeric',
				month: 'long',
				timeZone: 'UTC'
			}).format(delivery),
			orderUrl: `${site}${thanksPath(order)}`,
			shopUrl: `${site}/${locale}`,
			storeName: s.store.name || 'Sieradenkoningin',
			storeEmail: s.store.email || null,
			returnDays: s.return_days
		}
	};
}

/** Job handler for `email.send` — payload `{ template, orderId, to?, locale?, refId? }`. */
export async function emailSendJob(job: JobRow, deps: JobDeps) {
	const p = job.payload as { template: TemplateName; orderId?: string; to?: string; locale?: Lang; refId?: string };
	if (!(p.template in TEMPLATES)) throw new Error(`Unknown email template "${p.template}"`);
	if (!p.orderId) throw new Error('email.send: orderId required for order templates');
	const built = await orderEmailData(deps.db, p.orderId, deps.siteUrl);
	if (!built) throw new Error(`email.send: order ${p.orderId} not found`);
	const s = await getSettings(deps.db, ['emails']);
	await sendEmail(deps, {
		to: p.to ?? built.to,
		template: p.template,
		locale: p.locale ?? built.locale,
		data: built.data,
		refId: p.refId ?? built.data.number,
		replyTo: s.emails.replyTo
	});
}

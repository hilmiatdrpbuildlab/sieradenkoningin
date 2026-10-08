/** Public FAQ (P4-02): grouped accordion + FAQPage JSON-LD. Cacheable. */
import type { PageServerLoad } from './$types';
import { getFaqs } from '#lib/server/services/content.ts';
import { tr } from '#lib/i18n/index.ts';

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
	const lang = params.lang;
	const rows = await getFaqs(locals.db);
	const order = ['general', 'orders', 'shipping', 'payment', 'returns', 'products'];
	const groups = [...new Set(rows.map((r) => r.group))].sort(
		(a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)
	);
	setHeaders({ 'cache-control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400' });
	return {
		groups: groups.map((group) => ({
			group,
			items: rows
				.filter((r) => r.group === group)
				.map((r) => ({ id: r.id, question: tr(r.question, lang), answer: tr(r.answer, lang) }))
		})),
		alternates: { nl: '/nl/faq', fr: '/fr/faq' }
	};
};

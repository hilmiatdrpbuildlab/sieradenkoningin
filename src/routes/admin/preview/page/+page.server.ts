/**
 * Admin-only live preview of an UNSAVED page draft (P4-01). The page builder POSTs the draft JSON into
 * an iframe; blocks are validated, filtered for the chosen moment (schedule/hidden) and resolved with
 * the same `resolveBlocks()` the storefront uses. Nothing is written.
 */
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { validateBlocks } from '#lib/server/services/content.ts';
import { resolveBlocks } from '#lib/server/services/blocks.ts';
import { getSettings } from '#lib/server/services/settings.ts';
import { emptyCart } from '#lib/server/services/cart.ts';
import { isBlockVisible } from '#lib/schemas/page-block.ts';
import { isLang } from '#lib/i18n/paths.ts';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'content:read');
	const { shipping } = await getSettings(locals.db, ['shipping']);
	return { emptyCart: emptyCart(shipping.freeFrom) };
};

export const actions: Actions = {
	render: async ({ request, locals }) => {
		requirePermission(locals, 'content:read');
		let draft: { blocks?: unknown; lang?: unknown; at?: unknown; focus?: unknown; title?: unknown };
		try {
			draft = JSON.parse(String((await request.formData()).get('draft') ?? '{}'));
		} catch {
			return fail(400, { errors: ['Ongeldige preview-gegevens'] });
		}
		const lang = isLang(draft.lang) ? draft.lang : 'nl';
		const at = typeof draft.at === 'string' && !Number.isNaN(Date.parse(draft.at)) ? new Date(draft.at) : new Date();
		const { blocks, errors } = validateBlocks(draft.blocks ?? []);
		const visible = blocks.filter((b) => isBlockVisible(b, at));
		return {
			preview: {
				lang,
				at: at.toISOString(),
				errors,
				focus: typeof draft.focus === 'string' ? draft.focus : null,
				hiddenCount: blocks.length - visible.length,
				blocks: await resolveBlocks(locals.db, visible, lang)
			}
		};
	}
};

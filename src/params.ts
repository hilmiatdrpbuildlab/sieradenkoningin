import { defineParams } from '@sveltejs/kit/params';
import { isLang } from '#lib/i18n/paths.ts';

export const params = defineParams({
	/** `[lang=lang]` — the two shipped storefront languages (en is prepared for V2). */
	lang: (param) => (isLang(param) ? param : undefined)
});

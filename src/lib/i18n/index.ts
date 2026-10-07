/** i18n helpers shared by server and client. Message strings come from Paraglide (`m.*()`). */
import type { Lang } from './paths.ts';
export { localizeHref, htmlLang, LANGS, type Lang } from './paths.ts';

export type I18nValue = { nl: string; fr?: string; en?: string } | null | undefined;

/** Pick the translation for `lang`, falling back to Dutch (the base locale). */
export function tr(value: I18nValue, lang: Lang): string {
	if (!value) return '';
	return (lang === 'fr' ? value.fr : value.nl) || value.nl || '';
}

/** Intl locale for formatting. */
export const intlLocale = (lang: Lang) => (lang === 'fr' ? 'fr-BE' : 'nl-BE');

/** Is the FR translation missing? (admin "needs translation" indicators) */
export const missingFr = (value: I18nValue) => !!value?.nl && !value?.fr?.trim();

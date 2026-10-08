/**
 * URL slugs (client + server). `slugify('Bague trèfle — Or rosé')` → `'bague-trefle-or-rose'`.
 * Lowercase ASCII letters, digits and single hyphens; matches `slugSchema` in #lib/schemas/common.ts.
 */
const LIGATURES: Record<string, string> = { æ: 'ae', œ: 'oe', ß: 'ss', ø: 'o', đ: 'd', ł: 'l', þ: 'th', ð: 'd' };

export function slugify(input: string, maxLength = 80): string {
	const ascii = input
		.toLowerCase()
		.replace(/[æœßøđłþð]/g, (c) => LIGATURES[c] ?? c)
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '') // strip combining accents
		.replace(/&/g, ' en ')
		.replace(/['’`]/g, '') // l'or → lor (no stray hyphen)
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	if (ascii.length <= maxLength) return ascii;
	// cut at a hyphen boundary so we never end mid-word when possible
	const cut = ascii.slice(0, maxLength);
	const at = cut.lastIndexOf('-');
	return (at > maxLength / 2 ? cut.slice(0, at) : cut).replace(/-+$/, '');
}

/**
 * First free slug: `base`, `base-2`, `base-3`, … `taken` decides whether a candidate is in use.
 * Pass a `suffix` (e.g. 'kopie') to start from `base-kopie`.
 */
export async function uniqueSlug(base: string, taken: (slug: string) => boolean | Promise<boolean>, suffix?: string): Promise<string> {
	const root = slugify(suffix ? `${base}-${suffix}` : base) || 'item';
	if (!(await taken(root))) return root;
	for (let n = 2; n < 1000; n++) {
		const candidate = `${root}-${n}`;
		if (!(await taken(candidate))) return candidate;
	}
	return `${root}-${crypto.randomUUID().slice(0, 8)}`;
}

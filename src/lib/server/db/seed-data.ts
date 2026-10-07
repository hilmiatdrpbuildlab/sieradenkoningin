/**
 * Reference + DEMO data for `npm run db:seed`.
 * Everything that is not structural (categories, settings, zones) is prefixed DEMO / marked as
 * placeholder so it can never be mistaken for real product data or final brand copy (§0.5).
 */
import type { I18n, MenuItem } from './schema.ts';
import type { Block } from '../../schemas/page-block.ts';

export const CATEGORY_SEED = [
	{ key: 'rings', slugs: { nl: 'ringen', fr: 'bagues' }, name: { nl: 'Ringen', fr: 'Bagues' }, icon: 'ring' },
	{ key: 'bracelets', slugs: { nl: 'armbanden', fr: 'bracelets' }, name: { nl: 'Armbanden', fr: 'Bracelets' }, icon: 'bracelet' },
	{ key: 'necklaces', slugs: { nl: 'kettingen', fr: 'colliers' }, name: { nl: 'Kettingen', fr: 'Colliers' }, icon: 'necklace' },
	{ key: 'earrings', slugs: { nl: 'oorbellen', fr: 'boucles-d-oreilles' }, name: { nl: 'Oorbellen', fr: "Boucles d'oreilles" }, icon: 'earrings' },
	{ key: 'sets', slugs: { nl: 'sets', fr: 'parures' }, name: { nl: 'Sets', fr: 'Parures' }, icon: 'sets' },
	{ key: 'accessories', slugs: { nl: 'accessoires', fr: 'accessoires' }, name: { nl: 'Accessoires', fr: 'Accessoires' }, icon: 'accessories' }
] as const;

export const RING_SIZES = ['50', '52', '54', '56', '58'];
export const BRACELET_SIZES = ['S', 'M', 'L'];

const motifs: { nl: string; fr: string; slug: string }[] = [
	{ nl: 'Klaver', fr: 'Trèfle', slug: 'klaver' },
	{ nl: 'Kroon', fr: 'Couronne', slug: 'kroon' },
	{ nl: 'Sparkle', fr: 'Étincelle', slug: 'sparkle' },
	{ nl: 'Koord', fr: 'Torsade', slug: 'koord' }
];

const typeName: Record<string, { nl: string; fr: string }> = {
	rings: { nl: 'ring', fr: 'bague' },
	bracelets: { nl: 'armband', fr: 'bracelet' },
	necklaces: { nl: 'ketting', fr: 'collier' },
	earrings: { nl: 'oorbellen', fr: "boucles d'oreilles" },
	sets: { nl: 'set', fr: 'parure' },
	accessories: { nl: 'sleutelhanger', fr: 'porte-clés' }
};

const stones = ['red', 'none', 'white', 'red'];

export interface DemoProduct {
	slug: string;
	categoryKey: string;
	name: I18n;
	description: I18n;
	meaning: I18n;
	material: I18n;
	price: number;
	compareAtPrice: number | null;
	stoneColor: string;
	featured: boolean;
	badge: string | null;
	tags: string[];
	engravable: boolean;
	ageDays: number;
}

/** 24 DEMO products: 4 per category, deterministic so the seed stays idempotent. */
export function demoProducts(): DemoProduct[] {
	const out: DemoProduct[] = [];
	CATEGORY_SEED.forEach((cat, ci) => {
		motifs.forEach((motif, mi) => {
			const t = typeName[cat.key];
			const base = 2900 + ci * 1000 + mi * 1500; // DEMO prices
			out.push({
				slug: `demo-${motif.slug}-${t.nl.replace(/\s/g, '-')}`,
				categoryKey: cat.key,
				name: { nl: `DEMO ${motif.nl}${t.nl}`, fr: `DEMO ${t.fr} ${motif.fr.toLowerCase()}` },
				description: {
					nl: `DEMO-product voor test en preview. Vervang deze tekst door de echte productomschrijving.`,
					fr: `Produit DEMO pour test et aperçu. Remplacez ce texte par la description réelle.`
				},
				meaning: {
					nl: `DEMO — plaatshouder voor het verhaal achter het ${motif.nl.toLowerCase()}-motief.`,
					fr: `DEMO — emplacement pour l'histoire du motif ${motif.fr.toLowerCase()}.`
				},
				material: { nl: 'DEMO · verguld edelstaal', fr: 'DEMO · acier inoxydable doré' },
				price: base - (base % 100) + 95,
				compareAtPrice: mi === 3 ? base - (base % 100) + 95 + 1500 : null,
				stoneColor: stones[mi],
				featured: mi === 0,
				badge: mi === 1 ? 'bestseller' : mi === 2 && ci % 2 === 0 ? 'limited' : null,
				tags: [motif.slug, ...(mi === 3 ? ['sale'] : [])],
				engravable: cat.key === 'rings' || cat.key === 'bracelets',
				ageDays: mi === 0 ? 3 : 45 + ci * 7 + mi
			});
		});
	});
	return out;
}

/** Placeholder art: brand-coloured SVG with the category icon. Variant b = "on model" alt image. */
export function placeholderSvg(iconBody: string, label: string, variant: 'a' | 'b'): string {
	const bg = variant === 'a' ? '#E2D4C8' : '#391617';
	const fg = variant === 'a' ? '#492520' : '#C9A46A';
	const text = variant === 'a' ? '#875543' : '#B89985';
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 2000" width="1600" height="2000"><rect width="1600" height="2000" fill="${bg}"/><g transform="translate(400 560) scale(12.5)" fill="none" stroke="${fg}" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round">${iconBody}</g><text x="800" y="1640" text-anchor="middle" font-family="Georgia, serif" font-size="64" letter-spacing="12" fill="${text}">${label}</text><text x="800" y="1730" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" letter-spacing="10" fill="${text}">DEMO · PLACEHOLDER</text></svg>`;
}

/** Large editorial placeholder (hero, editorial split). */
export function editorialSvg(crownPaths: string, wide = true): string {
	const [w, h] = wide ? [2400, 1600] : [1600, 2000];
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#5a2a26"/><stop offset="1" stop-color="#240d0e"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><g transform="translate(${w / 2 - 240} ${h / 2 - 330}) scale(20)" fill="none" stroke="#C9A46A" stroke-width="0.35" stroke-linecap="round" stroke-linejoin="round" opacity="0.55">${crownPaths}</g><text x="${w / 2}" y="${h - 120}" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" letter-spacing="10" fill="#B89985" opacity="0.7">DEMO · EDITORIAL PLACEHOLDER</text></svg>`;
}

const both = (nl: string, fr: string): I18n => ({ nl, fr });

export const MENUS: Record<string, MenuItem[]> = {
	main: [
		{ label: both('Nieuw', 'Nouveautés'), href: both('/nl/collectie/nieuw', '/fr/collection/nouveautes') },
		{ label: both('Ringen', 'Bagues'), href: both('/nl/ringen', '/fr/bagues') },
		{ label: both('Kettingen', 'Colliers'), href: both('/nl/kettingen', '/fr/colliers') },
		{ label: both('Oorbellen', "Boucles d'oreilles"), href: both('/nl/oorbellen', '/fr/boucles-d-oreilles') },
		{ label: both('Armbanden', 'Bracelets'), href: both('/nl/armbanden', '/fr/bracelets') },
		{ label: both('Sets', 'Parures'), href: both('/nl/sets', '/fr/parures') },
		{ label: both('Accessoires', 'Accessoires'), href: both('/nl/accessoires', '/fr/accessoires') }
	],
	footer_shop: [
		{ label: both('Nieuw', 'Nouveautés'), href: both('/nl/collectie/nieuw', '/fr/collection/nouveautes') },
		{ label: both('Ringen', 'Bagues'), href: both('/nl/ringen', '/fr/bagues') },
		{ label: both('Kettingen', 'Colliers'), href: both('/nl/kettingen', '/fr/colliers') },
		{ label: both('Oorbellen', "Boucles d'oreilles"), href: both('/nl/oorbellen', '/fr/boucles-d-oreilles') },
		{ label: both('Armbanden', 'Bracelets'), href: both('/nl/armbanden', '/fr/bracelets') }
	],
	footer_help: [
		{ label: both('Veelgestelde vragen', 'Questions fréquentes'), href: both('/nl/faq', '/fr/faq') },
		{ label: both('Verzending & levering', 'Livraison'), href: both('/nl/verzending', '/fr/livraison') },
		{ label: both('Retourneren', 'Retours'), href: both('/nl/retourneren', '/fr/retours') },
		{ label: both('Bestelling volgen', 'Suivre ma commande'), href: both('/nl/bestelling-volgen', '/fr/suivi-commande') },
		{ label: both('Contact', 'Contact'), href: both('/nl/contact', '/fr/contact') }
	],
	footer_about: [
		{ label: both('Ons verhaal', 'Notre histoire'), href: both('/nl/ons-verhaal', '/fr/notre-histoire') },
		{ label: both('Maatgids', 'Guide des tailles'), href: both('/nl/maatgids', '/fr/guide-des-tailles') },
		{ label: both('Materiaal & onderhoud', 'Matières & entretien'), href: both('/nl/materiaal-en-onderhoud', '/fr/matieres-et-entretien') }
	],
	footer_legal: [
		{ label: both('Algemene voorwaarden', 'Conditions générales'), href: both('/nl/voorwaarden', '/fr/conditions') },
		{ label: both('Privacy', 'Confidentialité'), href: both('/nl/privacy', '/fr/confidentialite') },
		{ label: both('Cookies', 'Cookies'), href: both('/nl/cookies', '/fr/cookies') },
		{ label: both('Herroepingsrecht', 'Droit de rétractation'), href: both('/nl/herroeping', '/fr/retractation') },
		{ label: both('Wettelijke vermeldingen', 'Mentions légales'), href: both('/nl/wettelijke-vermeldingen', '/fr/mentions-legales') },
		{ label: both('Toegankelijkheid', 'Accessibilité'), href: both('/nl/toegankelijkheid', '/fr/accessibilite') }
	]
};

type PageSeed = { key: string; type: 'home' | 'page' | 'legal'; slugs: { nl: string; fr: string }; title: I18n; blocks: Omit<Block, 'id'>[] };

const placeholderBody = (what: string) =>
	both(
		`**Plaatshouder** — de definitieve tekst voor "${what}" wordt aangeleverd door de eigenaar (taak P4-08). Bewerk deze pagina in Beheer → Content → Pagina's.`,
		`**Texte provisoire** — le texte définitif pour « ${what} » sera fourni par la propriétaire (tâche P4-08). Modifiez cette page dans Gestion → Contenu → Pages.`
	);

export function pageSeeds(heroKey: string, editorialKey: string): PageSeed[] {
	const hrefNew = both('/nl/collectie/nieuw', '/fr/collection/nouveautes');
	return [
		{
			key: 'home',
			type: 'home',
			slugs: { nl: '', fr: '' },
			title: both('Home', 'Accueil'),
			blocks: [
				{
					type: 'hero',
					data: {
						variant: 'overlay',
						overline: both('More than jewelry', 'More than jewelry'),
						title: both("It's a state of mind", "It's a state of mind"),
						script: both('You', 'You'),
						lead: both('DEMO — introductietekst voor de nieuwe collectie.', 'DEMO — texte d’introduction de la nouvelle collection.'),
						image: { key: heroKey, alt: both('DEMO sfeerbeeld', 'DEMO image d’ambiance'), width: 2400, height: 1600 },
						cta: { label: both('Ontdek de collectie', 'Découvrir la collection'), href: hrefNew },
						secondaryCta: { label: both('Ons verhaal', 'Notre histoire'), href: both('/nl/ons-verhaal', '/fr/notre-histoire') }
					}
				},
				{
					type: 'usp_bar',
					data: {
						items: [
							{ icon: 'truck', text: both('Gratis verzending vanaf € 50', 'Livraison gratuite dès 50 €') },
							{ icon: 'gift', text: both('Cadeauverpakking mogelijk', 'Emballage cadeau disponible') },
							{ icon: 'sparkle', text: both('14 dagen bedenktijd', '14 jours de rétractation') }
						]
					}
				},
				{ type: 'category_strip', data: { eyebrow: both('Shop per categorie', 'Par catégorie'), title: both('Vind jouw stuk', 'Trouvez votre bijou') } },
				{
					type: 'product_rail',
					data: { eyebrow: both('Net binnen', 'Tout juste arrivés'), title: both('Nieuw', 'Nouveautés'), source: 'new', limit: 8, cta: { label: both('Alles nieuw', 'Toutes les nouveautés'), href: hrefNew } }
				},
				{ type: 'quote_band', data: { quote: both('A daily reminder that you are a queen', 'A daily reminder that you are a queen'), surface: 'espresso' } },
				{
					type: 'editorial_split',
					data: {
						eyebrow: both('Met betekenis', 'Avec du sens'),
						title: both('Het verhaal achter de klaver', "L'histoire du trèfle"),
						body: both(
							'DEMO — plaatshouder voor het verhaal over de symboliek van de klaver en de kroon. Definitieve tekst volgt (P4-08).',
							'DEMO — texte provisoire sur la symbolique du trèfle et de la couronne. Texte définitif à venir (P4-08).'
						),
						image: { key: editorialKey, alt: both('DEMO editoriaal beeld', 'DEMO image éditoriale'), width: 1600, height: 2000 },
						cta: { label: both('Lees ons verhaal', 'Lire notre histoire'), href: both('/nl/ons-verhaal', '/fr/notre-histoire') },
						reverse: false
					}
				},
				{ type: 'product_rail', data: { eyebrow: both('Geliefd', 'Les préférés'), title: both('Bestsellers', 'Best-sellers'), source: 'bestsellers', limit: 8 } },
				{
					type: 'newsletter',
					data: {
						title: both('Ontvang je dagelijkse reminder', 'Recevez votre rappel quotidien'),
						text: both('Als eerste nieuwe collecties en exclusieve acties.', 'Soyez la première informée des nouvelles collections.')
					}
				}
			]
		},
		{ key: 'story', type: 'page', slugs: { nl: 'ons-verhaal', fr: 'notre-histoire' }, title: both('Ons verhaal', 'Notre histoire'), blocks: [{ type: 'rich_text', data: { body: placeholderBody('Ons verhaal') } }] },
		{
			key: 'size-guide',
			type: 'page',
			slugs: { nl: 'maatgids', fr: 'guide-des-tailles' },
			title: both('Maatgids', 'Guide des tailles'),
			blocks: [
				{ type: 'size_table', data: { kind: 'ring', title: both('Ringmaten', 'Tailles de bague') } },
				{ type: 'size_table', data: { kind: 'bracelet', title: both('Armbandmaten', 'Tailles de bracelet') } },
				{ type: 'rich_text', data: { body: placeholderBody('Maatgids') } }
			]
		},
		{ key: 'care', type: 'page', slugs: { nl: 'materiaal-en-onderhoud', fr: 'matieres-et-entretien' }, title: both('Materiaal & onderhoud', 'Matières & entretien'), blocks: [{ type: 'rich_text', data: { body: placeholderBody('Materiaal & onderhoud') } }] },
		{ key: 'shipping', type: 'page', slugs: { nl: 'verzending', fr: 'livraison' }, title: both('Verzending & levering', 'Livraison'), blocks: [{ type: 'rich_text', data: { body: placeholderBody('Verzending & levering') } }] },
		{ key: 'returns', type: 'page', slugs: { nl: 'retourneren', fr: 'retours' }, title: both('Retourneren', 'Retours'), blocks: [{ type: 'rich_text', data: { body: placeholderBody('Retourneren') } }] },
		...(
			[
				['terms', 'voorwaarden', 'conditions', 'Algemene voorwaarden', 'Conditions générales'],
				['privacy', 'privacy', 'confidentialite', 'Privacyverklaring', 'Politique de confidentialité'],
				['cookies', 'cookies', 'cookies', 'Cookiebeleid', 'Politique en matière de cookies'],
				['withdrawal', 'herroeping', 'retractation', 'Herroepingsrecht', 'Droit de rétractation'],
				['legal-notice', 'wettelijke-vermeldingen', 'mentions-legales', 'Wettelijke vermeldingen', 'Mentions légales'],
				['accessibility', 'toegankelijkheid', 'accessibilite', 'Toegankelijkheidsverklaring', "Déclaration d'accessibilité"]
			] as const
		).map(([key, nl, fr, tnl, tfr]) => ({
			key,
			type: 'legal' as const,
			slugs: { nl, fr },
			title: both(tnl, tfr),
			blocks: [{ type: 'legal_slot' as const, data: { slot: key } }]
		}))
	];
}

export const FAQ_SEED: { group: string; question: I18n; answer: I18n }[] = [
	{ group: 'orders', question: both('DEMO — Hoe lang duurt de levering?', 'DEMO — Quel est le délai de livraison ?'), answer: both('Plaatshouder-antwoord. Definitieve tekst volgt (P4-08).', 'Réponse provisoire. Texte définitif à venir (P4-08).') },
	{ group: 'orders', question: both('DEMO — Kan ik mijn bestelling retourneren?', 'DEMO — Puis-je retourner ma commande ?'), answer: both('Plaatshouder-antwoord. Definitieve tekst volgt (P4-08).', 'Réponse provisoire. Texte définitif à venir (P4-08).') },
	{ group: 'products', question: both('DEMO — Hoe onderhoud ik mijn juwelen?', 'DEMO — Comment entretenir mes bijoux ?'), answer: both('Plaatshouder-antwoord. Definitieve tekst volgt (P4-08).', 'Réponse provisoire. Texte définitif à venir (P4-08).') }
];

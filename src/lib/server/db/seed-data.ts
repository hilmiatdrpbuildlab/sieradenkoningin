/**
 * Reference + DEMO data for `npm run db:seed`.
 * Everything that is not structural (categories, settings, zones) is prefixed DEMO / marked as
 * placeholder so it can never be mistaken for real product data or final brand copy (§0.5).
 */
import type { I18n, MenuItem } from './schema.ts';
import type { Block } from '../../schemas/page-block.ts';

export const CATEGORY_SEED = [
	{ key: 'rings', slugs: { nl: 'ringen', fr: 'bagues' }, name: { nl: 'Ringen', fr: 'Bagues' }, icon: 'ring' },
	{
		key: 'bracelets',
		slugs: { nl: 'armbanden', fr: 'bracelets' },
		name: { nl: 'Armbanden', fr: 'Bracelets' },
		icon: 'bracelet'
	},
	{
		key: 'necklaces',
		slugs: { nl: 'kettingen', fr: 'colliers' },
		name: { nl: 'Kettingen', fr: 'Colliers' },
		icon: 'necklace'
	},
	{
		key: 'earrings',
		slugs: { nl: 'oorbellen', fr: 'boucles-d-oreilles' },
		name: { nl: 'Oorbellen', fr: "Boucles d'oreilles" },
		icon: 'earrings'
	},
	{ key: 'sets', slugs: { nl: 'sets', fr: 'parures' }, name: { nl: 'Sets', fr: 'Parures' }, icon: 'sets' },
	{
		key: 'accessories',
		slugs: { nl: 'accessoires', fr: 'accessoires' },
		name: { nl: 'Accessoires', fr: 'Accessoires' },
		icon: 'accessories'
	}
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
	const bg = variant === 'a' ? '#F2E8DB' : '#4B0E19';
	const fg = variant === 'a' ? '#38251F' : '#C5A16C';
	const text = variant === 'a' ? '#6E5A50' : '#E8D5BC';
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 2000" width="1600" height="2000"><rect width="1600" height="2000" fill="${bg}"/><g transform="translate(400 560) scale(12.5)" fill="none" stroke="${fg}" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round">${iconBody}</g><text x="800" y="1640" text-anchor="middle" font-family="Georgia, serif" font-size="64" letter-spacing="12" fill="${text}">${label}</text><text x="800" y="1730" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" letter-spacing="10" fill="${text}">DEMO · PLACEHOLDER</text></svg>`;
}

/** Large editorial placeholder (hero, editorial split). */
export function editorialSvg(crownPaths: string, wide = true): string {
	const [w, h] = wide ? [2400, 1600] : [1600, 2000];
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#6a1a29"/><stop offset="1" stop-color="#2e0810"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><g transform="translate(${w / 2 - 240} ${h / 2 - 330}) scale(20)" fill="none" stroke="#C5A16C" stroke-width="0.35" stroke-linecap="round" stroke-linejoin="round" opacity="0.55">${crownPaths}</g><text x="${w / 2}" y="${h - 120}" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" letter-spacing="10" fill="#E8D5BC" opacity="0.7">DEMO · EDITORIAL PLACEHOLDER</text></svg>`;
}

const both = (nl: string, fr: string): I18n => ({ nl, fr });
const href = (nl: string, fr: string) => both(`/nl/${nl}`, `/fr/${fr}`);

// ── Brand copy (brandbook “De Sieradenkoningin”, §04–§10) ────────────────────────────────────────
// Texts marked “Plaatshouder” / “[aan te vullen]” need the owner's real data before launch (§16).

const LINKS = {
	all: href('collectie/alle-juwelen', 'collection/tous-les-bijoux'),
	new: href('collectie/nieuw', 'collection/nouveautes'),
	favorites: href('collectie/onze-favorieten', 'collection/nos-favoris'),
	gifts: href('collectie/cadeaus', 'collection/cadeaux'),
	story: href('ons-verhaal', 'notre-histoire'),
	mission: href('onze-missie', 'notre-mission'),
	contact: href('contact', 'contact'),
	faq: href('faq', 'faq'),
	shipping: href('verzending', 'livraison'),
	returns: href('retourneren', 'retours'),
	care: href('materiaal-en-onderhoud', 'matieres-et-entretien'),
	track: href('bestelling-volgen', 'suivi-commande'),
	sizes: href('maatgids', 'guide-des-tailles')
};

export const MENUS: Record<string, MenuItem[]> = {
	// Next to the “Shop” disclosure in the header (brandbook §04: Ons verhaal · Onze missie · Contact).
	main: [
		{ label: both('Ons verhaal', 'Notre histoire'), href: LINKS.story },
		{ label: both('Onze missie', 'Notre mission'), href: LINKS.mission },
		{ label: both('Contact', 'Contact'), href: LINKS.contact }
	],
	// Top of the Shop disclosure; the categories are listed automatically next to it.
	shop: [
		{ label: both('Alle juwelen', 'Tous les bijoux'), href: LINKS.all },
		{ label: both('Nieuw binnen', 'Nouveautés'), href: LINKS.new },
		{ label: both('Onze favorieten', 'Nos favoris'), href: LINKS.favorites },
		{ label: both('Cadeaus', 'Cadeaux'), href: LINKS.gifts }
	],
	footer_shop: [
		{ label: both('Alle juwelen', 'Tous les bijoux'), href: LINKS.all },
		{ label: both('Nieuw binnen', 'Nouveautés'), href: LINKS.new },
		{ label: both('Onze favorieten', 'Nos favoris'), href: LINKS.favorites },
		{ label: both('Ringen', 'Bagues'), href: href('ringen', 'bagues') },
		{ label: both('Armbanden', 'Bracelets'), href: href('armbanden', 'bracelets') },
		{ label: both('Kettingen', 'Colliers'), href: href('kettingen', 'colliers') },
		{ label: both('Oorbellen', "Boucles d'oreilles"), href: href('oorbellen', 'boucles-d-oreilles') },
		{ label: both('Cadeaus', 'Cadeaux'), href: LINKS.gifts }
	],
	footer_help: [
		{ label: both('Contact', 'Contact'), href: LINKS.contact },
		{ label: both('Veelgestelde vragen', 'Questions fréquentes'), href: LINKS.faq },
		{ label: both('Verzending', 'Livraison'), href: LINKS.shipping },
		{ label: both('Retourneren', 'Retours'), href: LINKS.returns },
		{ label: both('Onderhoud', 'Entretien'), href: LINKS.care },
		{ label: both('Maatgids', 'Guide des tailles'), href: LINKS.sizes },
		{ label: both('Bestelling volgen', 'Suivre ma commande'), href: LINKS.track }
	],
	footer_about: [
		{ label: both('Ons verhaal', 'Notre histoire'), href: LINKS.story },
		{ label: both('Onze missie', 'Notre mission'), href: LINKS.mission },
		{ label: both('Samenwerken', 'Collaborer'), href: LINKS.contact }
	],
	footer_legal: [
		{ label: both('Algemene voorwaarden', 'Conditions générales'), href: href('voorwaarden', 'conditions') },
		{ label: both('Privacybeleid', 'Politique de confidentialité'), href: href('privacy', 'confidentialite') },
		{ label: both('Cookiebeleid', 'Politique en matière de cookies'), href: href('cookies', 'cookies') },
		{ label: both('Herroepingsrecht', 'Droit de rétractation'), href: href('herroeping', 'retractation') },
		{
			label: both('Bedrijfsgegevens', 'Mentions légales'),
			href: href('wettelijke-vermeldingen', 'mentions-legales')
		},
		{ label: both('Toegankelijkheid', 'Accessibilité'), href: href('toegankelijkheid', 'accessibilite') }
	]
};

/** Default announcement bar (Beheer → Content → Aankondiging). A short brand line, no promo pressure. */
export const ANNOUNCEMENT_SEED = {
	text: both('Wear your crown · Kleine details. Een groot gevoel.', 'Wear your crown · Petits détails. Grand effet.')
};

export interface CollectionSeed {
	key: string;
	slugs: { nl: string; fr: string };
	name: I18n;
	description: I18n;
	seo: { title: I18n };
	type: 'manual' | 'rule';
	rule?: { newWithinDays?: number };
	/** DEMO only: which demo products to put in a manual collection. */
	demoPick?: (p: DemoProduct) => boolean;
}

export const COLLECTION_SEED: CollectionSeed[] = [
	{
		key: 'all',
		slugs: { nl: 'alle-juwelen', fr: 'tous-les-bijoux' },
		name: both('Ontdek jouw kroon', 'Découvrez votre couronne'),
		description: both(
			'Van subtiele details tot juwelen die meteen de aandacht trekken. Ontdek onze collectie en vind de stukken die passen bij jouw stijl, jouw persoonlijkheid en jouw verhaal.',
			'Des détails subtils aux bijoux qui attirent tous les regards. Découvrez notre collection et trouvez les pièces qui correspondent à votre style, à votre personnalité et à votre histoire.'
		),
		seo: { title: both('Alle juwelen', 'Tous les bijoux') },
		type: 'rule',
		rule: {}
	},
	{
		key: 'new',
		slugs: { nl: 'nieuw', fr: 'nouveautes' },
		name: both('Just arrived. Ready to shine.', 'Just arrived. Ready to shine.'),
		description: both(
			'Nieuwe favorieten, nieuwe combinaties en nieuwe details om verliefd op te worden. Ontdek de nieuwste juwelen van De Sieradenkoningin en geef jouw persoonlijke stijl een nieuwe touch.',
			'De nouveaux favoris, de nouvelles combinaisons et de nouveaux détails dont vous allez tomber amoureuse. Découvrez les dernières nouveautés De Sieradenkoningin et apportez une touche nouvelle à votre style.'
		),
		seo: { title: both('Nieuw binnen', 'Nouveautés') },
		type: 'rule',
		rule: { newWithinDays: 30 }
	},
	{
		// Brandbook §07: call it “Bestsellers” / “De favorieten van onze koninginnen” only once real
		// sales data supports it — until then this is a curated selection.
		key: 'favorites',
		slugs: { nl: 'onze-favorieten', fr: 'nos-favoris' },
		name: both('Onze favorieten', 'Nos favoris'),
		description: both(
			'Sommige details maken meteen indruk. Ontdek de juwelen die we met zorg voor je selecteerden en vind jouw nieuwe favoriet.',
			'Certains détails font tout de suite impression. Découvrez les bijoux que nous avons sélectionnés avec soin et trouvez votre nouveau favori.'
		),
		seo: { title: both('Onze favorieten', 'Nos favoris') },
		type: 'manual',
		demoPick: (p) => p.featured
	},
	{
		key: 'gifts',
		slugs: { nl: 'cadeaus', fr: 'cadeaux' },
		name: both('Een kroon voor iemand bijzonder', 'Une couronne pour quelqu’un de spécial'),
		description: both(
			'Een cadeau hoeft niet groot te zijn om betekenisvol te voelen. Verras een vrouw die je bewondert, iemand die altijd voor anderen klaarstaat of jezelf met een juweel dat een bijzonder moment markeert.',
			'Un cadeau n’a pas besoin d’être grand pour avoir du sens. Faites plaisir à une femme que vous admirez, à quelqu’un qui est toujours là pour les autres, ou à vous-même, avec un bijou qui marque un moment particulier.'
		),
		seo: { title: both('Cadeaus', 'Cadeaux') },
		type: 'manual',
		demoPick: (p) => p.categoryKey === 'sets' || (p.featured && p.categoryKey === 'necklaces')
	}
];

type PageSeed = {
	key: string;
	type: 'home' | 'page' | 'legal';
	slugs: { nl: string; fr: string };
	title: I18n;
	seo?: { title?: I18n; description?: I18n };
	blocks: Omit<Block, 'id'>[];
};

const placeholderBody = (what: string) =>
	both(
		`**Plaatshouder** — de definitieve tekst voor "${what}" wordt aangeleverd door de eigenaar. Bewerk deze pagina in Beheer → Content → Pagina's.`,
		`**Texte provisoire** — le texte définitif pour « ${what} » sera fourni par la propriétaire. Modifiez cette page dans Gestion → Contenu → Pages.`
	);

const md = (...paragraphs: string[]) => paragraphs.join('\n\n');

// ── Ons verhaal (brandbook §05) ──────────────────────────────────────────────────────────────────
// Brandbook text, edited into chapters for a calmer reading rhythm (no new facts or events added — §05).
// Redactionele noot: Zahra leest deze tekst persoonlijk na vóór livegang en voegt alleen details toe
// die ze zelf openbaar wil delen.
type Chapter = { eyebrow: I18n; title: I18n; body: I18n };

const STORY = {
	intro: both(
		md(
			'Mijn naam is Zahra. Achter De Sieradenkoningin staat een vrouw die heeft geleerd dat een nieuw begin soms ontstaat op het moment waarop je het leven helemaal anders had voorgesteld.',
			'Ik ben mama, ondernemer en een vrouw met dromen. Ik ben ook iemand die heeft ervaren dat het leven je soms op de proef stelt — en dat je op bepaalde momenten opnieuw moet ontdekken wie je bent, wat je waard bent en welke toekomst je voor jezelf wilt opbouwen.'
		),
		md(
			'Je m’appelle Zahra. Derrière De Sieradenkoningin se trouve une femme qui a appris qu’un nouveau départ naît parfois au moment même où l’on avait imaginé sa vie tout autrement.',
			'Je suis maman, entrepreneuse et une femme qui a des rêves. Je suis aussi quelqu’un qui a vécu que la vie nous met parfois à l’épreuve — et qu’à certains moments, il faut redécouvrir qui l’on est, ce que l’on vaut et quel avenir on veut se construire.'
		)
	),
	strength: {
		eyebrow: both('I · Veel rollen tegelijk', 'I · Plusieurs rôles à la fois'),
		title: both('Sterk zijn, ook wanneer je moe bent', 'Être forte, même quand on est fatiguée'),
		body: both(
			md(
				'Als alleenstaande mama heb ik geleerd om veel rollen tegelijk te dragen. Er zijn dagen waarop je sterk moet zijn, ook wanneer je moe bent. Dagen waarop je blijft doorgaan voor je kind, terwijl je zelf misschien even nood hebt aan iemand die tegen jou zegt dat het goed komt.',
				'En dan komt er een moment waarop je beseft dat je niet alleen voor anderen wilt blijven zorgen. Dat je ook opnieuw voor jezelf mag kiezen.'
			),
			md(
				'En tant que maman solo, j’ai appris à porter plusieurs rôles à la fois. Il y a des jours où l’on doit être forte, même quand on est fatiguée. Des jours où l’on continue pour son enfant, alors qu’on aurait soi-même besoin que quelqu’un nous dise que tout ira bien.',
				'Et puis vient un moment où l’on réalise qu’on ne veut pas seulement prendre soin des autres. Qu’on a aussi le droit de recommencer à se choisir soi-même.'
			)
		)
	} satisfies Chapter,
	dream: {
		eyebrow: both('II · Een nieuwe start', 'II · Un nouveau départ'),
		title: both('Van een moeilijke periode naar een nieuwe droom', 'D’une période difficile à un nouveau rêve'),
		body: both(
			md(
				'Soms brengt een moeilijke ervaring je op een punt waarop je anders naar het leven gaat kijken. Naar liefde, naar zelfstandigheid, naar je dromen en naar de toekomst die je wilt creëren.',
				'Ik heb geleerd dat wat je meemaakt niet hoeft te bepalen wie je voor altijd bent. Je mag groeien uit moeilijke ervaringen. Je mag opnieuw dromen. Je mag jezelf opnieuw uitvinden en iets opbouwen waar je trots op bent.',
				'Voor mij betekent dat: investeren in mijn eigen dromen, mijn ondernemerschap en mijn financiële zelfstandigheid. Ik wil niet alleen dromen over een mooie toekomst. Ik wil er zelf aan bouwen.',
				'De Sieradenkoningin is een stukje van die nieuwe start. Een merk dat is ontstaan uit mijn liefde voor juwelen, mijn creativiteit en mijn verlangen om iets op te bouwen dat groter is dan alleen een product.'
			),
			md(
				'Parfois, une expérience difficile nous amène à regarder la vie autrement. L’amour, l’indépendance, les rêves et l’avenir que l’on veut créer.',
				'J’ai appris que ce que l’on traverse ne détermine pas qui l’on est pour toujours. On peut grandir à travers les épreuves. On peut rêver à nouveau. On peut se réinventer et construire quelque chose dont on est fière.',
				'Pour moi, cela signifie : investir dans mes propres rêves, dans mon entrepreneuriat et dans mon indépendance financière. Je ne veux pas seulement rêver d’un bel avenir. Je veux le construire moi-même.',
				'De Sieradenkoningin est une part de ce nouveau départ. Une marque née de mon amour pour les bijoux, de ma créativité et de mon envie de bâtir quelque chose de plus grand qu’un simple produit.'
			)
		)
	} satisfies Chapter,
	jewelry: {
		eyebrow: both('III · Waarom juwelen?', 'III · Pourquoi des bijoux ?'),
		title: both('Een klein detail kan veel betekenen', 'Un petit détail peut compter beaucoup'),
		body: both(
			md(
				'Een juweel lijkt misschien een klein detail. Maar soms is het precies dat detail dat je outfit afmaakt, je zelfvertrouwen een boost geeft of je herinnert aan een bijzonder moment.',
				'Ik wilde een merk creëren waarin vrouwelijkheid en kracht samenkomen. Waar elegantie niet betekent dat je kwetsbaar moet zijn, en kracht niet dat je altijd hard moet zijn.',
				'Een merk waar een vrouw zichzelf iets mag gunnen. Niet omdat ze iets moet bewijzen. Niet omdat ze eerst aan alle verwachtingen van anderen moet voldoen. Maar gewoon omdat ook zij het verdient om zichzelf te vieren.'
			),
			md(
				'Un bijou peut sembler n’être qu’un petit détail. Mais c’est parfois justement ce détail qui complète une tenue, donne un coup de pouce à la confiance en soi ou rappelle un moment particulier.',
				'Je voulais créer une marque où la féminité et la force se rencontrent. Où l’élégance ne signifie pas qu’il faut être vulnérable, et la force pas qu’il faut toujours être dure.',
				'Une marque où une femme peut s’offrir quelque chose. Pas pour prouver quoi que ce soit. Pas parce qu’elle doit d’abord répondre aux attentes des autres. Mais simplement parce qu’elle aussi mérite de se célébrer.'
			)
		)
	} satisfies Chapter,
	crown: {
		eyebrow: both('IV · De kroon', 'IV · La couronne'),
		title: both('Iedere vrouw verdient haar eigen kroon', 'Chaque femme mérite sa propre couronne'),
		body: both(
			md(
				'De kroon in ons logo staat voor zoveel meer dan koninklijke elegantie. Ze staat voor eigenwaarde. Voor opnieuw beginnen en opstaan na moeilijke momenten. Voor je eigen keuzes durven maken. Voor de vrouw die je vandaag bent — en de vrouw die je nog wilt worden.',
				'Ik hoop dat iedere vrouw die hier binnenkomt zich herkent in dat gevoel. De mama die iedere dag alles geeft voor haar kinderen. De jonge vrouw die haar eigen weg zoekt. De vrouw die opnieuw begint na een moeilijke relatie. De ondernemer die haar dromen achternagaat. De vrouw die eindelijk leert om zichzelf niet langer op de laatste plaats te zetten.',
				'Je hoeft niet perfect te zijn om trots op jezelf te zijn. Je hoeft niet alles op orde te hebben om jezelf iets moois te gunnen. En je hoeft niet te wachten tot iemand anders jou als een koningin behandelt om te beseffen wat je waard bent.'
			),
			md(
				'La couronne de notre logo représente bien plus qu’une élégance royale. Elle représente l’estime de soi. Le fait de recommencer et de se relever après des moments difficiles. D’oser faire ses propres choix. Elle représente la femme que vous êtes aujourd’hui — et celle que vous voulez encore devenir.',
				'J’espère que chaque femme qui entre ici se reconnaîtra dans ce sentiment. La maman qui donne tout chaque jour pour ses enfants. La jeune femme qui cherche sa propre voie. La femme qui recommence après une relation difficile. L’entrepreneuse qui poursuit ses rêves. La femme qui apprend enfin à ne plus se mettre à la dernière place.',
				'Vous n’avez pas besoin d’être parfaite pour être fière de vous. Vous n’avez pas besoin que tout soit en ordre pour vous offrir quelque chose de beau. Et vous n’avez pas à attendre que quelqu’un vous traite comme une reine pour réaliser ce que vous valez.'
			)
		)
	} satisfies Chapter,
	more: {
		eyebrow: both('V · Mijn droom', 'V · Mon rêve'),
		title: both('Meer dan een juwelenmerk', 'Plus qu’une marque de bijoux'),
		body: both(
			md(
				'Mijn droom gaat verder dan het verkopen van ringen, armbanden, kettingen en oorbellen. Met De Sieradenkoningin wil ik ook een boodschap uitdragen over ambitie en zelfstandigheid. Ik wil jonge meisjes inspireren om in hun talenten te geloven, hun eigen dromen na te jagen en te ontdekken hoe belangrijk het is om financieel op eigen benen te kunnen staan.',
				'Ik geloof dat vrouwen elkaar mogen inspireren om groter te dromen. Dat we elkaar mogen aanmoedigen om te ondernemen, te groeien en kansen te grijpen. Want wanneer een vrouw in zichzelf begint te geloven, kan dat het begin zijn van iets heel moois.',
				'De Sieradenkoningin is mijn manier om die overtuiging een plek te geven. Een merk dat voortkomt uit mijn eigen verhaal, maar waarin ook ruimte is voor het jouwe.'
			),
			md(
				'Mon rêve va au-delà de la vente de bagues, de bracelets, de colliers et de boucles d’oreilles. Avec De Sieradenkoningin, je veux aussi porter un message d’ambition et d’indépendance. Je veux inspirer les jeunes filles à croire en leurs talents, à poursuivre leurs rêves et à découvrir à quel point il est important de pouvoir être financièrement indépendante.',
				'Je crois que les femmes peuvent s’inspirer mutuellement à rêver plus grand. Que nous pouvons nous encourager à entreprendre, à grandir et à saisir les opportunités. Car lorsqu’une femme commence à croire en elle, cela peut être le début de quelque chose de très beau.',
				'De Sieradenkoningin est ma façon de donner une place à cette conviction. Une marque issue de ma propre histoire, mais qui laisse aussi de la place à la vôtre.'
			)
		)
	} satisfies Chapter,
	reminder: {
		eyebrow: both('VI · Tot slot', 'VI · Pour finir'),
		title: both('Dit is jouw herinnering', 'Ceci est votre rappel'),
		body: both(
			md(
				'Wanneer je een juweel van De Sieradenkoningin draagt, hoop ik dat je er meer in ziet dan alleen een mooi accessoire. Misschien is het een cadeau voor jezelf na een moeilijke periode. Een beloning voor een doel dat je hebt bereikt. Een herinnering aan een nieuwe start. Of gewoon een klein moment waarop je jezelf eraan herinnert dat jij er ook toe doet.',
				'Wat jouw verhaal ook is: je bent welkom. Iedere vrouw draagt haar eigen verhaal, haar eigen strijd, haar eigen dromen — en haar eigen momenten waarop ze opnieuw moet beginnen. En iedere vrouw verdient het om zich mooi, krachtig en waardevol te voelen.',
				'**Welkom bij De Sieradenkoningin.** Jouw verhaal. Jouw kracht. Jouw kroon.',
				'Liefs,'
			),
			md(
				'Lorsque vous portez un bijou De Sieradenkoningin, j’espère que vous y verrez plus qu’un joli accessoire. Peut-être un cadeau pour vous-même après une période difficile. Une récompense pour un objectif atteint. Le souvenir d’un nouveau départ. Ou simplement un petit moment pour vous rappeler que vous aussi, vous comptez.',
				'Quelle que soit votre histoire : vous êtes la bienvenue. Chaque femme porte sa propre histoire, ses propres combats, ses propres rêves — et ses propres moments où elle doit recommencer. Et chaque femme mérite de se sentir belle, forte et précieuse.',
				'**Bienvenue chez De Sieradenkoningin.** Votre histoire. Votre force. Votre couronne.',
				'Avec amour,'
			)
		)
	} satisfies Chapter
};

// ── Onze missie (brandbook §06) + merkwaarden (§01) ──────────────────────────────────────────────
const MISSION = {
	intro: both(
		md(
			'## Een kroon voor iedere vrouw.',
			'Bij De Sieradenkoningin geloven we dat iedere vrouw het verdient om haar eigen verhaal te schrijven.',
			'We willen meer zijn dan een juwelenmerk. We willen een plek creëren waar vrouwelijkheid, ambitie en eigenwaarde samenkomen. Waar een vrouw zichzelf iets moois mag gunnen en tegelijkertijd wordt herinnerd aan alles wat ze in zich draagt.',
			'Onze missie begint bij een eenvoudig idee: een vrouw hoeft niet te wachten tot iemand anders haar waarde ziet. Ze mag zelf kiezen voor haar dromen. Ze mag investeren in haar toekomst. Ze mag opnieuw beginnen wanneer het leven anders loopt dan verwacht.'
		),
		md(
			'## Une couronne pour chaque femme.',
			'Chez De Sieradenkoningin, nous croyons que chaque femme mérite d’écrire sa propre histoire.',
			'Nous voulons être plus qu’une marque de bijoux. Nous voulons créer un lieu où féminité, ambition et estime de soi se rencontrent. Où une femme peut s’offrir quelque chose de beau tout en se rappelant tout ce qu’elle porte en elle.',
			'Notre mission part d’une idée simple : une femme n’a pas à attendre que quelqu’un d’autre voie sa valeur. Elle peut choisir ses rêves. Elle peut investir dans son avenir. Elle peut recommencer lorsque la vie prend un autre tournant que prévu.'
		)
	),
	body: both(
		md(
			'## Vrouwen inspireren om zelfstandig te groeien',
			'Een belangrijk onderdeel van onze visie is financiële zelfstandigheid. We willen jonge meisjes en vrouwen inspireren om hun talenten te ontdekken, hun ambities serieus te nemen en te leren hoe waardevol het is om hun eigen toekomst op te bouwen.',
			'Ondernemen, leren, groeien en verantwoordelijkheid nemen voor je eigen dromen: het zijn stappen waarmee je steeds meer vertrouwen in jezelf kunt ontwikkelen.',
			'## Kleine details, een grotere betekenis',
			'Onze juwelen zijn een manier om deze boodschap tastbaar te maken. Een ring kan je herinneren aan een belofte aan jezelf. Een ketting kan een symbool zijn van een nieuwe fase. Een armband kan je eraan herinneren dat je trots mag zijn op hoe ver je bent gekomen.',
			'Niet omdat een juweel je waarde bepaalt, maar omdat de betekenis die jij eraan geeft persoonlijk kan zijn.',
			'## Samen sterker',
			'We geloven in vrouwen die elkaar aanmoedigen. In ambities die gedeeld mogen worden. In succes dat niet ten koste hoeft te gaan van een ander.'
		),
		md(
			'## Inspirer les femmes à grandir en toute indépendance',
			'Un élément essentiel de notre vision est l’indépendance financière. Nous voulons inspirer les jeunes filles et les femmes à découvrir leurs talents, à prendre leurs ambitions au sérieux et à comprendre la valeur de construire leur propre avenir.',
			'Entreprendre, apprendre, grandir et prendre la responsabilité de ses propres rêves : autant d’étapes qui permettent de gagner peu à peu confiance en soi.',
			'## Petits détails, grande signification',
			'Nos bijoux sont une manière de rendre ce message tangible. Une bague peut vous rappeler une promesse faite à vous-même. Un collier peut symboliser une nouvelle étape. Un bracelet peut vous rappeler que vous pouvez être fière du chemin parcouru.',
			'Non pas parce qu’un bijou détermine votre valeur, mais parce que le sens que vous lui donnez peut être personnel.',
			'## Plus fortes ensemble',
			'Nous croyons aux femmes qui s’encouragent. Aux ambitions qui se partagent. À une réussite qui ne se fait pas au détriment des autres.'
		)
	)
};

const VALUES: { icon: 'crown' | 'sparkle' | 'clover' | 'star' | 'users'; title: I18n; text: I18n }[] = [
	{
		icon: 'crown',
		title: both('Eigenwaarde', 'Estime de soi'),
		text: both(
			'Iedere vrouw verdient het om zich mooi, waardevol en bijzonder te voelen.',
			'Chaque femme mérite de se sentir belle, précieuse et unique.'
		)
	},
	{
		icon: 'sparkle',
		title: both('Vrouwelijkheid', 'Féminité'),
		text: both(
			'Zachte elegantie combineren met karakter en kracht.',
			'Allier une élégance douce au caractère et à la force.'
		)
	},
	{
		icon: 'clover',
		title: both('Heropbouw', 'Reconstruction'),
		text: both(
			'Je verleden hoeft je toekomst niet te bepalen; je mag opnieuw beginnen.',
			'Votre passé ne doit pas définir votre avenir ; vous pouvez recommencer.'
		)
	},
	{
		icon: 'star',
		title: both('Zelfstandigheid', 'Indépendance'),
		text: both(
			'Vrouwen en jonge meisjes inspireren om hun talenten te ontwikkelen en hun financiële toekomst op te bouwen.',
			'Inspirer les femmes et les jeunes filles à développer leurs talents et à construire leur avenir financier.'
		)
	},
	{
		icon: 'users',
		title: both('Verbondenheid', 'Solidarité'),
		text: both(
			'Vrouwen mogen elkaar aanmoedigen en samen groeien.',
			'Les femmes peuvent s’encourager et grandir ensemble.'
		)
	}
];

// ── Service pages (brandbook §09–§10) ────────────────────────────────────────────────────────────
const CARE = both(
	md(
		'## Materiaal',
		'De Sieradenkoningin biedt stijlvolle, vrouwelijke stainless-steel juwelen. De exacte specificaties — materiaal, kleur, afmetingen, sluiting en maat — verschillen per ontwerp. Je vindt ze altijd op de productpagina, onder ‘Details’.',
		'## Zo zorg je voor je juwelen',
		[
			'- Bewaar je juwelen droog en afzonderlijk, zodat ze elkaar niet kunnen krassen.',
			'- Vermijd contact met agressieve middelen, zoals schoonmaakproducten.',
			'- Doe je juwelen als laatste aan, na parfum, crème of haarproducten.',
			'- Reinig ze voorzichtig met een zachte, droge doek.',
			'- Volg altijd het onderhoudsadvies dat bij het specifieke product vermeld staat.'
		].join('\n'),
		'Heb je een vraag over een bepaald juweel? [Neem contact met ons op](/nl/contact) — we helpen je graag verder.'
	),
	md(
		'## Matières',
		'De Sieradenkoningin propose des bijoux féminins et élégants en acier inoxydable. Les caractéristiques exactes — matière, couleur, dimensions, fermoir et taille — varient selon le modèle. Vous les trouverez toujours sur la page du produit, sous « Détails ».',
		'## Prendre soin de vos bijoux',
		[
			'- Conservez vos bijoux au sec et séparément, afin qu’ils ne se rayent pas entre eux.',
			'- Évitez tout contact avec des produits agressifs, comme les produits d’entretien.',
			'- Mettez vos bijoux en dernier, après le parfum, la crème ou les produits capillaires.',
			'- Nettoyez-les délicatement avec un chiffon doux et sec.',
			'- Suivez toujours les conseils d’entretien indiqués pour chaque produit.'
		].join('\n'),
		'Une question sur un bijou en particulier ? [Contactez-nous](/fr/contact) — nous vous aidons avec plaisir.'
	)
);

const SHIPPING = both(
	md(
		'## Jouw juweel, met zorg naar jou onderweg.',
		'We willen dat jouw bestelling een fijn moment wordt, vanaf het plaatsen van je bestelling tot het openen van je pakketje. Hieronder vind je alle informatie over de verwerking, verzending en levering van jouw juwelen.',
		'**Plaatshouder** — vul de onderdelen hieronder aan met de echte voorwaarden voordat de webshop live gaat.',
		'### Verzendlanden',
		'[aan te vullen]',
		'### Verzendkosten',
		'[aan te vullen — tarief per land en eventuele drempel voor gratis verzending]',
		'### Verwerkingstijd',
		'[aan te vullen]',
		'### Vervoerder en geschatte levertijd',
		'[aan te vullen — per bestemming]',
		'### Je pakketje volgen',
		'Zodra je bestelling vertrekt, ontvang je een e-mail met een link om je zending te volgen. Je kunt je bestelling ook opvolgen via [Bestelling volgen](/nl/bestelling-volgen).',
		'### Schade of verlies',
		'[aan te vullen — wat je doet bij een beschadigd of verloren pakket, en binnen welke termijn]'
	),
	md(
		'## Votre bijou, en route vers vous avec soin.',
		'Nous voulons que votre commande soit un beau moment, du passage de la commande jusqu’à l’ouverture de votre colis. Vous trouverez ci-dessous toutes les informations sur le traitement, l’expédition et la livraison de vos bijoux.',
		'**Texte provisoire** — complétez les rubriques ci-dessous avec les conditions réelles avant le lancement de la boutique.',
		'### Pays de livraison',
		'[à compléter]',
		'### Frais de livraison',
		'[à compléter — tarif par pays et éventuel seuil de livraison gratuite]',
		'### Délai de traitement',
		'[à compléter]',
		'### Transporteur et délai de livraison estimé',
		'[à compléter — par destination]',
		'### Suivre votre colis',
		'Dès que votre commande est expédiée, vous recevez un e-mail avec un lien de suivi. Vous pouvez aussi suivre votre commande via [Suivre ma commande](/fr/suivi-commande).',
		'### Dommage ou perte',
		'[à compléter — que faire en cas de colis endommagé ou perdu, et dans quel délai]'
	)
);

const RETURNS = both(
	md(
		'## Toch niet helemaal wat je zocht?',
		'We begrijpen dat je een juweel soms anders ervaart wanneer je het thuis ontvangt. Bekijk hieronder hoe retourneren werkt, welke termijnen gelden en hoe je een retour kunt aanmelden.',
		'**Plaatshouder** — laat de definitieve retourvoorwaarden juridisch nakijken en vul ze aan voordat de webshop live gaat.',
		'### Bedenktijd',
		'Bij een online aankoop heb je als consument 14 dagen bedenktijd vanaf de dag na ontvangst. Meer uitleg en het modelformulier vind je op de pagina [Herroepingsrecht](/nl/herroeping).',
		'### Zo meld je een retour aan',
		'[aan te vullen]',
		'### Retourkosten',
		'[aan te vullen]',
		'### Terugbetaling',
		'[aan te vullen — termijn en betaalmethode]',
		'### Uitzonderingen',
		'[aan te vullen — bijvoorbeeld gepersonaliseerde of gegraveerde juwelen]'
	),
	md(
		'## Ce n’est pas tout à fait ce que vous cherchiez ?',
		'Nous comprenons qu’un bijou puisse vous sembler différent une fois reçu chez vous. Découvrez ci-dessous comment fonctionnent les retours, quels délais s’appliquent et comment signaler un retour.',
		'**Texte provisoire** — faites vérifier juridiquement les conditions de retour définitives et complétez-les avant le lancement de la boutique.',
		'### Délai de rétractation',
		'Pour un achat en ligne, vous disposez en tant que consommatrice d’un délai de rétractation de 14 jours à compter du lendemain de la réception. Plus d’informations et le formulaire type sur la page [Droit de rétractation](/fr/retractation).',
		'### Signaler un retour',
		'[à compléter]',
		'### Frais de retour',
		'[à compléter]',
		'### Remboursement',
		'[à compléter — délai et mode de paiement]',
		'### Exceptions',
		'[à compléter — par exemple les bijoux personnalisés ou gravés]'
	)
);

export function pageSeeds(
	heroKey: string,
	editorialKey: string,
	storyKeys: readonly [string, string] = [editorialKey, editorialKey]
): PageSeed[] {
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
						overline: both('Wear your crown', 'Wear your crown'),
						title: both('Jouw verhaal. Jouw kracht. Jouw kroon.', 'Votre histoire. Votre force. Votre couronne.'),
						lead: both(
							'Ontdek juwelen die jouw persoonlijke stijl vieren en je eraan herinneren om ook voor jezelf te kiezen.',
							'Découvrez des bijoux qui célèbrent votre style et vous rappellent de vous choisir, vous aussi.'
						),
						image: { key: heroKey, alt: both('DEMO sfeerbeeld', 'DEMO image d’ambiance'), width: 2400, height: 1600 },
						cta: { label: both('Ontdek de collectie', 'Découvrir la collection'), href: LINKS.all },
						secondaryCta: { label: both('Ons verhaal', 'Notre histoire'), href: LINKS.story }
					}
				},
				{
					type: 'category_strip',
					data: {
						eyebrow: both('Shop per categorie', 'Par catégorie'),
						title: both('Vind jouw juweel', 'Trouvez votre bijou')
					}
				},
				{
					type: 'product_rail',
					data: {
						// “Bestsellers” only once real sales data supports it (brandbook §04/§07).
						eyebrow: both('Zorgvuldig gekozen', 'Sélectionnés avec soin'),
						title: both('Onze favorieten', 'Nos favoris'),
						source: 'featured',
						limit: 8,
						cta: { label: both('Bekijk alle favorieten', 'Voir tous nos favoris'), href: LINKS.favorites }
					}
				},
				{
					type: 'editorial_split',
					data: {
						eyebrow: both('Ons verhaal', 'Notre histoire'),
						title: both(
							'Een kroon draag je niet alleen op mooie dagen',
							'Une couronne ne se porte pas seulement les beaux jours'
						),
						body: both(
							md(
								'Mijn naam is Zahra. Ik ben mama, ondernemer en een vrouw met dromen. Ik heb geleerd dat een nieuw begin soms ontstaat op een moment waarop je het leven helemaal anders had voorgesteld.',
								'De Sieradenkoningin is een stukje van die nieuwe start: een merk dat is ontstaan uit mijn liefde voor juwelen, mijn creativiteit en mijn verlangen om iets op te bouwen dat groter is dan alleen een product.',
								'*Liefs, Zahra*'
							),
							md(
								'Je m’appelle Zahra. Je suis maman, entrepreneuse et une femme qui a des rêves. J’ai appris qu’un nouveau départ naît parfois au moment où l’on avait imaginé sa vie tout autrement.',
								'De Sieradenkoningin est une part de ce nouveau départ : une marque née de mon amour pour les bijoux, de ma créativité et de mon envie de bâtir quelque chose de plus grand qu’un simple produit.',
								'*Avec amour, Zahra*'
							)
						),
						image: {
							key: editorialKey,
							alt: both('DEMO editoriaal beeld', 'DEMO image éditoriale'),
							width: 1600,
							height: 2000
						},
						cta: { label: both('Lees mijn verhaal', 'Lire mon histoire'), href: LINKS.story },
						reverse: false
					}
				},
				{
					type: 'feature_grid',
					data: {
						eyebrow: both('Waarom De Sieradenkoningin', 'Pourquoi De Sieradenkoningin'),
						title: both('Kleine details. Een groot gevoel.', 'Petits détails. Grand effet.'),
						items: [
							{
								icon: 'crown',
								title: both('Tijdloze stijl', 'Un style intemporel'),
								text: both(
									'Juwelen met een elegante, vrouwelijke uitstraling die je seizoen na seizoen opnieuw combineert.',
									'Des bijoux à l’allure élégante et féminine, que vous combinez saison après saison.'
								)
							},
							{
								icon: 'sparkle',
								title: both('Dagelijkse elegantie', 'L’élégance au quotidien'),
								text: both(
									'Verfijnde details die je outfit afmaken, op gewone dagen en op bijzondere momenten.',
									'Des détails raffinés qui complètent votre tenue, les jours ordinaires comme les moments particuliers.'
								)
							},
							{
								icon: 'check',
								title: both('Zorgvuldige selectie', 'Une sélection soignée'),
								text: both(
									'Elk juweel wordt met aandacht gekozen. Materiaal, afmetingen en specificaties vind je duidelijk per product.',
									'Chaque bijou est choisi avec attention. Matière, dimensions et caractéristiques sont clairement indiquées pour chaque produit.'
								)
							},
							{
								icon: 'heart',
								title: both('Een merk met betekenis', 'Une marque qui a du sens'),
								text: both(
									'Ontstaan uit een persoonlijk verhaal over heropbouw, eigenwaarde en financiële zelfstandigheid.',
									'Née d’une histoire personnelle de reconstruction, d’estime de soi et d’indépendance financière.'
								)
							}
						]
					}
				},
				{
					type: 'quote_band',
					data: {
						quote: both('Een kroon wacht niet op toestemming.', 'Une couronne n’attend pas la permission.'),
						surface: 'inverse'
					}
				},
				{
					// Community (brandbook §04/§14): only real content with the customer's permission. Hidden
					// until the owner adds the Instagram link and approved photos.
					type: 'rich_text',
					hidden: true,
					data: {
						title: both('#MijnKroonMijnVerhaal', '#MijnKroonMijnVerhaal'),
						body: both(
							'Deel hoe jij je kroon draagt met **#MijnKroonMijnVerhaal**. We tonen hier alleen foto’s waarvoor we jouw toestemming kregen.',
							'Partagez votre façon de porter votre couronne avec **#MijnKroonMijnVerhaal**. Nous ne publions ici que les photos pour lesquelles vous nous avez donné votre accord.'
						)
					}
				},
				{
					type: 'newsletter',
					data: {
						title: both('Kies jezelf, iedere dag opnieuw', 'Choisissez-vous, chaque jour à nouveau'),
						text: both(
							'Nieuwe collecties, stylingtips en verhalen die je eraan herinneren wie je bent.',
							'Nouvelles collections, conseils de style et histoires qui vous rappellent qui vous êtes.'
						)
					}
				}
			]
		},
		{
			key: 'story',
			type: 'page',
			slugs: { nl: 'ons-verhaal', fr: 'notre-histoire' },
			title: both('Ons verhaal', 'Notre histoire'),
			seo: {
				description: both(
					'Het verhaal van Zahra, oprichtster van De Sieradenkoningin: over heropbouw, eigenwaarde en de kracht van een nieuwe start.',
					'L’histoire de Zahra, fondatrice de De Sieradenkoningin : reconstruction, estime de soi et la force d’un nouveau départ.'
				)
			},
			blocks: [
				{
					type: 'editorial_split',
					data: {
						eyebrow: both('Zahra, oprichtster', 'Zahra, fondatrice'),
						title: both(
							'Een kroon draag je niet alleen op mooie dagen.',
							'Une couronne ne se porte pas seulement les beaux jours.'
						),
						body: STORY.intro,
						image: {
							key: storyKeys[0],
							alt: both('DEMO sfeerbeeld', 'DEMO image d’ambiance'),
							width: 1600,
							height: 2000
						},
						reverse: false
					}
				},
				{ type: 'rich_text', data: STORY.strength },
				{
					type: 'quote_band',
					data: {
						quote: both(
							'Jezelf opnieuw opbouwen is geen teken van zwakte. Het is een vorm van kracht.',
							'Se reconstruire n’est pas un signe de faiblesse. C’est une forme de force.'
						),
						surface: 'inverse'
					}
				},
				{ type: 'rich_text', data: STORY.dream },
				{
					type: 'editorial_split',
					data: {
						...STORY.jewelry,
						image: {
							key: storyKeys[1],
							alt: both('DEMO sfeerbeeld', 'DEMO image d’ambiance'),
							width: 1600,
							height: 2000
						},
						reverse: true
					}
				},
				{ type: 'rich_text', data: STORY.crown },
				{
					type: 'quote_band',
					data: {
						quote: both('Jij mag je eigen kroon dragen.', 'Vous pouvez porter votre propre couronne.'),
						surface: 'espresso'
					}
				},
				{
					type: 'rich_text',
					data: { ...STORY.more, cta: { label: both('Lees onze missie', 'Lire notre mission'), href: LINKS.mission } }
				},
				{
					type: 'rich_text',
					data: {
						...STORY.reminder,
						signature: both('Zahra', 'Zahra'),
						signatureNote: both('Oprichtster van De Sieradenkoningin', 'Fondatrice de De Sieradenkoningin'),
						cta: { label: both('Ontdek de collectie', 'Découvrir la collection'), href: LINKS.all }
					}
				}
			]
		},
		{
			key: 'mission',
			type: 'page',
			slugs: { nl: 'onze-missie', fr: 'notre-mission' },
			title: both('Onze missie', 'Notre mission'),
			seo: {
				description: both(
					'De Sieradenkoningin brengt luxe en vrouwelijk empowerment samen: eigenwaarde, heropbouw, zelfstandigheid en verbondenheid.',
					'De Sieradenkoningin réunit luxe et empowerment féminin : estime de soi, reconstruction, indépendance et solidarité.'
				)
			},
			blocks: [
				{ type: 'rich_text', data: { body: MISSION.intro } },
				{
					type: 'feature_grid',
					data: {
						eyebrow: both('Onze merkwaarden', 'Nos valeurs'),
						title: both('Waar we voor staan', 'Ce qui nous anime'),
						items: VALUES
					}
				},
				{ type: 'rich_text', data: { body: MISSION.body } },
				{
					type: 'quote_band',
					data: {
						quote: both(
							'Jouw verhaal verdient ruimte. Jouw dromen verdienen aandacht. En jouw toekomst mag van jou zijn.',
							'Votre histoire mérite de l’espace. Vos rêves méritent de l’attention. Et votre avenir peut vous appartenir.'
						),
						surface: 'inverse'
					}
				}
			]
		},
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
		{
			key: 'care',
			type: 'page',
			slugs: { nl: 'materiaal-en-onderhoud', fr: 'matieres-et-entretien' },
			title: both('Materiaal & onderhoud', 'Matières & entretien'),
			blocks: [{ type: 'rich_text', data: { body: CARE } }]
		},
		{
			key: 'shipping',
			type: 'page',
			slugs: { nl: 'verzending', fr: 'livraison' },
			title: both('Verzending & levering', 'Livraison'),
			blocks: [{ type: 'rich_text', data: { body: SHIPPING } }]
		},
		{
			key: 'returns',
			type: 'page',
			slugs: { nl: 'retourneren', fr: 'retours' },
			title: both('Retourneren', 'Retours'),
			blocks: [{ type: 'rich_text', data: { body: RETURNS } }]
		},
		...(
			[
				['terms', 'voorwaarden', 'conditions', 'Algemene voorwaarden', 'Conditions générales'],
				['privacy', 'privacy', 'confidentialite', 'Privacybeleid', 'Politique de confidentialité'],
				['cookies', 'cookies', 'cookies', 'Cookiebeleid', 'Politique en matière de cookies'],
				['withdrawal', 'herroeping', 'retractation', 'Herroepingsrecht', 'Droit de rétractation'],
				['legal-notice', 'wettelijke-vermeldingen', 'mentions-legales', 'Bedrijfsgegevens', 'Mentions légales'],
				[
					'accessibility',
					'toegankelijkheid',
					'accessibilite',
					'Toegankelijkheidsverklaring',
					"Déclaration d'accessibilité"
				]
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

/** FAQ (brandbook §09). Answers point to the per-product specs instead of making general claims. */
export const FAQ_SEED: { group: string; question: I18n; answer: I18n }[] = [
	{
		group: 'products',
		question: both('Van welk materiaal zijn de juwelen gemaakt?', 'En quelle matière sont les bijoux ?'),
		answer: both(
			'Onze collectie bestaat uit stijlvolle stainless-steel juwelen. Omdat afwerking en details per ontwerp verschillen, vermelden we de exacte materiaalspecificaties altijd op de productpagina van elk juweel, onder ‘Details’.',
			'Notre collection se compose de bijoux élégants en acier inoxydable. Comme les finitions et les détails varient selon le modèle, nous indiquons toujours les caractéristiques exactes de la matière sur la page de chaque bijou, sous « Détails ».'
		)
	},
	{
		group: 'products',
		question: both('Zijn de juwelen waterbestendig?', 'Les bijoux résistent-ils à l’eau ?'),
		answer: both(
			'Dat verschilt per juweel. Bekijk de specificaties en het onderhoudsadvies op de productpagina van het juweel dat je op het oog hebt. Twijfel je? [Neem contact met ons op](/nl/contact), dan helpen we je graag verder.',
			'Cela dépend du bijou. Consultez les caractéristiques et les conseils d’entretien sur la page du bijou qui vous intéresse. Un doute ? [Contactez-nous](/fr/contact), nous vous aidons avec plaisir.'
		)
	},
	{
		group: 'products',
		question: both('Hoe onderhoud ik mijn juwelen?', 'Comment entretenir mes bijoux ?'),
		answer: both(
			'Bewaar je juwelen droog en afzonderlijk, vermijd agressieve middelen en volg het onderhoudsadvies dat bij elk product staat. Meer tips lees je op onze pagina [Materiaal & onderhoud](/nl/materiaal-en-onderhoud).',
			'Conservez vos bijoux au sec et séparément, évitez les produits agressifs et suivez les conseils d’entretien indiqués pour chaque produit. Plus de conseils sur notre page [Matières & entretien](/fr/matieres-et-entretien).'
		)
	},
	{
		group: 'shipping',
		question: both('Wanneer wordt mijn bestelling geleverd?', 'Quand ma commande sera-t-elle livrée ?'),
		answer: both(
			'Op onze pagina [Verzending & levering](/nl/verzending) vind je de verwerkingstijd, de vervoerder en de geschatte levertijd per bestemming. Zodra je bestelling vertrekt, ontvang je een e-mail met een link om je pakketje te volgen.',
			'Sur notre page [Livraison](/fr/livraison), vous trouverez le délai de traitement, le transporteur et le délai de livraison estimé par destination. Dès que votre commande est expédiée, vous recevez un e-mail avec un lien de suivi.'
		)
	},
	{
		group: 'returns',
		question: both('Kan ik mijn bestelling retourneren?', 'Puis-je retourner ma commande ?'),
		answer: both(
			'Ja. Bij een online aankoop heb je 14 dagen bedenktijd vanaf de dag na ontvangst. Hoe retourneren werkt, welke voorwaarden en uitzonderingen gelden en hoe je een retour aanmeldt, lees je op onze pagina [Retourneren](/nl/retourneren).',
			'Oui. Pour un achat en ligne, vous disposez d’un délai de rétractation de 14 jours à compter du lendemain de la réception. La procédure, les conditions et les exceptions sont expliquées sur notre page [Retours](/fr/retours).'
		)
	},
	{
		group: 'general',
		question: both('Hoe kan ik contact opnemen?', 'Comment vous contacter ?'),
		answer: both(
			'Via ons [contactformulier](/nl/contact) of per e-mail. Gaat je vraag over een bestelling? Vermeld dan je bestelnummer (bijvoorbeeld SK-2026-000123) — dat vind je in je bestelbevestiging.',
			'Via notre [formulaire de contact](/fr/contact) ou par e-mail. Votre question concerne une commande ? Indiquez votre numéro de commande (par exemple SK-2026-000123) — vous le trouverez dans votre confirmation de commande.'
		)
	}
];

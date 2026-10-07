/**
 * Icon registry — fine line-art (24×24, stroke-based, rendered at 1.25px).
 * Brand ornaments (crown, clover, sparkle) are original simplified drawings in
 * the board's style; swap in the designer's final SVG paths when available —
 * the API stays the same.
 */
import { categoryIcons, type CategoryIconName } from './category-icons.ts';
export { categoryIcons };

export const icons = {
	// ── Brand ornaments ────────────────────────────────────────────────
	crown:
		'<path d="M4 18h16"/><path d="M4.5 18 3.5 8.5l4.5 3.8L12 5l4 7.3 4.5-3.8-1 9.5"/><circle cx="3.5" cy="7.6" r=".9"/><circle cx="12" cy="4" r=".9"/><circle cx="20.5" cy="7.6" r=".9"/><circle cx="12" cy="14.6" r=".8"/>',
	clover:
		'<path d="M9.5 9.5a3.54 3.54 0 1 1 5 0 3.54 3.54 0 1 1 0 5 3.54 3.54 0 1 1-5 0 3.54 3.54 0 1 1 0-5Z"/><path d="M14.5 14.5c1.2 2.4 2.8 4 5 4.8"/>',
	sparkle: '<path d="M12 3c.5 6 3 8.5 9 9-6 .5-8.5 3-9 9-.5-6-3-8.5-9-9 6-.5 8.5-3 9-9Z"/>',

	// ── Categories → see category-icons.ts (HD, 64-unit grid) ──────────

	// ── Storefront UI ──────────────────────────────────────────────────
	bag: '<path d="M5 8h14l-1 12.5H6Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
	search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
	user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/>',
	heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/>',
	menu: '<path d="M3.5 7h17M3.5 12h17M3.5 17h11"/>',
	close: '<path d="m5.5 5.5 13 13M18.5 5.5l-13 13"/>',
	plus: '<path d="M12 5v14M5 12h14"/>',
	minus: '<path d="M5 12h14"/>',
	'chevron-right': '<path d="m9 5 7 7-7 7"/>',
	'chevron-left': '<path d="m15 5-7 7 7 7"/>',
	'chevron-down': '<path d="m5 9 7 7 7-7"/>',
	'arrow-right': '<path d="M4 12h16M14 6l6 6-6 6"/>',
	truck: '<path d="M2.5 6.5h11v9h-11ZM13.5 9.5h4l3 3v3h-7"/><circle cx="6.5" cy="17.5" r="1.7"/><circle cx="17" cy="17.5" r="1.7"/>',
	gift: '<path d="M4 10h16v10H4ZM3 7h18v3H3ZM12 7v13"/><path d="M12 7C10 3 7 4 8 6.5c.4.8 2 .5 4 .5 2 0 3.6.3 4-.5C17 4 14 3 12 7Z"/>',

	// ── Admin UI ───────────────────────────────────────────────────────
	dashboard: '<path d="M3.5 3.5h7v9h-7ZM13.5 3.5h7v5h-7ZM13.5 11.5h7v9h-7ZM3.5 15.5h7v5h-7Z"/>',
	box: '<path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9Z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
	receipt: '<path d="M5.5 3h13v18l-2.2-1.5-2.1 1.5-2.2-1.5-2.2 1.5-2.1-1.5L5.5 21Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
	users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.2-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.7 3 2.4 3.5 5.2"/>',
	tag: '<path d="M3.5 12.5V3.5h9l8 8-9 9Z"/><circle cx="8" cy="8" r="1.4"/>',
	image: '<path d="M3.5 4.5h17v15h-17Z"/><circle cx="9" cy="9.5" r="1.8"/><path d="m3.5 17 5-5 4 4 3-3 5 5"/>',
	upload: '<path d="M12 15.5V4M7 8.5l5-5 5 5"/><path d="M4 15v4.5h16V15"/>',
	trash: '<path d="M4 6.5h16M9.5 6.5V4h5v2.5M6 6.5l1 14h10l1-14"/>',
	edit: '<path d="M4 20h4L19.5 8.5l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',
	grip: '<circle cx="9" cy="6" r=".8"/><circle cx="15" cy="6" r=".8"/><circle cx="9" cy="12" r=".8"/><circle cx="15" cy="12" r=".8"/><circle cx="9" cy="18" r=".8"/><circle cx="15" cy="18" r=".8"/>',
	settings:
		'<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
	logout: '<path d="M14 4H4.5v16H14M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5"/>',
	'sort-asc': '<path d="m8 10 4-4 4 4"/>',
	'sort-desc': '<path d="m8 14 4 4 4-4"/>',
	sort: '<path d="m8 10 4-4 4 4M8 14l4 4 4-4"/>',
	check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
	alert: '<path d="M12 3.5 21.5 20h-19Z"/><path d="M12 10v4.5M12 17.2v.1"/>',
	'trend-up': '<path d="m3.5 17 6-6 4 4 7-7.5M15 7.5h5.5V13"/>',
	'trend-down': '<path d="m3.5 7 6 6 4-4 7 7.5M15 16.5h5.5V11"/>',

	// ── Added for primitives, storefront and admin pages ──────────────
	eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
	'eye-off': '<path d="M4 4l16 16"/><path d="M9.9 6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.9 3.7M6.3 7.6C3.9 9.3 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
	filter: '<path d="M4 6.5h16M7 12h10M10 17.5h4"/>',
	mail: '<path d="M3.5 5.5h17v13h-17Z"/><path d="m3.5 6 8.5 7 8.5-7"/>',
	phone: '<path d="M6.5 3.5h3l1.5 4.5-2 1.3a11 11 0 0 0 5.7 5.7l1.3-2 4.5 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z"/>',
	'map-pin': '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/>',
	info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.1"/>',
	external: '<path d="M13.5 4.5h6v6M19.5 4.5 11 13M17 13.5v6H4.5V7h6"/>',
	download: '<path d="M12 4v11.5M7 10.5l5 5 5-5"/><path d="M4 15v4.5h16V15"/>',
	printer: '<path d="M6.5 9V3.5h11V9M6.5 17h-3V9h17v8h-3"/><path d="M6.5 14h11v6.5h-11Z"/>',
	refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3L19.5 9"/><path d="M19.5 4v5h-5"/>',
	lock: '<path d="M5.5 10.5h13v10h-13Z"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
	star: '<path d="m12 3.5 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7Z"/>',
	copy: '<path d="M8.5 8.5h11v11h-11Z"/><path d="M15.5 8.5V4.5h-11v11h4"/>',
	calendar: '<path d="M4 6h16v14H4ZM4 10h16M8.5 3.5V8M15.5 3.5V8"/>',
	clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
	globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.6 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.6-3.5-8.5s1-5.9 3.5-8.5Z"/>',
	shield: '<path d="M12 3.5 19.5 6v6c0 4.5-3.2 7.5-7.5 8.5-4.3-1-7.5-4-7.5-8.5V6Z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
	return: '<path d="M9 9.5 4.5 14 9 18.5"/><path d="M4.5 14h11a4 4 0 0 0 0-8H11"/>',
	layers: '<path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8Z"/><path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5"/>',
	file: '<path d="M6 3.5h8l4 4v13H6Z"/><path d="M14 3.5v4h4M9 12h6M9 16h6"/>',
	collection: '<path d="M4 4.5h7v7H4ZM13 4.5h7v7h-7ZM4 13.5h7v7H4ZM13 13.5h7v7h-7Z"/>',
	percent: '<path d="M18.5 5.5l-13 13"/><circle cx="7" cy="7" r="2.2"/><circle cx="17" cy="17" r="2.2"/>',
	chart: '<path d="M4 20V4M4 20h16.5"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
	history: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5M12 8v4l3 2"/>',
	import: '<path d="M12 3.5V14M7.5 9.5 12 14l4.5-4.5"/><path d="M4 14.5v5h16v-5"/>',
	inventory: '<path d="M3.5 7.5 12 3.5l8.5 4v9l-8.5 4-8.5-4Z"/><path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9M7.5 5.5l8.5 4"/>',
	'menu-list': '<path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11M4.5 6.5h.1M4.5 12h.1M4.5 17.5h.1"/>',
	question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.6M12 16.6v.1"/>',
	link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>',
	'arrow-up': '<path d="M12 20V4M6 10l6-6 6 6"/>',
	'arrow-down': '<path d="M12 4v16M6 14l6 6 6-6"/>',
	'arrow-left': '<path d="M20 12H4M10 6l-6 6 6 6"/>',
	monitor: '<path d="M3.5 4.5h17v11h-17ZM9 19.5h6M12 15.5v4"/>',
	smartphone: '<path d="M7 3h10v18H7ZM11 18h2"/>'
} as const;


export type UiIconName = keyof typeof icons;
export type IconName = UiIconName | CategoryIconName;

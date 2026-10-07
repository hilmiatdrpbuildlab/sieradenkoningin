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
	'trend-down': '<path d="m3.5 7 6 6 4-4 7 7.5M15 16.5h5.5V11"/>'
} as const;


export type UiIconName = keyof typeof icons;
export type IconName = UiIconName | CategoryIconName;

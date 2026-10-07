/**
 * Cart state — Svelte 5 runes in a class.
 * IMPORTANT (SSR on Cloudflare): never create module-level mutable state that is
 * shared between requests. We create ONE instance per page load and expose it
 * via context (setCartContext in +layout.svelte, getCart() in components).
 * The server is the source of truth (cart row in Postgres keyed by a cookie);
 * this store is an optimistic client mirror.
 */
import { getContext, setContext } from 'svelte';

export interface CartLine {
	id: string; // cart_line id
	variantId: string;
	slug: string;
	name: string;
	variantLabel?: string; // "Goud · maat 54"
	image: string;
	unitPrice: number; // cents, VAT incl.
	quantity: number;
	maxQuantity: number; // stock cap
}

export class Cart {
	lines = $state<CartLine[]>([]);
	open = $state(false);
	pending = $state(false);

	count = $derived(this.lines.reduce((n, l) => n + l.quantity, 0));
	subtotal = $derived(this.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0));

	/** Free shipping threshold (cents) — drives the progress bar in the drawer. */
	freeShippingFrom = 5000;
	toFreeShipping = $derived(Math.max(0, this.freeShippingFrom - this.subtotal));

	constructor(initial: CartLine[] = []) {
		this.lines = initial;
	}

	async setQuantity(lineId: string, quantity: number) {
		const line = this.lines.find((l) => l.id === lineId);
		if (!line) return;
		const previous = line.quantity;
		line.quantity = Math.max(0, Math.min(quantity, line.maxQuantity));
		if (line.quantity === 0) this.lines = this.lines.filter((l) => l.id !== lineId);
		try {
			this.pending = true;
			const res = await fetch('/api/cart', {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ lineId, quantity })
			});
			if (!res.ok) throw new Error();
			this.lines = ((await res.json()) as { lines: CartLine[] }).lines;
		} catch {
			line.quantity = previous; // rollback
			if (!this.lines.includes(line)) this.lines = [...this.lines, line];
		} finally {
			this.pending = false;
		}
	}

	remove(lineId: string) {
		return this.setQuantity(lineId, 0);
	}
}

const KEY = Symbol('cart');
export const setCartContext = (initial: CartLine[]) => setContext(KEY, new Cart(initial));
export const getCart = () => getContext<Cart>(KEY);

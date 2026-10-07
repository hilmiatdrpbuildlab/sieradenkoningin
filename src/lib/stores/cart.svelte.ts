/**
 * Cart state — Svelte 5 runes in a class, one instance per page load exposed via context
 * (never module-level: on Workers modules are shared between requests).
 * The server is the source of truth (/api/cart returns the full CartView); this store applies
 * optimistic updates and rolls back on failure.
 */
import { getContext, setContext } from 'svelte';
import type { CartView, CartLineView } from '#lib/types.ts';

export type { CartView, CartLineView };

export type CartError = 'unavailable' | 'not_found' | 'network' | 'invalid' | string;

export class Cart {
	view = $state<CartView>() as CartView;
	open = $state(false);
	pending = $state(false);
	lang: 'nl' | 'fr';

	lines = $derived(this.view.lines);
	count = $derived(this.view.count);
	subtotal = $derived(this.view.subtotal);
	toFreeShipping = $derived(this.view.toFreeShipping);
	freeShippingFrom = $derived(this.view.freeShippingFrom);

	constructor(initial: CartView, lang: 'nl' | 'fr') {
		this.view = initial;
		this.lang = lang;
	}

	/** Replace state from the server (after invalidation / navigation). */
	sync(view: CartView) {
		this.view = view;
	}

	async #call(method: string, body?: unknown, query = ''): Promise<{ ok: boolean; data: CartView & Record<string, unknown> }> {
		this.pending = true;
		try {
			const res = await fetch(`/api/cart?lang=${this.lang}${query}`, {
				method,
				headers: body ? { 'content-type': 'application/json' } : undefined,
				body: body ? JSON.stringify(body) : undefined
			});
			const data = await res.json();
			if (data?.lines) this.view = data;
			return { ok: res.ok, data };
		} catch {
			return { ok: false, data: { ...this.view, error: 'network' } };
		} finally {
			this.pending = false;
		}
	}

	async add(variantId: string, qty = 1, opts: { giftWrap?: boolean; openDrawer?: boolean } = {}) {
		const r = await this.#call('POST', { variantId, qty, giftWrap: opts.giftWrap });
		if (r.ok && opts.openDrawer !== false) this.open = true;
		return { ok: r.ok, error: (r.data.error as CartError) ?? null, capped: !!r.data.capped, line: r.data.lines?.find((l) => l.variantId === variantId) };
	}

	async setQuantity(lineId: string, quantity: number) {
		const before = this.view;
		const line = before.lines.find((l) => l.id === lineId);
		if (!line) return;
		const q = Math.max(0, Math.min(quantity, line.maxQuantity));
		// optimistic
		const lines = q === 0 ? before.lines.filter((l) => l.id !== lineId) : before.lines.map((l) => (l.id === lineId ? { ...l, quantity: q } : l));
		this.view = { ...before, lines, count: lines.reduce((n, l) => n + l.quantity, 0), subtotal: lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0) };
		const r = await this.#call('PATCH', { lineId, qty: q });
		if (!r.ok) this.view = before; // rollback
	}

	remove(lineId: string) {
		return this.setQuantity(lineId, 0);
	}

	async setGiftWrap(lineId: string, giftWrap: boolean) {
		await this.#call('PATCH', { lineId, giftWrap });
	}

	async applyCode(code: string) {
		const r = await this.#call('PUT', { code });
		return { ok: r.ok, error: (r.data.codeError as string) ?? null, minSubtotal: (r.data.minSubtotal as number | null) ?? null };
	}

	async removeCode() {
		await this.#call('DELETE', undefined, '&code');
	}
}

const KEY = Symbol('cart');
export const setCartContext = (initial: CartView, lang: 'nl' | 'fr') => setContext(KEY, new Cart(initial, lang));
export const getCart = () => getContext<Cart>(KEY);

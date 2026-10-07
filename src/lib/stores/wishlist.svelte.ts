/** Wishlist ids — one store per page load via context; hearts stay consistent across components. */
import { getContext, setContext } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';

export class Wishlist {
	ids = new SvelteSet<string>();
	loaded = $state(false);

	has = (productId: string) => this.ids.has(productId);

	async load() {
		try {
			const res = await fetch('/api/wishlist');
			if (res.ok) {
				const { ids } = (await res.json()) as { ids: string[] };
				this.ids.clear();
				for (const id of ids) this.ids.add(id);
			}
		} finally {
			this.loaded = true;
		}
	}

	async toggle(productId: string): Promise<boolean> {
		const want = !this.ids.has(productId);
		if (want) this.ids.add(productId);
		else this.ids.delete(productId);
		try {
			const res = await fetch('/api/wishlist', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ productId, on: want })
			});
			if (!res.ok) throw new Error();
		} catch {
			if (want) this.ids.delete(productId);
			else this.ids.add(productId);
		}
		return this.ids.has(productId);
	}
}

const KEY = Symbol('wishlist');
export const setWishlistContext = () => setContext(KEY, new Wishlist());
export const getWishlist = () => getContext<Wishlist>(KEY);

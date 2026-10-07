/**
 * Toast notifications — one store per page load, provided through context (no module state; §2.2).
 * toast.push({ message: m.cart_added(), image, kind: 'success' })
 */
import { getContext, setContext } from 'svelte';

export interface ToastItem {
	id: number;
	message: string;
	kind: 'success' | 'error' | 'info';
	image?: string;
	action?: { label: string; href?: string; onclick?: () => void };
	duration: number;
}

export class Toasts {
	items = $state<ToastItem[]>([]);
	#next = 1;

	push(t: Partial<Omit<ToastItem, 'id'>> & { message: string }) {
		const item: ToastItem = { kind: 'success', duration: 4500, ...t, id: this.#next++ };
		this.items = [...this.items.slice(-2), item];
		if (item.duration > 0) setTimeout(() => this.dismiss(item.id), item.duration);
		return item.id;
	}

	dismiss(id: number) {
		this.items = this.items.filter((t) => t.id !== id);
	}
}

const KEY = Symbol('toasts');
export const setToastContext = () => setContext(KEY, new Toasts());
export const getToasts = () => getContext<Toasts>(KEY);

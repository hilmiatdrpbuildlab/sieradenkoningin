<!--
  @component RecentlyViewed — remembers viewed product ids in localStorage (`sk_recent`, max 12) and
  shows the others as a rail. Cards (current prices + stock) come from /api/search?ids=…
  Storage access is wrapped in try/catch (private mode, blocked storage).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import ProductRail from './ProductRail.svelte';
	import type { ProductCardData } from '#lib/types.ts';
	import type { Lang } from '#lib/i18n/paths.ts';
	import { m } from '#lib/paraglide/messages.js';

	let { productId, lang }: { productId: string; lang: Lang } = $props();
	const KEY = 'sk_recent';
	const MAX = 12;
	let products = $state<ProductCardData[]>([]);

	function read(): string[] {
		try {
			const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
			return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/.test(x)) : [];
		} catch {
			return [];
		}
	}

	onMount(() => {
		const before = read().filter((id) => id !== productId);
		try {
			localStorage.setItem(KEY, JSON.stringify([productId, ...before].slice(0, MAX)));
		} catch {
			/* storage unavailable — the rail simply stays empty */
		}
		const ids = before.slice(0, 8);
		if (!ids.length) return;
		const ctrl = new AbortController();
		fetch(`/api/search?lang=${lang}&ids=${ids.join(',')}`, { signal: ctrl.signal })
			.then((r) => (r.ok ? r.json() : null))
			.then((d: { products?: ProductCardData[] } | null) => (products = d?.products ?? []))
			.catch(() => {});
		return () => ctrl.abort();
	});
</script>

<ProductRail title={m.pdp_recent()} {products} />

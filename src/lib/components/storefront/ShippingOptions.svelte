<!--
  @component ShippingOptions — home delivery vs. pickup point (bpost via the shipping adapter).
  The pickup picker is a postal-code search + radio list. With JS the search calls
  /api/service-points; without JS the search button submits the form to `?/servicePoints`.
-->
<script lang="ts">
	import Radio from '#lib/components/ui/Radio.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { formatPrice } from '#lib/utils/format.ts';
	import { checkoutError, fieldId } from './checkout-errors.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Point {
		id: string;
		name: string;
		street: string;
		postalCode: string;
		city: string;
	}
	interface Props {
		method: 'home' | 'pickup';
		prices: { home: { shipping: number; available: boolean }; pickup: { shipping: number; available: boolean } };
		lang: 'nl' | 'fr';
		country: string;
		postalCode: string;
		points?: Point[];
		selectedPoint?: string;
		searched?: boolean;
		errors: Record<string, string[]>;
	}
	let {
		method = $bindable(),
		prices,
		lang,
		country,
		postalCode,
		points: initialPoints = [],
		selectedPoint = '',
		searched: initialSearched = false,
		errors
	}: Props = $props();

	// svelte-ignore state_referenced_locally
	let points = $state<Point[]>(initialPoints);
	// svelte-ignore state_referenced_locally
	let searched = $state(initialSearched);
	// svelte-ignore state_referenced_locally
	let query = $state(postalCode);
	// svelte-ignore state_referenced_locally
	let point = $state(selectedPoint);
	let loading = $state(false);
	let searchError = $state<string | null>(null);

	const price = (p: { shipping: number }) =>
		p.shipping === 0 ? m.cart_shipping_free() : formatPrice(p.shipping, lang);
	const options = $derived([
		{
			value: 'home',
			label: m.checkout_method_home(),
			description: m.checkout_method_home_hint(),
			meta: price(prices.home),
			disabled: !prices.home.available
		},
		{
			value: 'pickup',
			label: m.checkout_method_pickup(),
			description: m.checkout_method_pickup_hint(),
			meta: price(prices.pickup),
			disabled: !prices.pickup.available
		}
	]);
	const err = (k: string) => (errors[k]?.[0] ? checkoutError(errors[k][0]) : null);

	async function search(e: MouseEvent) {
		e.preventDefault();
		if (!/^[A-Za-z0-9 -]{4,10}$/.test(query.trim())) {
			searchError = m.checkout_error_postal();
			return;
		}
		loading = true;
		searchError = null;
		try {
			const res = await fetch(`/api/service-points?postalCode=${encodeURIComponent(query.trim())}&country=${country}`);
			const json = (await res.json()) as { points: Point[] };
			points = json.points ?? [];
			searched = true;
			if (!res.ok) searchError = m.checkout_pickup_unavailable();
		} catch {
			searchError = m.checkout_pickup_unavailable();
		} finally {
			loading = false;
		}
	}
</script>

<div class="wrap" class:is-pickup={method === 'pickup'}>
	<Radio
		name="shippingMethod"
		legend={m.checkout_shipping_title()}
		hideLegend
		variant="card"
		{options}
		bind:value={method}
		error={err('shippingMethod')}
	/>

	<!-- Always rendered; shown by CSS when "pickup" is checked, so the picker also works without JS. -->
	<div class="pickup">
		<div class="search">
			<label for={fieldId('spPostalCode')} class="lbl">{m.checkout_pickup_search_label()}</label>
			<div class="row">
				<input
					id={fieldId('spPostalCode')}
					name="spPostalCode"
					bind:value={query}
					inputmode="numeric"
					autocomplete="off"
					maxlength={12}
					aria-describedby={searchError || err('spPostalCode') ? 'sp-search-err' : undefined}
				/>
				<button
					type="submit"
					formaction="?/servicePoints"
					formnovalidate
					onclick={search}
					aria-busy={loading || undefined}
				>
					<Icon name="search" size={16} />
					{m.checkout_pickup_search()}
				</button>
			</div>
			{#if searchError || err('spPostalCode')}<p id="sp-search-err" class="err" role="alert">
					{searchError ?? err('spPostalCode')}
				</p>{/if}
		</div>
		<div aria-live="polite">
			{#if points.length}
				<Radio
					name="servicePointId"
					legend={m.checkout_pickup_point()}
					variant="list"
					options={points.map((p) => ({
						value: p.id,
						label: p.name,
						description: `${p.street}, ${p.postalCode} ${p.city}`
					}))}
					bind:value={point}
					error={err('servicePointId')}
				/>
			{:else if searched}
				<p class="hint">{m.checkout_pickup_none()}</p>
			{:else}
				<p class="hint">{m.checkout_pickup_hint()}</p>
				{#if err('servicePointId')}<p class="err" role="alert" id={fieldId('servicePointId')} tabindex="-1">
						{err('servicePointId')}
					</p>{/if}
			{/if}
		</div>
	</div>
</div>

<style>
	.pickup {
		display: none;
	}
	.wrap.is-pickup .pickup,
	.wrap:has(:global(input[name='shippingMethod'][value='pickup']:checked)) .pickup {
		display: grid;
	}
	.pickup {
		gap: var(--space-4);
		margin-top: var(--space-4);
		padding: var(--space-4);
		border: 1px solid var(--ui-border);
		background: var(--ui-surface);
	}
	.lbl {
		display: block;
		margin-bottom: var(--space-2);
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
	}
	.row {
		display: flex;
		gap: var(--space-2);
	}
	input {
		flex: 1;
		min-width: 0;
		height: 2.75rem;
		padding: 0 var(--space-3);
		border: 1px solid var(--ui-border-strong);
		background: var(--ui-bg);
		font: inherit;
		color: var(--ui-text);
	}
	input:focus-visible,
	button:focus-visible {
		outline: none;
		box-shadow: var(--elev-focus);
	}
	button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.75rem;
		padding: 0 var(--space-4);
		border: 1px solid var(--ui-text);
		background: transparent;
		color: var(--ui-text);
		font-size: var(--fs-xs);
		letter-spacing: var(--ls-wide);
		text-transform: uppercase;
		cursor: pointer;
	}
	.hint {
		margin: 0;
		font-size: var(--fs-sm);
		color: var(--ui-text-muted);
	}
	.err {
		margin: var(--space-2) 0 0;
		font-size: var(--fs-xs);
		color: var(--ui-danger);
	}
</style>

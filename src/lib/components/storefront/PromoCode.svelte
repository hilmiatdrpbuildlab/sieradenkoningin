<!--
  @component PromoCode — apply/remove one discount code (max 1 per cart). Errors are announced.
-->
<script lang="ts">
	import { getCart } from '#lib/stores/cart.svelte.ts';
	import { formatPrice } from '#lib/utils/format.ts';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { m } from '#lib/paraglide/messages.js';

	const cart = getCart();
	let code = $state('');
	let error = $state<string | null>(null);
	const uid = $props.id();

	const messageFor = (reason: string, min: number | null) =>
		({
			not_found: m.cart_promo_not_found(),
			inactive: m.cart_promo_inactive(),
			not_started: m.cart_promo_not_started(),
			expired: m.cart_promo_expired(),
			min_subtotal: m.cart_promo_min_subtotal({ amount: formatPrice(min ?? 0, cart.lang) }),
			usage_limit: m.cart_promo_usage_limit(),
			customer_limit: m.cart_promo_customer_limit()
		})[reason] ?? m.cart_promo_not_found();

	async function apply(e: SubmitEvent) {
		e.preventDefault();
		if (!code.trim()) return;
		const r = await cart.applyCode(code);
		error = r.ok ? null : messageFor(r.error ?? 'not_found', r.minSubtotal);
		if (r.ok) code = '';
	}
</script>

{#if cart.view.discountCode && !cart.view.discountError}
	<div class="applied" role="status">
		<span><Icon name="tag" size={14} /> {m.cart_promo_applied({ code: cart.view.discountCode })}</span>
		<button type="button" class="remove" aria-label={m.cart_promo_remove({ code: cart.view.discountCode })} onclick={() => cart.removeCode()}>
			<Icon name="close" size={14} />
		</button>
	</div>
{:else}
	<form class="promo" onsubmit={apply}>
		<label for="promo{uid}" class="lbl">{m.cart_promo_label()}</label>
		<div class="row">
			<input id="promo{uid}" bind:value={code} autocomplete="off" autocapitalize="characters" aria-invalid={!!error || undefined} aria-describedby={error ? `promo${uid}-e` : undefined} />
			<button type="submit" disabled={cart.pending || !code.trim()}>{m.cart_promo_apply()}</button>
		</div>
		{#if error || cart.view.discountError}
			<p id="promo{uid}-e" class="err" role="alert">{error ?? messageFor(cart.view.discountError ?? '', null)}</p>
		{/if}
	</form>
{/if}

<style>
	.promo {
		display: grid;
		gap: var(--space-1);
	}
	.lbl {
		font-size: var(--fs-2xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		color: var(--ui-text-muted);
	}
	.row {
		display: flex;
		border: 1px solid var(--ui-border-strong);
	}
	input {
		flex: 1;
		min-width: 0;
		height: 2.75rem;
		padding: 0 var(--space-3);
		border: 0;
		background: transparent;
		font: inherit;
		font-size: var(--fs-sm);
		text-transform: uppercase;
		color: var(--ui-text);
	}
	input:focus-visible {
		outline: 2px solid var(--ui-border-focus);
		outline-offset: -2px;
	}
	button {
		padding: 0 var(--space-4);
		border: 0;
		border-left: 1px solid var(--ui-border-strong);
		background: none;
		color: var(--ui-text);
		font-size: var(--fs-2xs);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.err {
		margin: 0;
		font-size: var(--fs-xs);
		color: var(--ui-danger);
	}
	.applied {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: var(--fs-xs);
		color: var(--ui-success);
	}
	.applied span {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.remove {
		width: 2.75rem;
		height: 2.75rem;
		display: grid;
		place-items: center;
		border: 0;
		background: none;
		color: var(--ui-text-muted);
		cursor: pointer;
	}
</style>

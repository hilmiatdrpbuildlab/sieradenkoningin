<!--
  @component CartDrawer — right-side drawer (bottom sheet feel on phones = full width).
  Native <dialog> gives focus-trap, Esc-to-close and inert background for free.
  Sections: header · free-shipping progress · lines · gift note upsell · sticky footer.
-->
<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { getCart } from '#lib/stores/cart.svelte.ts';
	import { formatPrice } from '#lib/utils/format.ts';

	const cart = getCart();
	let dialog: HTMLDialogElement;

	$effect(() => {
		if (cart.open && !dialog.open) dialog.showModal();
		if (!cart.open && dialog.open) dialog.close();
	});

	const progress = $derived(Math.min(100, (cart.subtotal / cart.freeShippingFrom) * 100));
</script>

<dialog
	bind:this={dialog}
	class="drawer"
	aria-labelledby="cart-title"
	onclose={() => (cart.open = false)}
	onclick={(e) => e.target === dialog && (cart.open = false)}
>
	<div class="panel">
		<header class="head">
			<h2 id="cart-title">Winkelmand <span class="n">({cart.count})</span></h2>
			<button class="x" aria-label="Winkelmand sluiten" onclick={() => (cart.open = false)}><Icon name="close" /></button>
		</header>

		{#if cart.lines.length === 0}
			<div class="empty">
				<Icon name="crown" size={40} stroke={1} class="text-ornament" />
				<p class="h3">Je winkelmand is nog leeg</p>
				<p class="muted">Ontdek stukken die je elke dag als een koningin laten voelen.</p>
				<Button href="/collecties" onclick={() => (cart.open = false)}>Ontdek de collectie</Button>
			</div>
		{:else}
			<div class="ship" role="status">
				{#if cart.toFreeShipping > 0}
					<p>Nog <strong>{formatPrice(cart.toFreeShipping)}</strong> tot gratis verzending</p>
				{:else}
					<p><Icon name="sparkle" size={12} /> Je geniet van gratis verzending</p>
				{/if}
				<div class="bar"><span style:width="{progress}%"></span></div>
			</div>

			<ul class="lines" aria-busy={cart.pending}>
				{#each cart.lines as line (line.id)}
					<li class="line">
						<a href="/product/{line.slug}" class="thumb"><img src={line.image} alt="" width="96" height="120" loading="lazy" /></a>
						<div class="info">
							<a href="/product/{line.slug}" class="name">{line.name}</a>
							{#if line.variantLabel}<p class="variant">{line.variantLabel}</p>{/if}
							<div class="row">
								<div class="qty" role="group" aria-label="Aantal voor {line.name}">
									<button aria-label="Eén minder" onclick={() => cart.setQuantity(line.id, line.quantity - 1)}><Icon name="minus" size={14} /></button>
									<output aria-live="polite">{line.quantity}</output>
									<button aria-label="Eén meer" disabled={line.quantity >= line.maxQuantity} onclick={() => cart.setQuantity(line.id, line.quantity + 1)}><Icon name="plus" size={14} /></button>
								</div>
								<span class="price">{formatPrice(line.unitPrice * line.quantity)}</span>
							</div>
							<button class="remove" onclick={() => cart.remove(line.id)}>Verwijderen</button>
						</div>
					</li>
				{/each}
			</ul>

			<footer class="foot">
				<div class="gift"><Icon name="gift" size={18} class="text-accent" /> Gratis cadeauverpakking in onze signature box</div>
				<dl class="totals">
					<dt>Subtotaal</dt><dd>{formatPrice(cart.subtotal)}</dd>
				</dl>
				<p class="tax">Incl. 21% btw · verzendkosten berekend bij afrekenen</p>
				<Button href="/afrekenen" full size="lg">Afrekenen</Button>
				<button class="continue" onclick={() => (cart.open = false)}>Verder winkelen</button>
				<!-- TODO: <PaymentMarks /> — Bancontact first for Belgium, then cards / Apple Pay -->

			</footer>
		{/if}
	</div>
</dialog>

<style>
	.drawer {
		margin: 0 0 0 auto;
		padding: 0;
		width: var(--drawer-w);
		max-width: 100vw;
		height: 100dvh;
		max-height: 100dvh;
		border: 0;
		background: var(--ui-bg);
		color: var(--ui-text);
		box-shadow: var(--elev-xl);
	}
	.drawer::backdrop { background: var(--ui-overlay); backdrop-filter: blur(2px); }
	.drawer[open] { animation: slide-in var(--dur-slow) var(--motion-out); }
	.drawer[open]::backdrop { animation: fade var(--dur-slow) var(--motion-out); }
	@keyframes slide-in { from { transform: translateX(100%); } }
	@keyframes fade { from { opacity: 0; } }

	.panel { display: flex; flex-direction: column; height: 100%; }
	.head { display: flex; align-items: center; justify-content: space-between; padding: var(--space-5) var(--space-6); border-bottom: 1px solid var(--ui-border); }
	.head h2 { font-size: var(--fs-xl); margin: 0; }
	.n { font-family: var(--ff-body); font-size: var(--fs-sm); color: var(--ui-text-muted); }
	.x { width: 2.75rem; height: 2.75rem; display: grid; place-items: center; background: none; border: 0; color: inherit; cursor: pointer; margin-right: -0.75rem; }

	.empty { flex: 1; display: grid; place-content: center; justify-items: center; gap: var(--space-4); padding: var(--space-8); text-align: center; }
	.empty .h3 { font-family: var(--ff-display); font-size: var(--fs-2xl); margin: 0; }
	.muted { color: var(--ui-text-muted); margin: 0 0 var(--space-4); }

	.ship { padding: var(--space-4) var(--space-6); background: var(--ui-surface-sunken); font-size: var(--fs-xs); }
	.ship p { margin: 0 0 var(--space-2); display: flex; align-items: center; gap: var(--space-2); }
	.bar { height: 2px; background: var(--ui-border); }
	.bar span { display: block; height: 100%; background: var(--sk-gradient-gold); transition: width var(--dur-slow) var(--motion-out); }

	.lines { flex: 1; overflow-y: auto; list-style: none; margin: 0; padding: 0 var(--space-6); overscroll-behavior: contain; }
	.lines[aria-busy='true'] { opacity: 0.7; }
	.line { display: grid; grid-template-columns: 6rem 1fr; gap: var(--space-4); padding-block: var(--space-5); border-bottom: 1px solid var(--ui-border); }
	.thumb img { width: 6rem; aspect-ratio: var(--ratio-product); object-fit: cover; background: var(--ui-surface-sunken); }
	.info { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
	.name { font-family: var(--ff-display); font-size: var(--fs-base); text-decoration: none; }
	.variant { margin: 0; font-size: var(--fs-xs); color: var(--ui-text-muted); }
	.row { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: var(--space-2); }
	.qty { display: inline-flex; align-items: center; border: 1px solid var(--ui-border-strong); }
	.qty button { width: 2.25rem; height: 2.25rem; display: grid; place-items: center; background: none; border: 0; color: inherit; cursor: pointer; }
	.qty button:disabled { opacity: 0.3; cursor: not-allowed; }
	.qty output { min-width: 1.75rem; text-align: center; font-size: var(--fs-sm); }
	.price { font-size: var(--fs-sm); font-weight: var(--fw-medium); }
	.remove { align-self: flex-start; background: none; border: 0; padding: var(--space-1) 0; color: var(--ui-text-muted); font-size: var(--fs-xs); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }

	.foot { padding: var(--space-5) var(--space-6) calc(var(--space-5) + env(safe-area-inset-bottom)); border-top: 1px solid var(--ui-border); background: var(--ui-surface); display: grid; gap: var(--space-3); }
	.gift { display: flex; align-items: center; gap: var(--space-2); font-size: var(--fs-xs); color: var(--ui-text-muted); }
	.totals { display: flex; justify-content: space-between; margin: 0; font-size: var(--fs-base); font-weight: var(--fw-medium); }
	.totals dd { margin: 0; }
	.tax { margin: calc(var(--space-2) * -1) 0 var(--space-1); font-size: var(--fs-2xs); color: var(--ui-text-muted); }
	.continue { background: none; border: 0; color: var(--ui-text); font-size: var(--fs-xs); letter-spacing: var(--ls-wide); text-transform: uppercase; padding: var(--space-2); cursor: pointer; }
</style>

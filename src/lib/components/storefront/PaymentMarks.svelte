<!--
  @component PaymentMarks — text-based payment method marks, Bancontact first (Belgium).
  Text marks (not logos) keep us clear of trademark-artwork rules until official assets are added.
-->
<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	let { methods = ['bancontact', 'creditcard', 'applepay', 'googlepay', 'kbc'] }: { methods?: string[] } = $props();
	const LABELS: Record<string, string[]> = {
		bancontact: ['Bancontact'],
		creditcard: ['Visa', 'Mastercard'],
		applepay: ['Apple Pay'],
		googlepay: ['Google Pay'],
		kbc: ['KBC/CBC'],
		belfius: ['Belfius']
	};
	const order = ['bancontact', 'creditcard', 'applepay', 'googlepay', 'kbc', 'belfius'];
	const marks = $derived(order.filter((k) => methods.includes(k)).flatMap((k) => LABELS[k]));
</script>

<ul class="marks" aria-label={m.cart_payment_marks()}>
	{#each marks as label (label)}<li>{label}</li>{/each}
</ul>

<style>
	.marks {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: inline-flex;
		align-items: center;
		height: 1.75rem;
		padding-inline: var(--space-2);
		border: 1px solid var(--ui-border-strong);
		border-radius: var(--r-xs);
		font-size: var(--fs-2xs);
		font-weight: var(--fw-semibold);
		letter-spacing: 0.02em;
		color: var(--ui-text);
		background: color-mix(in srgb, var(--ui-surface) 40%, transparent);
	}
</style>

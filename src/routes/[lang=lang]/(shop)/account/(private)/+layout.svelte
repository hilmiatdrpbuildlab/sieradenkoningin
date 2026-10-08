<script lang="ts">
	import AccountNav from '#lib/components/storefront/AccountNav.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { data, children } = $props();
</script>

<div class="account container-lux">
	<header class="head">
		<p class="eyebrow">{m.acct_eyebrow()}</p>
		<p class="who">{data.me.firstName ? m.acct_hello_name({ name: data.me.firstName }) : m.acct_hello()}</p>
	</header>
	<div class="grid">
		<aside class="side"><AccountNav lang={data.lang} /></aside>
		<div class="main">{@render children()}</div>
	</div>
</div>

<style>
	.account {
		padding-block: var(--space-10) var(--section-y-sm);
	}
	.head {
		margin-bottom: var(--space-6);
	}
	.eyebrow {
		margin: 0 0 var(--space-1);
		color: var(--ui-text-muted);
	}
	.who {
		margin: 0;
		font-family: var(--ff-serif);
		font-size: var(--fs-2xl);
		color: var(--ui-text-strong);
	}
	.grid {
		display: grid;
		gap: var(--space-8);
	}
	.main,
	.side {
		min-width: 0;
	}
	@media (min-width: 64rem) {
		.grid {
			grid-template-columns: 15rem minmax(0, 1fr);
			gap: var(--space-12);
		}
		.side {
			position: sticky;
			top: calc(var(--space-24));
			align-self: start;
		}
	}
</style>

<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import Textarea from '#lib/components/ui/Textarea.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Radio from '#lib/components/ui/Radio.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Drawer from '#lib/components/ui/Drawer.svelte';
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';
	import Toast from '#lib/components/ui/Toast.svelte';
	import Skeleton from '#lib/components/ui/Skeleton.svelte';
	import Tooltip from '#lib/components/ui/Tooltip.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Tabs from '#lib/components/ui/Tabs.svelte';
	import Accordion from '#lib/components/ui/Accordion.svelte';
	import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
	import Pagination from '#lib/components/ui/Pagination.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import QuantityStepper from '#lib/components/ui/QuantityStepper.svelte';
	import ProductCard from '#lib/components/storefront/ProductCard.svelte';
	import CartDrawer from '#lib/components/storefront/CartDrawer.svelte';
	import DataTable from '#lib/components/admin/DataTable.svelte';
	import StatCard from '#lib/components/admin/StatCard.svelte';
	import StatusBadge from '#lib/components/admin/StatusBadge.svelte';
	import { setCartContext } from '#lib/stores/cart.svelte.ts';
	import { setWishlistContext } from '#lib/stores/wishlist.svelte.ts';
	import { setToastContext } from '#lib/stores/toast.svelte.ts';
	import { categoryIcons } from '#lib/components/ui/icons.ts';
	import type { CategoryIconName } from '#lib/components/ui/category-icons.ts';
	import type { Column, ProductCardData } from '#lib/types.ts';

	let { data } = $props();
	// svelte-ignore state_referenced_locally
	const cart = setCartContext(data.cart, 'nl');
	setWishlistContext();
	const toasts = setToastContext();

	let dialogOpen = $state(false);
	let drawerOpen = $state(false);
	let confirmOpen = $state(false);
	let qty = $state(1);
	let metal = $state('gold');

	const product: ProductCardData = {
		id: '00000000-0000-0000-0000-000000000001',
		slug: 'demo',
		href: '#',
		name: 'DEMO Klaverring',
		material: 'DEMO · verguld edelstaal',
		price: 4995,
		compareAtPrice: 6495,
		images: [{ src: '/brand/placeholder.svg', alt: 'DEMO Klaverring' }],
		metals: ['gold', 'silver'],
		inStock: true,
		quickAddVariantId: null
	};
	type Row = { id: string; number: string; total: string; status: 'paid' | 'shipped' };
	const rows: Row[] = [
		{ id: '1', number: 'SK-2026-000001', total: '€ 49,95', status: 'paid' },
		{ id: '2', number: 'SK-2026-000002', total: '€ 129,00', status: 'shipped' }
	];
	const columns: Column<Row>[] = [
		{ key: 'number', label: 'Nummer', sortable: true },
		{ key: 'total', label: 'Totaal', align: 'end' },
		{ key: 'status', label: 'Status' }
	];
	const cats = Object.keys(categoryIcons) as CategoryIconName[];
</script>

<svelte:head><title>Kitchen sink — dev</title><meta name="robots" content="noindex" /></svelte:head>

<main class="ks container-lux">
	<h1>Kitchen sink</h1>

	<section>
		<h2>Buttons & icons</h2>
		<div class="row">
			<Button>Primary</Button><Button variant="outline">Outline</Button><Button variant="ghost">Ghost</Button>
			<Button variant="link" iconRight="arrow-right">Link</Button><Button variant="gold">Gold</Button><Button variant="danger">Danger</Button>
			<Button loading>Loading</Button><Button icon="heart" aria-label="Favoriet" />
		</div>
		<ul class="row icons">
			{#each cats as c (c)}<li><Icon name={c} size={72} stroke={0.9} label={c} /><span>{c}</span></li>{/each}
			<li><Icon name="crown" size={40} label="crown" /></li><li><Icon name="clover" size={40} label="clover" /></li><li><Icon name="sparkle" size={40} label="sparkle" /></li>
		</ul>
	</section>

	<section>
		<h2>Form controls</h2>
		<form class="grid" onsubmit={(e) => e.preventDefault()}>
			<Field label="Naam" required hint="Zoals op je identiteitskaart"><Input name="ks-name" autocomplete="name" /></Field>
			<Field label="E-mail" error="Vul een geldig e-mailadres in"><Input name="ks-email" type="email" value="fout@" /></Field>
			<Field label="Wachtwoord"><Input name="ks-pw" type="password" /></Field>
			<Field label="Categorie"><Select name="ks-cat" options={[{ value: 'rings', label: 'Ringen' }, { value: 'bracelets', label: 'Armbanden' }]} /></Field>
			<Field label="Bericht" optional><Textarea name="ks-msg" maxlength={200} counter /></Field>
			<Checkbox name="ks-terms">Ik ga akkoord met de voorwaarden</Checkbox>
			<Radio name="ks-ship" legend="Verzending" variant="card" options={[{ value: 'home', label: 'Thuislevering', meta: '€ 4,95' }, { value: 'pickup', label: 'Afhaalpunt', meta: '€ 3,95' }]} value="home" />
			<Radio name="ks-metal" legend="Metaal" variant="swatch" bind:value={metal} options={[{ value: 'gold', label: 'Goud', swatch: 'var(--ui-swatch-gold)' }, { value: 'silver', label: 'Zilver', swatch: 'var(--ui-swatch-silver)' }]} />
			<QuantityStepper bind:value={qty} max={5} label="Aantal" />
		</form>
	</section>

	<section>
		<h2>Overlays & feedback</h2>
		<div class="row">
			<Button variant="outline" onclick={() => (dialogOpen = true)}>Dialog</Button>
			<Button variant="outline" onclick={() => (drawerOpen = true)}>Drawer</Button>
			<Button variant="outline" onclick={() => (confirmOpen = true)}>Confirm</Button>
			<Button variant="outline" onclick={() => toasts.push({ message: 'Toegevoegd aan je winkelmand' })}>Toast</Button>
			<Button variant="outline" onclick={() => (cart.open = true)}>Cart drawer</Button>
			<Tooltip text="Extra uitleg">{#snippet children(id)}<Button variant="ghost" icon="info" aria-label="Info" aria-describedby={id} />{/snippet}</Tooltip>
		</div>
		<div class="row">
			<Badge>Neutraal</Badge><Badge tone="success">Actief</Badge><Badge tone="warning">Lage voorraad</Badge><Badge tone="danger">Mislukt</Badge><Badge tone="sale">−20%</Badge>
			<StatusBadge status="paid" /><StatusBadge status="shipped" /><StatusBadge status="low_stock" />
		</div>
		<div class="row"><Skeleton width="12rem" height="1rem" /><Skeleton width="6rem" ratio="4 / 5" /></div>
	</section>

	<section>
		<h2>Navigation</h2>
		<Breadcrumbs items={[{ label: 'Home', href: '#' }, { label: 'Ringen', href: '#' }, { label: 'DEMO Klaverring' }]} />
		<Pagination page={2} pages={6} href={(n) => `?page=${n}`} />
		<Tabs tabs={[{ id: 'nl', label: 'Nederlands' }, { id: 'fr', label: 'Français', badge: '!' }]} label="Taal">
			{#snippet panel(id)}<p>Inhoud voor {id}</p>{/snippet}
		</Tabs>
		<Accordion items={[{ id: 'a', title: 'Details' }, { id: 'b', title: 'Met betekenis' }]}>{#snippet content(id)}<p>Tekst {id}</p>{/snippet}</Accordion>
	</section>

	<section>
		<h2>Commerce & admin</h2>
		<div class="cards"><ProductCard {product} /></div>
		<div data-theme="admin" class="admin">
			<div class="stats">
				<StatCard label="Omzet (30d)" value="€ 12.845" delta={0.124} trend={[3, 5, 4, 6, 8, 7, 9]} icon="chart" />
				<StatCard label="Retouren" value="3" delta={-0.2} invert icon="return" />
			</div>
			<DataTable {rows} {columns} total={2} selectable />
		</div>
		<EmptyState title="Nog geen bestellingen" text="Zodra er een bestelling binnenkomt, verschijnt ze hier." />
	</section>
</main>

<Dialog bind:open={dialogOpen} title="Maatgids"><p>Inhoud van de dialoog.</p></Dialog>
<Drawer bind:open={drawerOpen} side="bottom" title="Filters"><p>Filterinhoud.</p></Drawer>
<ConfirmDialog bind:open={confirmOpen} title="Product archiveren?" message="Het product verdwijnt uit de winkel." danger confirmLabel="Archiveren" />
<CartDrawer />
<Toast />

<style>
	.ks {
		padding-block: var(--space-10);
		display: grid;
		gap: var(--space-12);
	}
	section {
		display: grid;
		gap: var(--space-6);
	}
	h2 {
		font-size: var(--fs-2xl);
		margin: 0;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		align-items: center;
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.icons li {
		display: grid;
		justify-items: center;
		gap: var(--space-2);
		font-size: var(--fs-xs);
	}
	.grid {
		display: grid;
		gap: var(--space-6);
		max-width: 36rem;
	}
	.cards {
		max-width: 18rem;
	}
	.admin {
		padding: var(--space-6);
		display: grid;
		gap: var(--space-6);
		background: var(--ui-bg);
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: var(--space-4);
	}
</style>

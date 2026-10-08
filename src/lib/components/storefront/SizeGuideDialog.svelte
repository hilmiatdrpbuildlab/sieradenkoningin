<!--
  @component SizeGuideDialog — "Maatgids" in a native modal (ui/Dialog), reusing the CMS SizeTable.
-->
<script lang="ts">
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import SizeTable from '#lib/components/blocks/SizeTable.svelte';
	import { m } from '#lib/paraglide/messages.js';

	let { open = $bindable(false), kind = 'ring' }: { open?: boolean; kind?: 'ring' | 'bracelet' } = $props();
</script>

<Dialog bind:open title={m.pdp_size_guide()} size="lg">
	<div class="guide">
		<SizeTable {kind} />
	</div>
</Dialog>

<style>
	.guide :global(.sizes) {
		padding-block: 0;
		padding-inline: 0;
	}
	.guide :global(.printable) {
		display: none;
	}
</style>

<script lang="ts">
	import { page } from '$app/state';
	import AdminSidebar from '#lib/components/admin/AdminSidebar.svelte';
	import AdminTopbar from '#lib/components/admin/AdminTopbar.svelte';
	import Toast from '#lib/components/ui/Toast.svelte';
	import { setToastContext } from '#lib/stores/toast.svelte.ts';

	let { data, children } = $props();
	// svelte-ignore state_referenced_locally (initial SSR value from the cookie; the sidebar owns it afterwards)
	let collapsed = $state(data.sidebarCollapsed);
	let mobileOpen = $state(false);
	setToastContext();

	$effect(() => {
		void page.url.pathname;
		mobileOpen = false;
	});
</script>

<div class="shell" class:collapsed>
	<AdminSidebar groups={data.nav} bind:collapsed bind:mobileOpen user={{ name: data.admin.name, role: data.admin.roleLabel }} />
	<div class="main">
		<AdminTopbar bind:mobileOpen />
		<main id="admin-content" class="content">
			{@render children()}
		</main>
	</div>
</div>
<Toast />

<style>
	.shell {
		display: grid;
		min-height: 100dvh;
	}
	@media (min-width: 64rem) {
		.shell {
			grid-template-columns: auto 1fr;
		}
	}
	.main {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.content {
		padding: var(--space-6) var(--space-4) var(--space-16);
		width: 100%;
		max-width: 90rem;
	}
	@media (min-width: 64rem) {
		.content {
			padding: var(--space-8);
		}
	}
</style>

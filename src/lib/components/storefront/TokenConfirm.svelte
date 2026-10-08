<!--
  @component TokenConfirm — landing page for a mailed link (verify email / magic login). The token is
  only consumed by the POST of this button, so link scanners that pre-fetch URLs can't burn it.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthShell from './AuthShell.svelte';
	import Notice from './Notice.svelte';
	import Button from '#lib/components/ui/Button.svelte';

	interface Props {
		title: string;
		lead: string;
		button: string;
		token: string;
		next?: string | null;
		invalid: boolean;
		invalidText: string;
		againHref: string;
		againLabel: string;
	}
	let { title, lead, button, token, next = null, invalid, invalidText, againHref, againLabel }: Props = $props();
	let busy = $state(false);
</script>

<AuthShell {title} lead={invalid ? undefined : lead}>
	{#if invalid}
		<Notice kind="error"><p>{invalidText}</p></Notice>
		<a class="again" href={againHref}>{againLabel}</a>
	{:else}
		<form
			method="POST"
			use:enhance={() => {
				busy = true;
				return async ({ result, update }) => {
					if (result.type === 'redirect') return window.location.assign(result.location);
					await update();
					busy = false;
				};
			}}
		>
			<input type="hidden" name="token" value={token} />
			{#if next}<input type="hidden" name="next" value={next} />{/if}
			<Button type="submit" full loading={busy}>{button}</Button>
		</form>
	{/if}
</AuthShell>

<style>
	.again {
		display: inline-flex;
		align-items: center;
		justify-self: center;
		min-height: 2.75rem;
		color: var(--ui-accent);
	}
</style>

<!--
  @component Button — renders <a> when `href` is set, otherwise <button>.
  Variants follow the brand board: solid dark fill, or thin hairline border.

  <Button href="/collecties/ringen">Shop now</Button>
  <Button variant="outline" size="sm">Bekijk</Button>
  <Button variant="ghost" icon="heart" aria-label="Bewaar in favorieten" />
  <Button loading={submitting} full>In winkelmand</Button>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes, HTMLAnchorAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';
	import type { IconName } from './icons.ts';
	import { m } from '#lib/paraglide/messages.js';

	type Variant = 'primary' | 'outline' | 'ghost' | 'link' | 'gold' | 'danger';
	type Size = 'sm' | 'md' | 'lg';

	type Props = {
		variant?: Variant;
		size?: Size;
		href?: string;
		icon?: IconName;
		iconRight?: IconName;
		loading?: boolean;
		full?: boolean;
		children?: Snippet;
		class?: string;
	} & Omit<HTMLButtonAttributes, 'class'> &
		Omit<HTMLAnchorAttributes, 'class'>;

	let {
		variant = 'primary',
		size = 'md',
		href,
		icon,
		iconRight,
		loading = false,
		full = false,
		children,
		class: className = '',
		type = 'button',
		disabled,
		...rest
	}: Props = $props();

	const iconOnly = $derived(!children && !!icon);
	const classes = $derived(
		['btn', `btn--${variant}`, `btn--${size}`, full && 'btn--full', iconOnly && 'btn--icon', className]
			.filter(Boolean)
			.join(' ')
	);
</script>

{#snippet content()}
	{#if loading}
		<span class="spinner" aria-hidden="true"></span>
		<span class="sr-only">{m.ui_loading()}</span>
	{:else if icon}
		<Icon name={icon} size={size === 'sm' ? 16 : 18} />
	{/if}
	{#if children}<span class="label">{@render children()}</span>{/if}
	{#if iconRight && !loading}<Icon name={iconRight} size={16} class="arrow" />{/if}
{/snippet}

{#if href && !disabled}
	<a {href} class={classes} {...rest as HTMLAnchorAttributes}>{@render content()}</a>
{:else}
	<button
		{type}
		class={classes}
		disabled={disabled || loading}
		aria-busy={loading || undefined}
		{...rest as HTMLButtonAttributes}
	>
		{@render content()}
	</button>
{/if}

<style>
	.btn {
		--_h: 3rem;
		--_px: 1.75rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: var(--_h);
		padding-inline: var(--_px);
		font-family: var(--ff-body);
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		letter-spacing: var(--ls-wider);
		text-transform: uppercase;
		text-decoration: none;
		line-height: 1;
		border: 1px solid transparent;
		border-radius: var(--r-xs);
		cursor: pointer;
		transition:
			background-color var(--dur-base) var(--motion-out),
			color var(--dur-base) var(--motion-out),
			border-color var(--dur-base) var(--motion-out),
			box-shadow var(--dur-base) var(--motion-out);
		-webkit-tap-highlight-color: transparent;
	}
	.btn--sm { --_h: 2.5rem; --_px: 1.25rem; }
	.btn--lg { --_h: 3.5rem; --_px: 2.5rem; font-size: var(--fs-sm); }
	.btn--full { width: 100%; }
	.btn--icon { --_px: 0; width: var(--_h); }

	/* Solid — "Add to cart", "Shop now" on light */
	.btn--primary { background: var(--ui-action); color: var(--ui-action-text); }
	.btn--primary:hover { background: var(--ui-action-hover); }

	/* Hairline — the board's "SHOP NOW" on imagery */
	.btn--outline { background: transparent; color: var(--ui-text); border-color: var(--ui-border-strong); }
	.btn--outline:hover { background: var(--ui-text); color: var(--ui-bg); border-color: var(--ui-text); }

	.btn--ghost { background: transparent; color: var(--ui-text); }
	.btn--ghost:hover { background: color-mix(in srgb, var(--ui-text) 8%, transparent); }

	/* Text link with animated hairline underline */
	.btn--link {
		--_px: 0;
		min-height: auto;
		background: none;
		color: var(--ui-text);
		padding-block: var(--space-1);
		background-image: linear-gradient(currentColor, currentColor);
		background-size: 100% 1px;
		background-position: 0 100%;
		background-repeat: no-repeat;
		border-radius: 0;
	}
	.btn--link:hover { background-size: 0% 1px; background-position: 100% 100%; transition: background-size var(--dur-slow) var(--motion-out); }

	/* Special occasions only — gift cards, VIP. Max one per view. */
	.btn--gold { background: var(--ui-gold-gradient); color: var(--sk-burgundy); background-size: 200% 100%; }
	.btn--gold:hover { background-position: 100% 0; box-shadow: var(--elev-glow); }

	.btn--danger { background: var(--ui-danger); color: var(--ui-action-text); }
	.btn--danger:hover { background: color-mix(in srgb, var(--ui-danger) 82%, black); }

	.btn:focus-visible { outline: none; box-shadow: var(--elev-focus); }
	.btn:disabled { opacity: 0.45; cursor: not-allowed; }

	.btn :global(.arrow) { transition: transform var(--dur-base) var(--motion-out); }
	.btn:hover :global(.arrow) { transform: translateX(3px); }

	.spinner {
		width: 1em;
		height: 1em;
		border: 1px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }
	.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>

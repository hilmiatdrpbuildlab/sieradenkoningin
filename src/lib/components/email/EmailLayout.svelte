<!--
  @component EmailLayout — table-based shell for transactional emails: brand header with crown,
  content card, footer. Inline styles only (email clients ignore <style> and CSS variables); colours
  come from EMAIL_COLORS (hex mirror of tokens.css). Light theme only.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { EMAIL_COLORS as c } from './types.ts';
	import { m } from '#lib/paraglide/messages.js';

	interface Props {
		locale: 'nl' | 'fr';
		preheader: string;
		storeName: string;
		storeEmail: string | null;
		shopUrl: string;
		children: Snippet;
	}
	let { locale, preheader, storeName, storeEmail, shopUrl, children }: Props = $props();
	const font = "'Montserrat', 'Segoe UI', Helvetica, Arial, sans-serif";
	const serif = "'Playfair Display', Georgia, 'Times New Roman', serif";
</script>

<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{c.cream};">{preheader}</div>
<table
	role="presentation"
	width="100%"
	cellpadding="0"
	cellspacing="0"
	border="0"
	style="background:{c.cream};font-family:{font};color:{c.espresso};"
>
	<tbody>
		<tr>
			<td align="center" style="padding:32px 12px;">
				<table
					role="presentation"
					width="600"
					cellpadding="0"
					cellspacing="0"
					border="0"
					style="width:100%;max-width:600px;"
				>
					<tbody>
						<tr>
							<td align="center" style="background:{c.burgundy};padding:28px 24px;">
								<div style="font-size:28px;line-height:1;color:{c.gold};" aria-hidden="true">&#9819;</div>
								<a
									href={shopUrl}
									style="display:block;margin-top:10px;font-family:{serif};font-size:26px;letter-spacing:0.02em;color:{c.cream};text-decoration:none;"
									>{storeName}</a
								>
								<div
									style="margin-top:6px;font-size:10px;letter-spacing:0.32em;text-transform:uppercase;color:{c.gold};"
								>
									{m.email_tagline({}, { locale })}
								</div>
							</td>
						</tr>
						<tr>
							<td style="background:{c.surface};padding:32px 28px;font-size:15px;line-height:1.6;">
								{@render children()}
							</td>
						</tr>
						<tr>
							<td align="center" style="padding:24px 16px;font-size:12px;line-height:1.6;color:{c.cognac};">
								<p style="margin:0 0 6px;">
									{m.email_footer_help({}, { locale })}{#if storeEmail}&nbsp;<a
											href="mailto:{storeEmail}"
											style="color:{c.cognac};">{storeEmail}</a
										>{/if}
								</p>
								<p style="margin:0;">&copy; {storeName}</p>
							</td>
						</tr>
					</tbody>
				</table>
			</td>
		</tr>
	</tbody>
</table>

/**
 * Cloudflare Turnstile verification for public forms (register, forgot, contact, track, alerts).
 * Without a secret (dev/tests) every token passes — never deploy production without TURNSTILE_SECRET.
 */
export async function verifyTurnstile(secret: string, token: FormDataEntryValue | null, ip?: string): Promise<boolean> {
	if (!secret) return true;
	if (typeof token !== 'string' || !token) return false;
	const body = new FormData();
	body.set('secret', secret);
	body.set('response', token);
	if (ip) body.set('remoteip', ip);
	const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
	if (!res.ok) return false;
	return ((await res.json()) as { success: boolean }).success === true;
}

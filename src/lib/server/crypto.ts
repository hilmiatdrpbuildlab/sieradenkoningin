/** Web Crypto helpers (work on Workers and Node ≥ 20). */

const enc = new TextEncoder();

export function bytesToBase64Url(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
	const norm = b64.replace(/-/g, '+').replace(/_/g, '/');
	const bin = atob(norm + '='.repeat((4 - (norm.length % 4)) % 4));
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Cryptographically random URL-safe token (default 32 bytes = 256 bits). */
export function randomToken(bytes = 32): string {
	return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Hex(input: string): Promise<string> {
	return toHex(await crypto.subtle.digest('SHA-256', enc.encode(input)));
}

export async function hmacHex(secret: string, input: string): Promise<string> {
	const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(input)));
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

async function aesKey(keyB64: string) {
	const raw = base64ToBytes(keyB64);
	if (raw.length !== 32) throw new Error('TOTP_ENC_KEY must be 32 bytes (base64)');
	return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** AES-256-GCM; output = base64url(iv).base64url(ciphertext). */
export async function encrypt(plain: string, keyB64: string): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(keyB64), enc.encode(plain));
	return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ct))}`;
}

export async function decrypt(payload: string, keyB64: string): Promise<string> {
	const [iv, ct] = payload.split('.');
	const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(iv) }, await aesKey(keyB64), base64ToBytes(ct));
	return new TextDecoder().decode(pt);
}

/**
 * RFC 6238 TOTP (SHA-1, 6 digits, 30 s) — compatible with Google Authenticator, 1Password, Authy.
 * Secrets are stored AES-GCM encrypted with TOTP_ENC_KEY (see crypto.ts).
 */
import { randomToken, sha256Hex } from '../crypto.ts';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Uint8Array): string {
	let bits = 0;
	let value = 0;
	let out = '';
	for (const b of bytes) {
		value = (value << 8) | b;
		bits += 8;
		while (bits >= 5) {
			out += B32[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) out += B32[(value << (5 - bits)) & 31];
	return out;
}

export function base32Decode(input: string): Uint8Array<ArrayBuffer> {
	const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
	let bits = 0;
	let value = 0;
	const out: number[] = [];
	for (const c of clean) {
		const i = B32.indexOf(c);
		if (i < 0) throw new Error('Invalid base32');
		value = (value << 5) | i;
		bits += 5;
		if (bits >= 8) {
			out.push((value >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}
	return new Uint8Array(out);
}

export function generateTotpSecret(): string {
	return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}

export async function totpCode(secret: string, timeMs = Date.now(), step = 30): Promise<string> {
	const counter = Math.floor(timeMs / 1000 / step);
	const buf = new ArrayBuffer(8);
	const view = new DataView(buf);
	view.setUint32(0, Math.floor(counter / 2 ** 32));
	view.setUint32(4, counter >>> 0);
	const key = await crypto.subtle.importKey('raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
	const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
	const offset = mac[mac.length - 1] & 0xf;
	const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
	return String(bin % 1_000_000).padStart(6, '0');
}

/** Accepts the current code and ±`window` steps (default ±1 = 90 s total) to absorb clock drift. */
export async function verifyTotp(secret: string, code: string, timeMs = Date.now(), window = 1): Promise<boolean> {
	const clean = code.replace(/\s/g, '');
	if (!/^\d{6}$/.test(clean)) return false;
	for (let w = -window; w <= window; w++) {
		if ((await totpCode(secret, timeMs + w * 30_000)) === clean) return true;
	}
	return false;
}

export function otpauthUrl(secret: string, account: string, issuer = 'Sieradenkoningin') {
	return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/** 10 single-use recovery codes: returns plain codes (show once) and their hashes (store). */
export async function generateRecoveryCodes(n = 10) {
	const plain = Array.from({ length: n }, () => randomToken(6).replace(/[-_]/g, 'x').slice(0, 8).toLowerCase());
	const hashes = await Promise.all(plain.map((c) => sha256Hex(c)));
	return { plain, hashes };
}

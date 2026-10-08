/**
 * Password hashing — Argon2id via @noble/hashes (audited, pure JS).
 *
 * Why not WASM: Cloudflare Workers forbid compiling WebAssembly at runtime ("Wasm code generation
 * disallowed by embedder"), which is how hash-wasm loads its module — every verify failed in production.
 * Hashes use the standard PHC string (`$argon2id$v=19$m=…,t=…,p=…$salt$hash`), so hashes created
 * earlier with hash-wasm keep verifying.
 *
 * Parameters: m = 19 MiB, t = 2, p = 1 (OWASP 2024 minimum for Argon2id), ≈ 130 ms CPU per hash on
 * workerd. That needs the Workers Paid plan (30 s CPU); the Free plan's 10 ms limit is only tolerated in
 * bursts. If production measurements are too slow, switch to scrypt behind the same two functions and
 * log the reason in §12.
 */
import { argon2idAsync } from '@noble/hashes/argon2.js';

const PARAMS = { t: 2, m: 19_456, p: 1 } as const;
const HASH_LENGTH = 32;
const PHC = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=+$/, '');
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const derive = (password: string, salt: Uint8Array, opts: { t: number; m: number; p: number }, dkLen: number) =>
	argon2idAsync(new TextEncoder().encode(password), salt, { ...opts, dkLen, asyncTick: 50 });

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const hash = await derive(password, salt, PARAMS, HASH_LENGTH);
	return `$argon2id$v=19$m=${PARAMS.m},t=${PARAMS.t},p=${PARAMS.p}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(hash: string | null | undefined, password: string): Promise<boolean> {
	const parts = hash ? PHC.exec(hash) : null;
	if (!parts) return false;
	const [, m, t, p, salt, expected] = parts;
	try {
		const want = unb64(expected);
		const got = await derive(password, unb64(salt), { m: Number(m), t: Number(t), p: Number(p) }, want.length);
		let diff = got.length ^ want.length;
		for (let i = 0; i < want.length; i++) diff |= got[i] ^ want[i];
		return diff === 0;
	} catch {
		return false;
	}
}

/** Shared password policy (also enforced client-side via zod schemas). */
export const PASSWORD_MIN = 10;

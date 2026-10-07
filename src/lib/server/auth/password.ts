/**
 * Password hashing — Argon2id via hash-wasm (WASM, runs on Workers).
 *
 * Parameters: m = 19 MiB, t = 2, p = 1 (OWASP 2024 minimum for Argon2id). On the Workers paid
 * plan (30 s CPU) a hash costs well under the limit; if production measurements show otherwise,
 * switch to scrypt (N=2^17, r=8, p=1) behind the same two functions and log the reason in §12.
 */
import { argon2id, argon2Verify } from 'hash-wasm';

const PARAMS = { parallelism: 1, iterations: 2, memorySize: 19_456, hashLength: 32 } as const;

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	return argon2id({ password, salt, ...PARAMS, outputType: 'encoded' });
}

export async function verifyPassword(hash: string | null | undefined, password: string): Promise<boolean> {
	if (!hash) return false;
	try {
		return await argon2Verify({ password, hash });
	} catch {
		return false;
	}
}

/** Shared password policy (also enforced client-side via zod schemas). */
export const PASSWORD_MIN = 10;

import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '#lib/server/auth/password.ts';
import { isSessionValid, SESSION_POLICY } from '#lib/server/auth/session.ts';
import {
	base32Decode,
	base32Encode,
	generateTotpSecret,
	totpCode,
	verifyTotp,
	generateRecoveryCodes
} from '#lib/server/auth/totp.ts';
import { decrypt, encrypt, randomToken, safeEqual } from '#lib/server/crypto.ts';

describe('password hashing (argon2id)', () => {
	it('hashes and verifies', async () => {
		const hash = await hashPassword('correct horse battery');
		expect(hash.startsWith('$argon2id$')).toBe(true);
		expect(await verifyPassword(hash, 'correct horse battery')).toBe(true);
		expect(await verifyPassword(hash, 'wrong password')).toBe(false);
		expect(await verifyPassword(null, 'x')).toBe(false);
		expect(await verifyPassword('garbage', 'x')).toBe(false);
	});

	it('salts every hash', async () => {
		expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
	});

	it('verifies hashes created by the previous hash-wasm implementation (PHC compatible)', async () => {
		const legacy = '$argon2id$v=19$m=19456,t=2,p=1$AQIDBAUGBwgJCgsMDQ4PEA$qQMgn9BBXGm1FG5hbgVLTB/c49pso4YEKQMbq6g2F5M';
		expect(await verifyPassword(legacy, 'correct horse battery')).toBe(true);
		expect(await verifyPassword(legacy, 'correct horse batterY')).toBe(false);
	});
});

describe('session expiry', () => {
	const now = Date.UTC(2026, 9, 7, 12);
	const policy = SESSION_POLICY.admin;
	it('admin: 12h idle, 7d absolute', () => {
		expect(policy.idleMs).toBe(12 * 3600_000);
		expect(policy.absoluteMs).toBe(7 * 86400_000);
		expect(policy.sameSite).toBe('strict');
	});
	it('is valid only before both the idle and the absolute expiry', () => {
		const s = { expiresAt: new Date(now + 1000), idleExpiresAt: new Date(now + 500) };
		expect(isSessionValid(s, now)).toBe(true);
		expect(isSessionValid(s, now + 600)).toBe(false); // idle expired
		expect(isSessionValid({ expiresAt: new Date(now - 1), idleExpiresAt: new Date(now + 5000) }, now)).toBe(false); // absolute
	});
});

describe('TOTP (RFC 6238)', () => {
	// RFC 6238 test secret "12345678901234567890" (SHA-1), T = 59 s → 94287082 (8 digits) → 287082 (6 digits)
	const rfcSecret = base32Encode(new TextEncoder().encode('12345678901234567890'));

	it('matches the RFC test vectors', async () => {
		expect(await totpCode(rfcSecret, 59_000)).toBe('287082');
		expect(await totpCode(rfcSecret, 1111111109_000)).toBe('081804');
		expect(await totpCode(rfcSecret, 1234567890_000)).toBe('005924');
	});

	it('accepts ±1 step of clock drift and rejects ±2', async () => {
		const secret = generateTotpSecret();
		const t = 1_800_000_000_000;
		const code = await totpCode(secret, t);
		expect(await verifyTotp(secret, code, t)).toBe(true);
		expect(await verifyTotp(secret, code, t + 30_000)).toBe(true);
		expect(await verifyTotp(secret, code, t - 30_000)).toBe(true);
		expect(await verifyTotp(secret, code, t + 90_000)).toBe(false);
		expect(await verifyTotp(secret, 'abcdef', t)).toBe(false);
	});

	it('round-trips base32', () => {
		const bytes = crypto.getRandomValues(new Uint8Array(20));
		expect([...base32Decode(base32Encode(bytes))]).toEqual([...bytes]);
	});

	it('generates 10 distinct recovery codes with hashes', async () => {
		const { plain, hashes } = await generateRecoveryCodes();
		expect(new Set(plain).size).toBe(10);
		expect(hashes).toHaveLength(10);
	});
});

describe('crypto helpers', () => {
	it('encrypts and decrypts with AES-GCM', async () => {
		const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
		const ct = await encrypt('JBSWY3DPEHPK3PXP', key);
		expect(ct).not.toContain('JBSWY3DPEHPK3PXP');
		expect(await decrypt(ct, key)).toBe('JBSWY3DPEHPK3PXP');
	});
	it('creates url-safe random tokens and compares in constant time', () => {
		const t = randomToken();
		expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(safeEqual(t, t)).toBe(true);
		expect(safeEqual(t, randomToken())).toBe(false);
	});
});

describe('demo 2FA skip', () => {
	it('only applies when both DEMO_SKIP_2FA and PUBLIC_STAGING are "1"', async () => {
		const { skip2fa } = await import('#lib/server/auth/admin.ts');
		expect(skip2fa('1', '1')).toBe(true);
		expect(skip2fa('1', '')).toBe(false); // production: 2FA stays mandatory
		expect(skip2fa('', '1')).toBe(false);
	});
});

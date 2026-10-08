/** P3-01: customer auth tokens are single-use and expire after 30 min; enumeration-safe helpers; order linking. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq, like } from 'drizzle-orm';
import * as s from '#lib/server/db/schema.ts';
import { PASSWORD_MIN } from '#lib/server/auth/password.ts';
import { PASSWORD_MIN_LENGTH, registerSchema, resetSchema } from '#lib/schemas/account.ts';
import {
	TOKEN_TTL_MS,
	authLink,
	checkPasswordLogin,
	consumeToken,
	issueToken,
	linkGuestOrders,
	markVerified,
	peekToken,
	registerCustomer,
	safeNext
} from '#lib/server/services/customer-auth.ts';

const url = process.env.TEST_DATABASE_URL || 'postgres://sk@localhost:54329/sieradenkoningin_test';
const pool = new pg.Pool({ connectionString: url, max: 3 });
const db = drizzle(pool, { schema: s });
const EMAIL = 'auth-test@example.invalid';
const PW = 'correct horse battery';

async function cleanup() {
	await db.delete(s.orders).where(like(s.orders.number, 'AUTH-TEST-%'));
	await db.delete(s.magicLinks).where(like(s.magicLinks.email, '%auth-test%'));
	await db.delete(s.customers).where(like(s.customers.email, '%auth-test%'));
}

beforeAll(async () => {
	await migrate(db, { migrationsFolder: './drizzle' });
	await cleanup();
});
afterAll(async () => {
	await cleanup();
	await pool.end();
});

describe('magic-link tokens', () => {
	it('stores only a SHA-256 hash of the token', async () => {
		const token = await issueToken(db, EMAIL, 'login');
		const rows = await db.select().from(s.magicLinks).where(eq(s.magicLinks.email, EMAIL));
		expect(rows.some((r) => r.tokenHash === token)).toBe(false);
		expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.tokenHash))).toBe(true);
	});

	it('is single-use: the second consume fails', async () => {
		const token = await issueToken(db, EMAIL, 'login');
		expect(await consumeToken(db, token, 'login')).toBe(EMAIL);
		expect(await consumeToken(db, token, 'login')).toBeNull();
	});

	it('is single-use under concurrency (exactly one winner)', async () => {
		const token = await issueToken(db, EMAIL, 'reset');
		const results = await Promise.all(Array.from({ length: 5 }, () => consumeToken(db, token, 'reset')));
		expect(results.filter(Boolean)).toHaveLength(1);
	});

	it('expires after 30 minutes', async () => {
		expect(TOKEN_TTL_MS).toBe(30 * 60_000);
		const issuedAt = new Date();
		const token = await issueToken(db, EMAIL, 'verify', issuedAt);
		const at = (ms: number) => new Date(issuedAt.getTime() + ms);
		expect(await peekToken(db, token, 'verify', at(29 * 60_000))).toBe(EMAIL);
		expect(await consumeToken(db, token, 'verify', at(30 * 60_000 + 1000))).toBeNull();
		// Still unused: within the window it works exactly once.
		expect(await consumeToken(db, token, 'verify', at(29 * 60_000))).toBe(EMAIL);
	});

	it('peek does not consume, and purposes are not interchangeable', async () => {
		const token = await issueToken(db, EMAIL, 'reset');
		expect(await peekToken(db, token, 'reset')).toBe(EMAIL);
		expect(await peekToken(db, token, 'reset')).toBe(EMAIL);
		expect(await consumeToken(db, token, 'login')).toBeNull();
		expect(await consumeToken(db, token, 'reset')).toBe(EMAIL);
	});

	it('a new token revokes older unused tokens of the same purpose', async () => {
		const first = await issueToken(db, EMAIL, 'reset');
		const second = await issueToken(db, EMAIL, 'reset');
		expect(await consumeToken(db, first, 'reset')).toBeNull();
		expect(await consumeToken(db, second, 'reset')).toBe(EMAIL);
	});

	it('rejects junk tokens without querying', async () => {
		expect(await consumeToken(db, null, 'login')).toBeNull();
		expect(await consumeToken(db, 'short', 'login')).toBeNull();
		expect(await peekToken(db, 'x'.repeat(500), 'login')).toBeNull();
	});
});

describe('accounts', () => {
	it('password policy: ≥ 10 characters, schema and server agree', () => {
		expect(PASSWORD_MIN).toBe(10);
		expect(PASSWORD_MIN_LENGTH).toBe(PASSWORD_MIN);
		const base = { firstName: 'A', lastName: 'B', email: 'a@b.be', newsletter: undefined };
		expect(registerSchema.safeParse({ ...base, password: '123456789' }).success).toBe(false);
		expect(registerSchema.safeParse({ ...base, password: '1234567890' }).success).toBe(true);
		expect(resetSchema.safeParse({ password: '1234567890', confirm: '1234567891' }).success).toBe(false);
	});

	it('register: second registration with the same email reports "exists" (caller sends the same response)', async () => {
		const a = await registerCustomer(db, { email: EMAIL.toUpperCase(), password: PW, firstName: 'Ann', lastName: 'Test', locale: 'nl' });
		expect(a.kind).toBe('created');
		const b = await registerCustomer(db, { email: EMAIL, password: 'another password', firstName: 'X', lastName: 'Y', locale: 'fr' });
		expect(b.kind).toBe('exists');
		// The existing password was NOT overwritten.
		expect((await checkPasswordLogin(db, EMAIL, 'another password')).ok).toBe(false);
	});

	it('login: unknown email and wrong password give the same result; unverified is flagged', async () => {
		expect(await checkPasswordLogin(db, 'nobody-auth-test@example.invalid', PW)).toEqual({ ok: false, reason: 'invalid' });
		expect(await checkPasswordLogin(db, EMAIL, 'wrong password!!')).toEqual({ ok: false, reason: 'invalid' });
		const r = await checkPasswordLogin(db, EMAIL, PW);
		expect(r.ok === false && r.reason).toBe('unverified');
	});

	it('guest orders are linked only once the email is verified', async () => {
		const addr = { name: 'Ann Test', line1: 'Straat 1', postalCode: '9000', city: 'Gent', country: 'BE' };
		const order = (n: string, email: string) => ({
			number: `AUTH-TEST-${n}`,
			accessToken: 't',
			email,
			subtotal: 1000,
			vatTotal: 174,
			total: 1000,
			shippingAddress: addr,
			billingAddress: addr
		});
		await db.insert(s.orders).values([order('1', EMAIL), order('2', 'other-auth-test@example.invalid')]);
		const [c] = await db.select().from(s.customers).where(eq(s.customers.email, EMAIL));
		expect(await linkGuestOrders(db, c)).toBe(0);
		const verified = await markVerified(db, c);
		expect(verified.emailVerifiedAt).toBeInstanceOf(Date);
		expect(await linkGuestOrders(db, verified)).toBe(1);
		const rows = await db.select().from(s.orders).where(like(s.orders.number, 'AUTH-TEST-%'));
		expect(rows.find((o) => o.number === 'AUTH-TEST-1')?.customerId).toBe(c.id);
		expect(rows.find((o) => o.number === 'AUTH-TEST-2')?.customerId).toBeNull();
		expect((await checkPasswordLogin(db, EMAIL, PW)).ok).toBe(true);
	});
});

describe('links & redirects', () => {
	it('builds localized links', () => {
		expect(authLink('https://x.be/', 'nl', 'reset', 'abc')).toBe('https://x.be/nl/account/wachtwoord-herstellen/abc');
		expect(authLink('https://x.be', 'fr', 'verify', 'abc')).toBe('https://x.be/fr/compte/confirmer?token=abc');
		expect(authLink('https://x.be', 'nl', 'login', 'abc', '/nl/afrekenen')).toBe(
			'https://x.be/nl/account/magische-link?token=abc&next=%2Fnl%2Fafrekenen'
		);
	});

	it('only accepts same-site paths as ?next (no open redirect)', () => {
		expect(safeNext('/nl/account/bestellingen')).toBe('/nl/account/bestellingen');
		for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'nl/account', '/admin', null, '/x\n/y']) {
			expect(safeNext(bad)).toBeNull();
		}
	});
});

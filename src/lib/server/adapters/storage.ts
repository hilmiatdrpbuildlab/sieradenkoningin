/**
 * Object storage adapter (S3-compatible API, decision D7).
 * - `s3`: any S3-compatible bucket (Neon object storage if S3-compatible, Cloudflare R2 otherwise).
 *   Uses aws4fetch (tiny, Web-Crypto based) — the AWS SDK is too heavy for Workers.
 * - `mock`: writes to `.data/uploads` (dev, tests, previews). Files are served by `/media/[...key]`
 *   and "presigned" uploads go to `/admin/api/uploads/put` with an HMAC signature.
 */
import { AwsClient } from 'aws4fetch';
import { hmacHex, safeEqual } from '../crypto.ts';

export interface StorageEnv {
	STORAGE_ENDPOINT: string;
	STORAGE_BUCKET: string;
	STORAGE_ACCESS_KEY_ID: string;
	STORAGE_SECRET_ACCESS_KEY: string;
	STORAGE_REGION?: string;
	PUBLIC_MEDIA_URL: string;
	SESSION_SECRET: string;
}

export interface Storage {
	kind: 's3' | 'mock';
	presignPut(key: string, contentType: string, expires?: number): Promise<string>;
	put(key: string, body: Uint8Array | string, contentType: string): Promise<void>;
	get(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
	delete(key: string): Promise<void>;
	publicUrl(key: string): string;
	/** Short-lived URL for private objects (invoices, labels). */
	signedGetUrl(key: string, expires?: number): Promise<string>;
}

const MOCK_DIR = '.data/uploads';

const mimeFromKey = (key: string) =>
	({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', pdf: 'application/pdf', json: 'application/json' })[
		key.split('.').pop()?.toLowerCase() ?? ''
	] ?? 'application/octet-stream';

export function isSafeKey(key: string) {
	return /^[a-z0-9][a-z0-9/_.-]*$/i.test(key) && !key.includes('..');
}

export function createStorage(env: StorageEnv): Storage {
	if (!env.STORAGE_ENDPOINT || !env.STORAGE_ACCESS_KEY_ID) return createMockStorage(env);

	const client = new AwsClient({
		accessKeyId: env.STORAGE_ACCESS_KEY_ID,
		secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
		service: 's3',
		region: env.STORAGE_REGION ?? 'auto'
	});
	const objectUrl = (key: string) => `${env.STORAGE_ENDPOINT}/${env.STORAGE_BUCKET}/${key}`;
	const presign = async (key: string, method: 'GET' | 'PUT', expires: number, contentType?: string) => {
		const url = new URL(objectUrl(key));
		url.searchParams.set('X-Amz-Expires', String(expires));
		const signed = await client.sign(
			new Request(url, { method, headers: contentType ? { 'content-type': contentType } : {} }),
			{ aws: { signQuery: true } }
		);
		return signed.url;
	};

	return {
		kind: 's3',
		/** Content-Type is signed, so the browser must send the exact same header. */
		presignPut: (key, contentType, expires = 300) => presign(key, 'PUT', expires, contentType),
		signedGetUrl: (key, expires = 300) => presign(key, 'GET', expires),
		async put(key, body, contentType) {
			const res = await client.fetch(objectUrl(key), {
				method: 'PUT',
				body: typeof body === 'string' ? body : new Blob([new Uint8Array(body)]),
				headers: { 'content-type': contentType }
			});
			if (!res.ok) throw new Error(`Storage put failed: ${res.status}`);
		},
		async get(key) {
			const res = await client.fetch(objectUrl(key));
			if (res.status === 404) return null;
			if (!res.ok) throw new Error(`Storage get failed: ${res.status}`);
			return { body: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get('content-type') ?? mimeFromKey(key) };
		},
		async delete(key) {
			const res = await client.fetch(objectUrl(key), { method: 'DELETE' });
			if (!res.ok && res.status !== 404) throw new Error(`Storage delete failed: ${res.status}`);
		},
		publicUrl: (key) => `${env.PUBLIC_MEDIA_URL || env.STORAGE_ENDPOINT + '/' + env.STORAGE_BUCKET}/${key}`
	};
}

/** Signature for mock upload/download URLs (stands in for S3 presigning). */
export async function mockSignature(secret: string, method: string, key: string, expiresAt: number) {
	return hmacHex(secret || 'dev-secret', `${method}:${key}:${expiresAt}`);
}

export async function verifyMockSignature(secret: string, method: string, key: string, expiresAt: number, sig: string) {
	if (Date.now() > expiresAt) return false;
	return safeEqual(await mockSignature(secret, method, key, expiresAt), sig);
}

function createMockStorage(env: StorageEnv): Storage {
	const fs = () => import('node:fs/promises');
	const path = (key: string) => {
		if (!isSafeKey(key)) throw new Error('Invalid storage key');
		return `${MOCK_DIR}/${key}`;
	};
	const signed = async (route: string, method: string, key: string, expires: number) => {
		const exp = Date.now() + expires * 1000;
		const sig = await mockSignature(env.SESSION_SECRET, method, key, exp);
		return `${route}?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
	};
	return {
		kind: 'mock',
		presignPut: (key, _contentType, expires = 300) => signed('/admin/api/uploads/put', 'PUT', key, expires),
		signedGetUrl: (key, expires = 300) => signed('/media/private', 'GET', key, expires),
		async put(key, body) {
			const { mkdir, writeFile } = await fs();
			const p = path(key);
			await mkdir(p.slice(0, p.lastIndexOf('/')), { recursive: true });
			await writeFile(p, body);
		},
		async get(key) {
			const { readFile } = await fs();
			try {
				return { body: new Uint8Array(await readFile(path(key))), contentType: mimeFromKey(key) };
			} catch {
				return null;
			}
		},
		async delete(key) {
			const { rm } = await fs();
			await rm(path(key), { force: true });
		},
		publicUrl: (key) => `${env.PUBLIC_MEDIA_URL || '/media'}/${key}`
	};
}

/** products/2026/10/<uuid>.<ext> — unguessable, cache-forever (immutable) keys. */
export function mediaKey(contentType: string, folder = 'products') {
	const ext =
		{ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/svg+xml': 'svg' }[contentType] ??
		'bin';
	const d = new Date();
	return `${folder}/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
}

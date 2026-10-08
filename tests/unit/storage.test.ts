import { describe, expect, it } from 'vitest';
import { createStorage, verifyMockSignature } from '#lib/server/adapters/storage.ts';

const base = {
	STORAGE_ENDPOINT: 'https://bucket.example.invalid',
	STORAGE_BUCKET: 'media',
	STORAGE_ACCESS_KEY_ID: 'AKID',
	STORAGE_SECRET_ACCESS_KEY: 'secret',
	STORAGE_REGION: 'eu-central-1',
	PUBLIC_MEDIA_URL: '',
	SESSION_SECRET: 'test-secret'
};

describe('storage adapter', () => {
	it('falls back to the mock without credentials (always proxied)', () => {
		const s = createStorage({ ...base, STORAGE_ENDPOINT: '', STORAGE_ACCESS_KEY_ID: '' });
		expect(s.kind).toBe('mock');
		expect(s.proxied).toBe(true);
	});

	it('s3 without a media CDN proxies uploads/downloads through app routes (private bucket)', async () => {
		const s = createStorage(base);
		expect(s.kind).toBe('s3');
		expect(s.proxied).toBe(true);
		expect(s.publicUrl('products/a.jpg')).toBe('/media/products/a.jpg');
		const put = new URL(await s.presignPut('products/a.jpg', 'image/jpeg'), 'http://x');
		expect(put.pathname).toBe('/admin/api/uploads/put');
		const p = put.searchParams;
		expect(await verifyMockSignature('test-secret', 'PUT', p.get('key')!, Number(p.get('exp')), p.get('sig')!)).toBe(
			true
		);
		expect(new URL(await s.signedGetUrl('invoices/x.pdf'), 'http://x').pathname).toBe('/media/private');
	});

	it('s3 with a media CDN presigns against the bucket', async () => {
		const s = createStorage({ ...base, PUBLIC_MEDIA_URL: 'https://media.example.invalid' });
		expect(s.proxied).toBe(false);
		expect(s.publicUrl('products/a.jpg')).toBe('https://media.example.invalid/products/a.jpg');
		const url = await s.presignPut('products/a.jpg', 'image/jpeg');
		expect(url.startsWith('https://bucket.example.invalid/media/products/a.jpg?')).toBe(true);
		expect(url).toContain('X-Amz-Signature=');
	});
});

import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	// Compiles .svelte files (email templates rendered with `svelte/server` in tests/unit/email.test.ts).
	plugins: [svelte()],
	resolve: {
		alias: [{ find: /^#lib\/(.*)$/, replacement: fileURLToPath(new URL('./src/lib/$1', import.meta.url)) }]
	},
	test: {
		include: ['tests/unit/**/*.test.ts'],
		environment: 'node',
		setupFiles: ['tests/unit/setup.ts'],
		fileParallelism: false,
		testTimeout: 20_000
	}
});

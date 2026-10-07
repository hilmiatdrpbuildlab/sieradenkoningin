import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
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

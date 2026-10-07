import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default ts.config(
	{
		ignores: [
			'.svelte-kit/',
			'.data/',
			'.wrangler/',
			'build/',
			'drizzle/',
			'node_modules/',
			'src/lib/paraglide/',
			'test-results/',
			'playwright-report/',
			'static/'
		]
	},
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } }
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: { parserOptions: { parser: ts.parser, extraFileExtensions: ['.svelte'] } }
	},
	{
		rules: {
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			// Adapters parse untyped third-party JSON (Mollie, Sendcloud) at the boundary.
			'@typescript-eslint/no-explicit-any': 'off',
			// Links are built with localizeHref() from the i18n path map, not resolve() route ids.
			'svelte/no-navigation-without-resolve': 'off',
			// `{@html}` is only used for trusted, server-sanitised content (icons, CMS rich text).
			'svelte/no-at-html-tags': 'off',
			'no-restricted-imports': [
				'error',
				{ patterns: [{ group: ['$lib', '$lib/*'], message: 'SvelteKit 3: use #lib/… subpath imports.' }] }
			]
		}
	}
);

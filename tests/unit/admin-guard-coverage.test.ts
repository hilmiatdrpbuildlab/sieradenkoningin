/**
 * P5-03: static guarantee that every admin server module checks permissions.
 * For each +page.server.ts / +server.ts under src/routes/admin/(app):
 *  - every exported `load`, every action and every HTTP handler must call requirePermission(),
 *    (counted per handler body).
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((f) => {
		const p = join(dir, f);
		return statSync(p).isDirectory() ? walk(p) : /\+(page\.server|server|layout\.server)\.ts$/.test(f) ? [p] : [];
	});
}

/** Splits a module into top-level handler bodies: `load`, each action key, GET/POST/…; returns [name, body]. */
function handlers(src: string): [string, string][] {
	const out: [string, string][] = [];
	const starts: { name: string; index: number }[] = [];
	for (const m of src.matchAll(/export const (load|GET|POST|PUT|PATCH|DELETE)\b/g)) starts.push({ name: m[1], index: m.index! });
	const actions = /export const actions[^=]*=\s*\{/.exec(src);
	if (actions) {
		const body = src.slice(actions.index + actions[0].length);
		for (const m of body.matchAll(/^\t([a-zA-Z0-9_]+): async/gm)) starts.push({ name: `action:${m[1]}`, index: actions.index + actions[0].length + m.index! });
	}
	starts.sort((a, b) => a.index - b.index);
	starts.forEach((s, i) => out.push([s.name, src.slice(s.index, starts[i + 1]?.index ?? src.length)]));
	return out;
}

const files = walk('src/routes/admin/(app)');

describe('every admin handler enforces a permission (§7.4)', () => {
	it('finds the admin modules', () => expect(files.length).toBeGreaterThan(30));
	for (const file of files) {
		const src = readFileSync(file, 'utf8');
		for (const [name, body] of handlers(src)) {
			// The layout load only needs a signed-in admin (enforced by hooks + its own 401); redirect-only loads are exempt.
			if (/\+layout\.server\.ts$/.test(file) || /^export const load = \(\) => redirect\(303, '\/admin\/[a-z/]+'\);?$/.test(body.trim())) continue;
			it(`${file.replace(/\\/g, '/').replace('src/routes/admin/(app)', '/admin')} → ${name}`, () => {
				const guarded = /requirePermission\(|can\(admin\.role, 'dashboard'\)|requireAdminPermission\(/.test(body) || /\bguard\(/.test(body);
				expect(guarded, 'missing requirePermission()').toBe(true);
			});
		}
	}
});

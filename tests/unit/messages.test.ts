import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

const areas = readdirSync('messages', { withFileTypes: true })
	.filter((d) => d.isDirectory())
	.map((d) => d.name);
const keys = (area: string, locale: string) =>
	Object.keys(JSON.parse(readFileSync(`messages/${area}/${locale}.json`, 'utf8')))
		.filter((k) => k !== '$schema')
		.sort();

describe('translations', () => {
	it('every area is registered in project.inlang', () => {
		const settings = readFileSync('project.inlang/settings.json', 'utf8');
		for (const a of areas) expect(settings, a).toContain(`./messages/${a}/{locale}.json`);
	});

	for (const area of areas) {
		it(`${area}: NL and FR have identical keys`, () => {
			expect(keys(area, 'fr')).toEqual(keys(area, 'nl'));
		});
		it(`${area}: no empty translations and same {placeholders}`, () => {
			const nl = JSON.parse(readFileSync(`messages/${area}/nl.json`, 'utf8'));
			const fr = JSON.parse(readFileSync(`messages/${area}/fr.json`, 'utf8'));
			for (const k of keys(area, 'nl')) {
				expect(String(nl[k]).trim(), `${area}.${k} nl`).not.toBe('');
				expect(String(fr[k]).trim(), `${area}.${k} fr`).not.toBe('');
				const ph = (s: string) => (String(s).match(/\{[a-zA-Z]+\}/g) ?? []).sort();
				expect(ph(fr[k]), `${area}.${k} placeholders`).toEqual(ph(nl[k]));
			}
		});
	}

	it('message keys are unique across areas', () => {
		const seen = new Map<string, string>();
		for (const a of areas) for (const k of keys(a, 'nl')) {
			expect(seen.get(k), `duplicate key ${k} in ${a} and ${seen.get(k)}`).toBeUndefined();
			seen.set(k, a);
		}
	});
});

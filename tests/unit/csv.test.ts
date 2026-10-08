import { describe, expect, it } from 'vitest';
import { CsvError, detectDelimiter, parseCsv, parseCsvRecords, recordsToCsv, toCsv } from '#lib/utils/csv.ts';

describe('parseCsv', () => {
	it('parses simple rows', () => {
		expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
			['a', 'b', 'c'],
			['1', '2', '3']
		]);
	});

	it('handles CRLF, CR and a missing trailing newline', () => {
		expect(parseCsv('a,b\r\n1,2\r3,4')).toEqual([
			['a', 'b'],
			['1', '2'],
			['3', '4']
		]);
	});

	it('handles quoted fields with delimiters, escaped quotes and newlines', () => {
		const text = 'name,desc\n"Ring, goud","Zegt ""ja""\nvoor altijd"\n';
		expect(parseCsv(text)).toEqual([
			['name', 'desc'],
			['Ring, goud', 'Zegt "ja"\nvoor altijd']
		]);
	});

	it('keeps empty fields and skips fully empty rows', () => {
		expect(parseCsv('a,,c\n\n,,\n1,2,')).toEqual([
			['a', '', 'c'],
			['1', '2', '']
		]);
		expect(parseCsv('a\n\nb', { skipEmptyRows: false })).toEqual([['a'], [''], ['b']]);
	});

	it('strips a UTF-8 BOM', () => {
		expect(parseCsv('﻿sku;stock\nX;1')).toEqual([
			['sku', 'stock'],
			['X', '1']
		]);
	});

	it('auto-detects semicolons (Belgian Excel) but respects an explicit delimiter', () => {
		expect(detectDelimiter('a;b;c\n1,5;2;3')).toBe(';');
		expect(detectDelimiter('a,b\n')).toBe(',');
		expect(detectDelimiter('"x;y",b,c')).toBe(',');
		expect(detectDelimiter('a\tb\tc')).toBe('\t');
		expect(parseCsv('price;name\n49,95;Ring')).toEqual([
			['price', 'name'],
			['49,95', 'Ring']
		]);
		expect(parseCsv('a;b', { delimiter: ',' })).toEqual([['a;b']]);
	});

	it('throws a CsvError with the line of an unterminated quote', () => {
		try {
			parseCsv('a,b\n1,"oops\n2,3');
			expect.unreachable();
		} catch (e) {
			expect(e).toBeInstanceOf(CsvError);
			expect((e as CsvError).line).toBe(2);
		}
	});

	it('maps records by lowercased header', () => {
		const { headers, records } = parseCsvRecords('SKU ; Stock\nA; 3 \nB\n');
		expect(headers).toEqual(['sku', 'stock']);
		expect(records).toEqual([
			{ sku: 'A', stock: '3' },
			{ sku: 'B', stock: '' }
		]);
	});
});

describe('toCsv', () => {
	it('quotes only when needed and uses CRLF', () => {
		expect(toCsv([['a', 'b,c', 'say "hi"', 'x\ny', 1, null, undefined]])).toBe('a,"b,c","say ""hi""","x\ny",1,,\r\n');
	});

	it('uses the chosen delimiter and an optional BOM', () => {
		expect(toCsv([['49,95', 'a;b']], { delimiter: ';', bom: true })).toBe('﻿49,95;"a;b"\r\n');
	});

	it('guards against formula injection for text cells only', () => {
		expect(toCsv([['=SUM(A1)', '+31', '@x', -5, 'ok']], { guardFormulas: true })).toBe("'=SUM(A1),'+31,'@x,-5,ok\r\n");
	});

	it('round-trips arbitrary content', () => {
		const rows = [
			['sku', 'naam', 'beschrijving'],
			['DEMO-1', 'Ring "Klaver"', 'Lijn 1\r\nLijn 2; met, tekens'],
			['DEMO-2', '', ' spatie ']
		];
		for (const delimiter of [',', ';'] as const) {
			expect(parseCsv(toCsv(rows, { delimiter }), { delimiter })).toEqual(rows);
		}
	});

	it('serializes records in column order', () => {
		expect(recordsToCsv(['b', 'a'] as const, [{ a: 1, b: 2 }, { a: 3 }])).toBe('b,a\r\n2,1\r\n,3\r\n');
	});
});

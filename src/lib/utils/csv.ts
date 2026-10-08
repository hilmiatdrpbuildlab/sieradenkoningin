/**
 * Small RFC 4180 CSV parser / serializer (client + server, no dependencies).
 * - Quoted fields with embedded delimiters, quotes ("") and line breaks.
 * - CRLF, LF and lone CR line endings; a UTF-8 BOM is ignored.
 * - Delimiter auto-detection between `,` and `;` (Belgian Excel exports use `;`).
 */
export type Delimiter = ',' | ';' | '\t';

export interface ParseOptions {
	delimiter?: Delimiter;
	/** Drop rows where every field is empty (default true). */
	skipEmptyRows?: boolean;
}

export class CsvError extends Error {
	constructor(
		message: string,
		public line: number
	) {
		super(message);
	}
}

/** Guess the delimiter from the first line (outside quotes). */
export function detectDelimiter(text: string): Delimiter {
	const counts = { ',': 0, ';': 0, '\t': 0 };
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (c === '"') quoted = !quoted;
		else if (!quoted && (c === '\n' || c === '\r')) break;
		else if (!quoted && (c === ',' || c === ';' || c === '\t')) counts[c]++;
	}
	if (counts[';'] > counts[','] && counts[';'] >= counts['\t']) return ';';
	if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t';
	return ',';
}

/** Parses CSV text into rows of string fields. Throws CsvError on an unterminated quote. */
export function parseCsv(input: string, options: ParseOptions = {}): string[][] {
	const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
	const delimiter = options.delimiter ?? detectDelimiter(text);
	const skipEmpty = options.skipEmptyRows ?? true;
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	let line = 1;
	let quoteLine = 1;
	let i = 0;

	const endRow = () => {
		row.push(field);
		field = '';
		if (!(skipEmpty && row.every((f) => f === ''))) rows.push(row);
		row = [];
	};

	while (i < text.length) {
		const c = text[i];
		if (quoted) {
			if (c === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i += 2;
					continue;
				}
				quoted = false;
				i++;
				continue;
			}
			if (c === '\n') line++;
			field += c;
			i++;
			continue;
		}
		if (c === '"' && field === '') {
			quoted = true;
			quoteLine = line;
			i++;
		} else if (c === delimiter) {
			row.push(field);
			field = '';
			i++;
		} else if (c === '\r' || c === '\n') {
			endRow();
			i += c === '\r' && text[i + 1] === '\n' ? 2 : 1;
			line++;
		} else {
			field += c;
			i++;
		}
	}
	if (quoted) throw new CsvError(`Niet-afgesloten aanhalingsteken (regel ${quoteLine})`, quoteLine);
	if (field !== '' || row.length) endRow();
	return rows;
}

/** Rows → objects keyed by the (trimmed, lowercased) header row. */
export function parseCsvRecords(input: string, options: ParseOptions = {}): { headers: string[]; records: Record<string, string>[] } {
	const [head, ...rest] = parseCsv(input, options);
	if (!head) return { headers: [], records: [] };
	const headers = head.map((h) => h.trim().toLowerCase());
	const records = rest.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
	return { headers, records };
}

function escapeField(value: unknown, delimiter: string, guardFormulas: boolean): string {
	if (value === null || value === undefined) return '';
	let s = String(value);
	// CSV injection: spreadsheet apps execute text cells starting with = + - @ as formulas.
	if (guardFormulas && typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
	return s.includes('"') || s.includes(delimiter) || s.includes('\n') || s.includes('\r') || /^\s|\s$/.test(s)
		? `"${s.replace(/"/g, '""')}"`
		: s;
}

export interface SerializeOptions {
	delimiter?: Delimiter;
	/** Prefix U+FEFF so Excel opens the file as UTF-8. */
	bom?: boolean;
	/** Prefix text cells starting with = + - @ with an apostrophe (exports opened in spreadsheets). */
	guardFormulas?: boolean;
}

/** Serializes rows (CRLF line endings, per RFC 4180). */
export function toCsv(rows: unknown[][], { delimiter = ',', bom = false, guardFormulas = false }: SerializeOptions = {}): string {
	const body = rows.map((r) => r.map((v) => escapeField(v, delimiter, guardFormulas)).join(delimiter)).join('\r\n') + '\r\n';
	return (bom ? '\ufeff' : '') + body;
}

/** Objects → CSV with the given column order as header. */
export function recordsToCsv<K extends string>(columns: readonly K[], records: Partial<Record<K, unknown>>[], options?: SerializeOptions): string {
	return toCsv([[...columns], ...records.map((r) => columns.map((c) => r[c]))], options);
}

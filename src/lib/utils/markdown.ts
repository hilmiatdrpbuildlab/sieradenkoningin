/**
 * Minimal, SAFE markdown → HTML for CMS rich text (P4-01). All input is HTML-escaped first; only
 * this whitelist is produced: ## / ### headings, paragraphs, - lists, 1. lists, **bold**, *italic*,
 * [text](url) links (http(s), mailto, tel, or site-relative only) and line breaks.
 */
const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function safeHref(url: string): string | null {
	const u = url.trim();
	if (/^(https?:\/\/|mailto:|tel:)/i.test(u) || (u.startsWith('/') && !u.startsWith('//'))) return u;
	return null;
}

function inline(text: string): string {
	let out = escape(text);
	out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => {
		const h = safeHref(href.replace(/&amp;/g, '&'));
		if (!h) return label;
		const ext = /^https?:\/\//i.test(h);
		return `<a href="${escape(h)}"${ext ? ' rel="noopener noreferrer" target="_blank"' : ''}>${label}</a>`;
	});
	out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
	return out;
}

export function markdownToHtml(md: string | null | undefined): string {
	if (!md) return '';
	const blocks = md.replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
	return blocks
		.map((block) => {
			const lines = block.split('\n');
			if (/^###\s/.test(block)) return `<h3>${inline(block.replace(/^###\s+/, ''))}</h3>`;
			if (/^##\s/.test(block)) return `<h2>${inline(block.replace(/^##\s+/, ''))}</h2>`;
			if (lines.every((l) => /^\s*[-*]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
			if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
			return `<p>${lines.map(inline).join('<br>')}</p>`;
		})
		.join('\n');
}

/** Plain-text excerpt (meta descriptions). */
export function markdownToText(md: string | null | undefined, max = 160): string {
	if (!md) return '';
	const t = md
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/[#*_>-]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t;
}

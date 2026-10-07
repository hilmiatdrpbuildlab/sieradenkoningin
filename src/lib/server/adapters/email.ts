/**
 * Transactional email adapter (decision D5: Postmark).
 * - `postmark`: Postmark /email endpoint.
 * - `mock`: writes the rendered HTML to `.data/emails/<time>-<template>-<to>.html` for review.
 */
export interface OutgoingEmail {
	to: string;
	subject: string;
	html: string;
	text: string;
	template: string;
	replyTo?: string;
	attachments?: { name: string; contentType: string; content: Uint8Array }[];
}

export interface EmailAdapter {
	provider: 'postmark' | 'mock';
	send(email: OutgoingEmail): Promise<{ id: string }>;
}

const toBase64 = (bytes: Uint8Array) => {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s);
};

export function createEmail(token: string, from: string): EmailAdapter {
	if (!token) return createMockEmail(from);
	return {
		provider: 'postmark',
		async send(email) {
			const res = await fetch('https://api.postmarkapp.com/email', {
				method: 'POST',
				headers: { 'x-postmark-server-token': token, 'content-type': 'application/json', accept: 'application/json' },
				body: JSON.stringify({
					From: from,
					To: email.to,
					Subject: email.subject,
					HtmlBody: email.html,
					TextBody: email.text,
					ReplyTo: email.replyTo,
					Tag: email.template,
					MessageStream: 'outbound',
					Attachments: email.attachments?.map((a) => ({ Name: a.name, ContentType: a.contentType, Content: toBase64(a.content) }))
				})
			});
			if (!res.ok) throw new Error(`Postmark ${res.status}: ${await res.text()}`);
			const json = (await res.json()) as { MessageID: string };
			return { id: json.MessageID };
		}
	};
}

function createMockEmail(from: string): EmailAdapter {
	return {
		provider: 'mock',
		async send(email) {
			const { mkdir, writeFile } = await import('node:fs/promises');
			const id = `mock-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
			const safe = email.to.replace(/[^a-z0-9@._-]/gi, '_');
			await mkdir('.data/emails', { recursive: true });
			const header = `<!-- from: ${from} | to: ${email.to} | subject: ${email.subject.replace(/--/g, '—')} -->\n`;
			await writeFile(`.data/emails/${id}-${email.template}-${safe}.html`, header + email.html);
			return { id };
		}
	};
}

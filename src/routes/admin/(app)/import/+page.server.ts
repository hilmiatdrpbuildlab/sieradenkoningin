import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { can } from '#lib/permissions.ts';
import { commitImport, dryRun, IMPORT_COLUMNS, ImportError } from '#lib/server/services/import.ts';

const MAX_BYTES = 5 * 1024 * 1024;

export const load: PageServerLoad = async ({ locals }) => {
	const admin = requirePermission(locals, 'catalog:read');
	return {
		crumbs: [{ label: 'Catalogus' }, { label: 'Import / export' }],
		columns: [...IMPORT_COLUMNS],
		canWrite: can(admin.role, 'catalog:write') && can(admin.role, 'inventory:write')
	};
};

/** CSV from the uploaded file, or (on commit) from the hidden field carried over from the preview. */
async function readCsv(fd: FormData): Promise<string | { error: string }> {
	const file = fd.get('file');
	if (file instanceof File && file.size > 0) {
		if (file.size > MAX_BYTES) return { error: 'Bestand is groter dan 5 MB' };
		return file.text();
	}
	const text = fd.get('csv');
	if (typeof text === 'string' && text.trim()) return text.length > MAX_BYTES ? { error: 'Bestand is groter dan 5 MB' } : text;
	return { error: 'Kies een CSV-bestand' };
}

export const actions: Actions = {
	preview: async ({ locals, request }) => {
		requirePermission(locals, 'catalog:write');
		requirePermission(locals, 'inventory:write');
		const fd = await request.formData();
		const csv = await readCsv(fd);
		if (typeof csv !== 'string') return fail(400, { step: 'preview' as const, message: csv.error });
		try {
			const plan = await dryRun(locals.db, csv);
			return { step: 'preview' as const, csv, fileName: fd.get('file') instanceof File ? (fd.get('file') as File).name : 'import.csv', rows: plan.rows, summary: plan.summary };
		} catch (e) {
			if (e instanceof ImportError) return fail(400, { step: 'preview' as const, message: e.message });
			throw e;
		}
	},

	commit: async ({ locals, request }) => {
		requirePermission(locals, 'catalog:write');
		requirePermission(locals, 'inventory:write');
		const csv = await readCsv(await request.formData());
		if (typeof csv !== 'string') return fail(400, { step: 'preview' as const, message: csv.error });
		try {
			const result = await commitImport(locals.db, locals, csv);
			return { step: 'done' as const, rows: result.rows, summary: result.summary };
		} catch (e) {
			if (e instanceof ImportError) return fail(400, { step: 'preview' as const, message: e.message });
			throw e;
		}
	}
};

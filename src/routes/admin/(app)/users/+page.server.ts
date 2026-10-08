import { fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { PUBLIC_SITE_URL } from '$app/env/public';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { adminUsers, emailLog } from '#lib/server/db/schema.ts';
import { ROLES, ROLE_LABELS, type Role } from '#lib/permissions.ts';
import { audit } from '#lib/server/services/audit.ts';
import { createInvite, otherActiveOwners, revokeSessions, wouldRemoveLastOwner } from '#lib/server/services/admin-users.ts';
import { fieldErrors } from '#lib/schemas/common.ts';

const Invite = z.object({
	email: z.string().trim().toLowerCase().email('Ongeldig e-mailadres'),
	name: z.string().trim().min(2, 'Naam is verplicht').max(80),
	role: z.enum(ROLES)
});

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'users');
	const users = await locals.db.select().from(adminUsers).orderBy(asc(adminUsers.name));
	return {
		users: users.map((u) => ({
			id: u.id,
			name: u.name,
			email: u.email,
			role: u.role,
			active: u.active,
			twoFactor: !!u.totpEnabledAt,
			invited: !u.passwordHash,
			inviteExpiresAt: u.inviteExpiresAt,
			lastLoginAt: u.lastLoginAt
		})),
		roles: ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
		me: locals.admin!.id,
		crumbs: [{ label: 'Gebruikers' }]
	};
};

async function loadUser(locals: App.Locals, id: string) {
	const [u] = await locals.db.select().from(adminUsers).where(eq(adminUsers.id, id));
	return u;
}

export const actions: Actions = {
	invite: async ({ request, locals }) => {
		requirePermission(locals, 'users');
		const raw = Object.fromEntries(await request.formData());
		const parsed = Invite.safeParse(raw);
		if (!parsed.success) return fail(400, { form: 'invite', errors: fieldErrors(parsed.error), values: raw });
		const r = await createInvite(locals.db, parsed.data);
		if (!r.ok) return fail(400, { form: 'invite', errors: { email: ['Er bestaat al een actief account met dit e-mailadres.'] }, values: raw });
		const link = `${PUBLIC_SITE_URL.replace(/\/$/, '')}/admin/invite/${r.token}`;
		const html = `<div style="font-family:Arial,sans-serif;color:#492520;max-width:560px"><h1 style="font-family:Georgia,serif;font-weight:400;color:#391617">Welkom bij Sieradenkoningin Beheer</h1><p>${locals.admin!.name} heeft je uitgenodigd als <strong>${ROLE_LABELS[parsed.data.role]}</strong>.</p><p><a href="${link}" style="display:inline-block;background:#391617;color:#ebe1d8;padding:12px 20px;text-decoration:none">Account activeren</a></p><p style="font-size:12px;color:#875543">Deze link is 7 dagen geldig. Je stelt een wachtwoord en tweestapsverificatie in.</p></div>`;
		let status = 'sent';
		let providerId: string | null = null;
		try {
			providerId = (await locals.email.send({ to: parsed.data.email, subject: 'Uitnodiging — Sieradenkoningin Beheer', html, text: `Activeer je account: ${link}`, template: 'admin-invite' })).id;
		} catch (e) {
			status = 'failed';
			console.error('invite email failed', e);
		}
		await locals.db.insert(emailLog).values({ to: parsed.data.email, template: 'admin-invite', locale: 'nl', subject: 'Uitnodiging', providerId, status, refId: r.user.id });
		await audit(locals.db, locals, { action: 'invite', entity: 'admin_user', entityId: r.user.id, diff: { email: parsed.data.email, role: parsed.data.role } });
		return { form: 'invite', invited: parsed.data.email, link: locals.email.provider === 'mock' ? link : null };
	},

	role: async ({ request, locals }) => {
		requirePermission(locals, 'users');
		const fd = await request.formData();
		const id = String(fd.get('id'));
		const role = String(fd.get('role')) as Role;
		if (!ROLES.includes(role)) return fail(400, { form: 'row', error: 'Ongeldige rol' });
		return locals.db.transaction(async (tx) => {
			const [u] = await tx.select().from(adminUsers).where(eq(adminUsers.id, id)).for('update');
			if (!u) return fail(404, { form: 'row', error: 'Gebruiker niet gevonden' });
			if (wouldRemoveLastOwner(u, { role }, await otherActiveOwners(tx, id))) return fail(400, { form: 'row', id, error: 'De laatste eigenaar kan geen andere rol krijgen.' });
			await tx.update(adminUsers).set({ role, updatedAt: new Date() }).where(eq(adminUsers.id, id));
			await audit(tx, locals, { action: 'change_role', entity: 'admin_user', entityId: id, diff: { role: [u.role, role] } });
			return { form: 'row', saved: true };
		});
	},

	toggleActive: async ({ request, locals }) => {
		requirePermission(locals, 'users');
		const id = String((await request.formData()).get('id'));
		return locals.db.transaction(async (tx) => {
			const [u] = await tx.select().from(adminUsers).where(eq(adminUsers.id, id)).for('update');
			if (!u) return fail(404, { form: 'row', error: 'Gebruiker niet gevonden' });
			const active = !u.active;
			if (wouldRemoveLastOwner(u, { active }, await otherActiveOwners(tx, id))) return fail(400, { form: 'row', id, error: 'De laatste eigenaar kan niet gedeactiveerd worden.' });
			await tx.update(adminUsers).set({ active, updatedAt: new Date() }).where(eq(adminUsers.id, id));
			if (!active) await revokeSessions(tx, id);
			await audit(tx, locals, { action: active ? 'activate' : 'deactivate', entity: 'admin_user', entityId: id });
			return { form: 'row', saved: true };
		});
	},

	reset2fa: async ({ request, locals }) => {
		requirePermission(locals, 'users');
		const id = String((await request.formData()).get('id'));
		const u = await loadUser(locals, id);
		if (!u) return fail(404, { form: 'row', error: 'Gebruiker niet gevonden' });
		await locals.db.update(adminUsers).set({ totpSecret: null, totpEnabledAt: null, recoveryCodes: null, updatedAt: new Date() }).where(eq(adminUsers.id, id));
		await revokeSessions(locals.db, id);
		await audit(locals.db, locals, { action: 'reset_2fa', entity: 'admin_user', entityId: id });
		return { form: 'row', saved: true };
	}
};

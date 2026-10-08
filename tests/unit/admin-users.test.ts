import { describe, expect, it } from 'vitest';
import { wouldRemoveLastOwner } from '#lib/server/services/admin-users.ts';
import { isValidBeEnterpriseNumber } from '#lib/schemas/settings.ts';

describe('last owner protection (P3-10)', () => {
	const owner = { role: 'owner' as const, active: true };
	it('blocks demoting or deactivating the last active owner', () => {
		expect(wouldRemoveLastOwner(owner, { role: 'editor' }, 0)).toBe(true);
		expect(wouldRemoveLastOwner(owner, { active: false }, 0)).toBe(true);
	});
	it('allows it when another active owner exists', () => {
		expect(wouldRemoveLastOwner(owner, { role: 'editor' }, 1)).toBe(false);
		expect(wouldRemoveLastOwner(owner, { active: false }, 1)).toBe(false);
	});
	it('ignores non-owners and no-op changes', () => {
		expect(wouldRemoveLastOwner({ role: 'editor', active: true }, { active: false }, 0)).toBe(false);
		expect(wouldRemoveLastOwner(owner, { role: 'owner' }, 0)).toBe(false);
	});
});

describe('Belgian enterprise number', () => {
	it('validates the mod-97 check digits', () => {
		expect(isValidBeEnterpriseNumber('0123.456.749')).toBe(true);
		expect(isValidBeEnterpriseNumber('BE0123456749')).toBe(true);
		expect(isValidBeEnterpriseNumber('0123.456.748')).toBe(false);
		expect(isValidBeEnterpriseNumber('12345')).toBe(false);
	});
});

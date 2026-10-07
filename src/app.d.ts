import type { DB } from '#lib/server/db/index.ts';
import type { Storage } from '#lib/server/adapters/storage.ts';
import type { PaymentsAdapter } from '#lib/server/adapters/payments.ts';
import type { ShippingAdapter } from '#lib/server/adapters/shipping.ts';
import type { EmailAdapter } from '#lib/server/adapters/email.ts';
import type { NewsletterAdapter } from '#lib/server/adapters/newsletter.ts';
import type { Role } from '#lib/permissions.ts';
import type { Lang } from '#lib/i18n/paths.ts';

declare global {
	namespace App {
		interface Error {
			message: string;
			status?: number;
		}
		interface Locals {
			db: DB;
			storage: Storage;
			payments: PaymentsAdapter;
			shipping: ShippingAdapter;
			email: EmailAdapter;
			newsletter: NewsletterAdapter;
			lang: Lang;
			ip: string;
			admin?: { id: string; name: string; email: string; role: Role; sessionId: string };
			customer?: { id: string; email: string; firstName: string | null; lastName: string | null; locale: string };
		}
		interface PageState {
			gallery?: number;
		}
		interface Platform {
			env?: Record<string, unknown>;
			ctx?: { waitUntil(promise: Promise<unknown>): void };
		}
	}
}

export {};

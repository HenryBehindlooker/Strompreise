import { json } from '@sveltejs/kit';
import { getDatabase } from '#lib/server/db';
import { apiError, nowSec } from '#lib/server/api/http';
import { PushSubscriptionSchema, PushUnsubscribeSchema } from '#lib/server/api/schemas';
import { pushConfigFromEnv, removeSubscription, saveSubscription } from '#lib/server/push/service';
import type { RequestHandler } from './$types';

const NO_STORE = { 'cache-control': 'no-store' };

/** Abonnement speichern. Die Eingabe wird vor der Konfigurationsprüfung validiert. */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const parsed = PushSubscriptionSchema.safeParse(body);
	if (!parsed.success) {
		return apiError(parsed.error, 400);
	}
	try {
		if (!pushConfigFromEnv(process.env)) {
			return json({ error: 'push_disabled' }, { status: 503, headers: NO_STORE });
		}
		const { db } = getDatabase();
		saveSubscription(db, parsed.data, nowSec());
		return json({ ok: true }, { status: 201, headers: NO_STORE });
	} catch (error) {
		return apiError(error);
	}
};

/** Abonnement entfernen. */
export const DELETE: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const parsed = PushUnsubscribeSchema.safeParse(body);
	if (!parsed.success) {
		return apiError(parsed.error, 400);
	}
	try {
		const { db } = getDatabase();
		const removed = removeSubscription(db, parsed.data.endpoint);
		return json({ removed }, { headers: NO_STORE });
	} catch (error) {
		return apiError(error);
	}
};

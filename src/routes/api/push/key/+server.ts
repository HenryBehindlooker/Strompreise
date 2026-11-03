import { json } from '@sveltejs/kit';
import { pushConfigFromEnv } from '#lib/server/push/service';
import { apiError } from '#lib/server/api/http';
import type { RequestHandler } from './$types';

/** Öffentlicher VAPID-Schlüssel für den Browser. null, wenn Push nicht konfiguriert ist. */
export const GET: RequestHandler = () => {
	try {
		const config = pushConfigFromEnv(process.env);
		return json(
			{ publicKey: config?.publicKey ?? null },
			{ headers: { 'cache-control': 'no-store' } }
		);
	} catch (error) {
		return apiError(error);
	}
};

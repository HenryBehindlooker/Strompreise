import { getDatabase } from '#lib/server/db';
import { buildWindows } from '#lib/server/api/queries';
import { WindowsQuerySchema } from '#lib/server/api/schemas';
import { apiError, CACHE, nowSec } from '#lib/server/api/http';
import { ampelConfigFromEnv } from '#lib/server/logic/ampel';
import { buildIcs } from '#lib/server/logic/ics';
import type { RequestHandler } from './$types';

/** Beste Zeitfenster als Kalenderdatei (ICS) zum Abonnieren oder Importieren. */
export const GET: RequestHandler = ({ url }) => {
	const parsed = WindowsQuerySchema.safeParse(Object.fromEntries(url.searchParams));
	if (!parsed.success) {
		return apiError(parsed.error, 400);
	}
	try {
		const { db } = getDatabase();
		const now = nowSec();
		const body = buildWindows(db, now, parsed.data, ampelConfigFromEnv(process.env));
		return new Response(buildIcs(body.windows, now), {
			headers: {
				'content-type': 'text/calendar; charset=utf-8',
				'content-disposition': 'inline; filename="strom-ampel-zeitfenster.ics"',
				'cache-control': CACHE.windows
			}
		});
	} catch (error) {
		return apiError(error);
	}
};

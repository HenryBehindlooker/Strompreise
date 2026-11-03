import { getDatabase } from '#lib/server/db';
import { buildNow } from '#lib/server/api/queries';
import { NowResponseSchema } from '#lib/server/api/schemas';
import { apiError, apiJson, CACHE, nowSec } from '#lib/server/api/http';
import { ampelConfigFromEnv } from '#lib/server/logic/ampel';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	try {
		const { db } = getDatabase();
		const config = ampelConfigFromEnv(process.env);
		return apiJson(NowResponseSchema.parse(buildNow(db, nowSec(), config)), CACHE.now);
	} catch (error) {
		return apiError(error);
	}
};

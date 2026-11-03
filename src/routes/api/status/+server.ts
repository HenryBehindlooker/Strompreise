import { getDatabase } from '#lib/server/db';
import { buildStatus } from '#lib/server/api/queries';
import { StatusResponseSchema } from '#lib/server/api/schemas';
import { apiError, apiJson, CACHE, nowSec } from '#lib/server/api/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	try {
		const { db } = getDatabase();
		return apiJson(StatusResponseSchema.parse(buildStatus(db, nowSec())), CACHE.status);
	} catch (error) {
		return apiError(error);
	}
};

import { getDatabase } from '$lib/server/db';
import { buildWindows } from '$lib/server/api/queries';
import { WindowsQuerySchema, WindowsResponseSchema } from '$lib/server/api/schemas';
import { apiError, apiJson, CACHE, nowSec } from '$lib/server/api/http';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const parsed = WindowsQuerySchema.safeParse(Object.fromEntries(url.searchParams));
	if (!parsed.success) {
		return apiError(parsed.error, 400);
	}
	try {
		const { db } = getDatabase();
		const body = buildWindows(db, nowSec(), parsed.data);
		return apiJson(WindowsResponseSchema.parse(body), CACHE.windows);
	} catch (error) {
		return apiError(error);
	}
};

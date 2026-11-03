import { z } from 'zod';

/* ---------- Gemeinsame Bausteine ---------- */

export const FreshnessSchema = z.object({
	state: z.enum(['fresh', 'stale', 'unknown']),
	label: z.string(),
	ageMinutes: z.number().int().nonnegative().nullable()
});

const unixSec = z.number().int().nonnegative();

/* ---------- /api/now ---------- */

export const NowResponseSchema = z.object({
	generatedAt: unixSec,
	generatedAtIso: z.iso.datetime(),
	/** Erzeugungsmix des letzten verfügbaren Intervalls, Werte in MW je Erzeugungsart. */
	mix: z
		.object({
			ts: unixSec,
			values: z.record(z.string(), z.number())
		})
		.nullable(),
	/** Preis des Intervalls, das `generatedAt` enthält. */
	price: z
		.object({
			ts: unixSec,
			resolutionSec: z.number().int().positive(),
			eurMwh: z.number()
		})
		.nullable(),
	/** Erneuerbaren-Anteil (Prognose) für das laufende Intervall, in Prozent. */
	renewableSharePct: z.number().nullable(),
	/** Ampelfarbe folgt mit der Score-Logik (Phase 4). Bis dahin immer null. */
	ampel: z.null(),
	datenstand: z.record(z.string(), FreshnessSchema)
});
export type NowResponse = z.infer<typeof NowResponseSchema>;

/* ---------- /api/forecast ---------- */

export const ForecastResponseSchema = z.object({
	generatedAt: unixSec,
	from: unixSec,
	to: unixSec,
	prices: z.array(
		z.object({ ts: unixSec, resolutionSec: z.number().int().positive(), eurMwh: z.number() })
	),
	renewableForecast: z.array(
		z.object({ ts: unixSec, resolutionSec: z.number().int().positive(), pct: z.number() })
	)
});
export type ForecastResponse = z.infer<typeof ForecastResponseSchema>;

/* ---------- /api/windows ---------- */

export const WindowSchema = z.object({
	from: unixSec,
	to: unixSec,
	score: z.number(),
	avgEurMwh: z.number().nullable(),
	avgRenewableSharePct: z.number().nullable()
});

export const WindowsResponseSchema = z.object({
	generatedAt: unixSec,
	durationSec: z.number().int().positive(),
	count: z.number().int().positive(),
	/** false, solange die Score-Logik (Phase 4) noch nicht angebunden ist. */
	ready: z.boolean(),
	note: z.string().nullable(),
	windows: z.array(WindowSchema)
});
export type WindowsResponse = z.infer<typeof WindowsResponseSchema>;

/* ---------- /api/status ---------- */

export const StatusResponseSchema = z.object({
	generatedAt: unixSec,
	jobs: z.record(
		z.string(),
		z.object({
			freshness: FreshnessSchema,
			lastError: z.string().nullable(),
			lastAttemptTs: unixSec.nullable()
		})
	)
});
export type StatusResponse = z.infer<typeof StatusResponseSchema>;

/* ---------- Query-Parameter ---------- */

const DURATION_RE = /^(\d{1,3})(h|min|m)$/;
const MIN_DURATION_SEC = 15 * 60;
const MAX_DURATION_SEC = 12 * 3600;

/** "3h", "90min" oder "90m" in Sekunden, sonst null. */
export function parseDurationSec(input: string): number | null {
	const match = DURATION_RE.exec(input.trim());
	if (!match) {
		return null;
	}
	const value = Number(match[1]);
	return match[2] === 'h' ? value * 3600 : value * 60;
}

export const WindowsQuerySchema = z.object({
	duration: z
		.string()
		.default('3h')
		.transform((value, ctx) => {
			const sec = parseDurationSec(value);
			if (sec === null || sec < MIN_DURATION_SEC || sec > MAX_DURATION_SEC) {
				ctx.addIssue({
					code: 'custom',
					message: 'duration muss z. B. 3h oder 90min sein (15 min bis 12 h)'
				});
				return z.NEVER;
			}
			return sec;
		}),
	count: z.coerce.number().int().min(1).max(10).default(3)
});
export type WindowsQuery = z.infer<typeof WindowsQuerySchema>;

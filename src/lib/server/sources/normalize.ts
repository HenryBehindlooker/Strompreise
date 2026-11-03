import type { NormalizedPoint, TimeRange } from './types';

/**
 * Sortiert nach Zeitstempel und entfernt Dubletten je `ts`.
 * Bei Dubletten gewinnt der später übergebene Eintrag (idempotente Upserts).
 */
export function sortAndDedupe(points: readonly NormalizedPoint[]): NormalizedPoint[] {
	const byTs = new Map<number, NormalizedPoint>();
	for (const point of points) {
		byTs.set(point.ts, point);
	}
	return [...byTs.values()].sort((a, b) => a.ts - b.ts);
}

/**
 * Erwartete Intervall-Startzeitpunkte im Bereich `range` (UTC, `to` exklusiv).
 * Rechnet nur in Sekunden, daher ist die Zeitumstellung in Europe/Berlin kein Problem.
 */
export function expectedSlots(range: TimeRange, resolutionSec: number): number[] {
	if (!Number.isInteger(resolutionSec) || resolutionSec <= 0) {
		throw new RangeError(`resolutionSec muss eine positive ganze Zahl sein, war ${resolutionSec}`);
	}
	const slots: number[] = [];
	for (let ts = range.from; ts < range.to; ts += resolutionSec) {
		slots.push(ts);
	}
	return slots;
}

export interface Gap {
	/** Erster fehlender Zeitstempel der Lücke. */
	from: number;
	/** Letzter fehlender Zeitstempel der Lücke. */
	to: number;
	/** Anzahl fehlender Intervalle. */
	missingSlots: number;
}

/**
 * Findet Lücken in einer Zeitreihe bezogen auf ein erwartetes Raster.
 * Punkte außerhalb von `range` werden ignoriert.
 */
export function findGaps(
	points: readonly NormalizedPoint[],
	range: TimeRange,
	resolutionSec: number
): Gap[] {
	const present = new Set(points.map((p) => p.ts));
	const gaps: Gap[] = [];
	let current: Gap | null = null;

	for (const slot of expectedSlots(range, resolutionSec)) {
		if (present.has(slot)) {
			if (current) {
				gaps.push(current);
				current = null;
			}
			continue;
		}
		if (current) {
			current.to = slot;
			current.missingSlots += 1;
		} else {
			current = { from: slot, to: slot, missingSlots: 1 };
		}
	}
	if (current) {
		gaps.push(current);
	}
	return gaps;
}

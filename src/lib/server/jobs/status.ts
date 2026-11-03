export type FreshnessState = 'fresh' | 'stale' | 'unknown';

export interface Freshness {
	state: FreshnessState;
	/** Anzeigetext, z. B. "Daten frisch" oder "veraltet seit 45 Min". */
	label: string;
	/** Minuten seit dem letzten erfolgreichen Abruf, sonst null. */
	ageMinutes: number | null;
}

/**
 * Frische eines Datensatzes aus dem Zeitpunkt des letzten erfolgreichen Abrufs.
 * `staleAfterSec` ist die Toleranz, bis zu der ein Abruf noch als frisch gilt.
 */
export function describeFreshness(
	lastOkTs: number | null,
	nowSec: number,
	staleAfterSec: number
): Freshness {
	if (lastOkTs === null) {
		return { state: 'unknown', label: 'keine Daten', ageMinutes: null };
	}
	const ageSec = Math.max(0, nowSec - lastOkTs);
	const ageMinutes = Math.floor(ageSec / 60);
	if (ageSec <= staleAfterSec) {
		return { state: 'fresh', label: 'Daten frisch', ageMinutes };
	}
	return { state: 'stale', label: `veraltet seit ${ageMinutes} Min`, ageMinutes };
}

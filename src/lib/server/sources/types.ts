/**
 * Gemeinsames Format aller Datenquellen.
 *
 * - `ts` ist ein Unix-Zeitstempel in Sekunden (UTC) und markiert den Beginn des Intervalls.
 * - `resolutionSec` ist die Länge des Intervalls in Sekunden. Sie wird nicht als fix
 *   1 h angenommen: Preise können auf 15-Minuten-Raster liegen.
 * - `values` enthält je Kennzahl (z. B. Erzeugungsart oder "price") einen Zahlenwert.
 */
export interface NormalizedPoint {
	ts: number;
	resolutionSec: number;
	values: Record<string, number>;
}

/** Zeitfenster in Unix-Sekunden (UTC), `to` ist exklusiv. */
export interface TimeRange {
	from: number;
	to: number;
}

export interface EnergySource {
	/** Kurzname der Quelle für Logs und `fetch_log`, z. B. "energy-charts" oder "smard". */
	readonly name: string;

	getGenerationMix(from: number, to: number): Promise<NormalizedPoint[]>;
	getPrices(from: number, to: number): Promise<NormalizedPoint[]>;
	getRenewableShareForecast(from: number, to: number): Promise<NormalizedPoint[]>;
}

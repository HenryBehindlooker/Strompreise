import type { EnergySource } from './types';

/**
 * Konfigurierte Datenquellen in Prioritätsreihenfolge.
 * Die Adapter (Energy-Charts primär, SMARD als Fallback) folgen in Phase 1.
 */
export function getSources(): EnergySource[] {
	return [];
}

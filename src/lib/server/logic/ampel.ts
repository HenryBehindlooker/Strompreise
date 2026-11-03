/**
 * Ampel-Logik als reine Funktionen (keine DB, keine Zeitquelle außer den übergebenen Werten).
 *
 * Score je Intervall = wPreis × (1 − Preis-Perzentil) + wEE × EE-Anteil
 *   - Preis-Perzentil: Mittelrang des Preises unter allen bewerteten Intervallen
 *     (negative Preise landen dadurch automatisch ganz unten und bekommen volle Punktzahl).
 *   - EE-Anteil: Prognose in Prozent, auf 0–1 begrenzt.
 * Fehlt eine Komponente, wird der Score nur aus der anderen berechnet (Gewichte werden
 * neu verteilt). Fehlen beide, ist der Score null und die Ampel "unbekannt".
 *
 * Grün ≥ green, Gelb ≥ yellow, sonst Rot.
 */

export type Farbe = 'gruen' | 'gelb' | 'rot';
export type Symbol = '✓' | '!' | '✕';

export interface AmpelConfig {
	weights: { price: number; renewable: number };
	thresholds: { green: number; yellow: number };
}

export const DEFAULT_AMPEL_CONFIG: AmpelConfig = {
	weights: { price: 0.5, renewable: 0.5 },
	thresholds: { green: 0.66, yellow: 0.33 }
};

/** Prüft die Konfiguration und wirft bei ungültigen Werten. */
export function validateAmpelConfig(config: AmpelConfig): AmpelConfig {
	const { price, renewable } = config.weights;
	for (const [name, value] of [
		['Gewicht Preis', price],
		['Gewicht EE', renewable]
	] as const) {
		if (!Number.isFinite(value) || value < 0) {
			throw new RangeError(`${name} muss eine Zahl ≥ 0 sein, war ${value}`);
		}
	}
	if (price + renewable <= 0) {
		throw new RangeError('Mindestens ein Gewicht muss größer als 0 sein');
	}
	const { green, yellow } = config.thresholds;
	if (!(yellow >= 0 && green <= 1 && yellow < green)) {
		throw new RangeError(`Schwellen müssen 0 ≤ gelb < grün ≤ 1 erfüllen, war ${yellow} / ${green}`);
	}
	return config;
}

/**
 * Liest die Konfiguration aus Umgebungsvariablen. Nicht gesetzte Werte nehmen den Standard.
 * AMPEL_WEIGHT_PRICE, AMPEL_WEIGHT_RENEWABLE, AMPEL_GREEN_MIN, AMPEL_YELLOW_MIN
 */
export function ampelConfigFromEnv(env: Record<string, string | undefined>): AmpelConfig {
	const num = (key: string, fallback: number): number => {
		const raw = env[key];
		if (raw === undefined || raw.trim() === '') {
			return fallback;
		}
		const value = Number(raw);
		if (!Number.isFinite(value)) {
			throw new RangeError(`${key} muss eine Zahl sein, war "${raw}"`);
		}
		return value;
	};
	const d = DEFAULT_AMPEL_CONFIG;
	return validateAmpelConfig({
		weights: {
			price: num('AMPEL_WEIGHT_PRICE', d.weights.price),
			renewable: num('AMPEL_WEIGHT_RENEWABLE', d.weights.renewable)
		},
		thresholds: {
			green: num('AMPEL_GREEN_MIN', d.thresholds.green),
			yellow: num('AMPEL_YELLOW_MIN', d.thresholds.yellow)
		}
	});
}

/** Ein bewertbares Intervall. `priceEurMwh` und `renewablePct` können fehlen. */
export interface Slot {
	ts: number;
	resolutionSec: number;
	priceEurMwh: number | null;
	renewablePct: number | null;
}

export interface ScoredSlot extends Slot {
	score: number | null;
	farbe: Farbe | null;
}

/**
 * Mittelrang-Perzentil des Werts `value` in `sample`, im Bereich 0–1.
 * Gleichstand zählt zur Hälfte, damit Werte bei identischen Preisen gleich bewertet werden.
 * Für eine leere Stichprobe ist das Ergebnis 0.5 (neutral).
 */
export function percentileRank(value: number, sample: readonly number[]): number {
	if (sample.length === 0) {
		return 0.5;
	}
	let less = 0;
	let equal = 0;
	for (const v of sample) {
		if (v < value) less += 1;
		else if (v === value) equal += 1;
	}
	return (less + equal / 2) / sample.length;
}

export function colorFor(score: number | null, config: AmpelConfig): Farbe | null {
	if (score === null) return null;
	if (score >= config.thresholds.green) return 'gruen';
	if (score >= config.thresholds.yellow) return 'gelb';
	return 'rot';
}

/** Bewertet alle Intervalle. Das Preis-Perzentil bezieht sich auf die übergebene Menge. */
export function scoreSlots(slots: readonly Slot[], config: AmpelConfig): ScoredSlot[] {
	validateAmpelConfig(config);
	const prices = slots.map((s) => s.priceEurMwh).filter((p): p is number => p !== null);
	const { price: wPrice, renewable: wRenewable } = config.weights;

	return slots.map((slot) => {
		const priceTerm =
			slot.priceEurMwh === null ? null : 1 - percentileRank(slot.priceEurMwh, prices);
		const renewableTerm =
			slot.renewablePct === null ? null : Math.min(1, Math.max(0, slot.renewablePct / 100));

		let score: number | null = null;
		const parts: [number, number][] = [];
		if (priceTerm !== null) parts.push([wPrice, priceTerm]);
		if (renewableTerm !== null) parts.push([wRenewable, renewableTerm]);
		const totalWeight = parts.reduce((sum, [w]) => sum + w, 0);
		if (parts.length > 0 && totalWeight > 0) {
			score = parts.reduce((sum, [w, t]) => sum + w * t, 0) / totalWeight;
		}
		return { ...slot, score, farbe: colorFor(score, config) };
	});
}

const SYMBOL: Record<Farbe, Symbol> = { gruen: '✓', gelb: '!', rot: '✕' };

const SENTENCE: Record<Farbe, string> = {
	gruen: 'Gerade günstig & grün',
	gelb: 'Mittelmäßig – nur bei Bedarf verbrauchen',
	rot: 'Teuer & wenig Erneuerbare – besser später'
};

export interface AmpelState {
	farbe: Farbe | null;
	symbol: Symbol | null;
	/** Vollständiger Satz inkl. Zeitangabe, z. B. "Gerade günstig & grün – bis ca. 15:30". */
	text: string;
	/** Beginn des nächsten Intervalls mit anderer Farbe, Unix-Sekunden. Null = bis zum Horizontende. */
	bisTs: number | null;
	/** Beginn des aktuell gültigen Intervalls. */
	slotTs: number | null;
}

/** Uhrzeit HH:MM in Europe/Berlin. */
export function formatBerlinTime(unixSec: number): string {
	return new Intl.DateTimeFormat('de-DE', {
		timeZone: 'Europe/Berlin',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(unixSec * 1000));
}

/**
 * Ampelzustand für `now`. `scored` soll mindestens das laufende Intervall und die
 * folgenden Intervalle bis zum Horizontende enthalten (sortiert nach `ts`).
 */
export function evaluateAmpel(scored: readonly ScoredSlot[], now: number): AmpelState {
	const sorted = [...scored].sort((a, b) => a.ts - b.ts);
	const currentIndex = sorted.findIndex((s) => s.ts <= now && now < s.ts + s.resolutionSec);
	if (currentIndex === -1) {
		return {
			farbe: null,
			symbol: null,
			text: 'Keine aktuellen Preisdaten',
			bisTs: null,
			slotTs: null
		};
	}
	const current = sorted[currentIndex]!;
	if (current.farbe === null) {
		return {
			farbe: null,
			symbol: null,
			text: 'Keine aktuellen Preisdaten',
			bisTs: null,
			slotTs: current.ts
		};
	}

	const change = sorted.slice(currentIndex + 1).find((s) => s.farbe !== current.farbe);
	const bisTs = change ? change.ts : null;
	const suffix =
		bisTs !== null ? ` – bis ca. ${formatBerlinTime(bisTs)}` : ' – für die nächsten 48 h';

	return {
		farbe: current.farbe,
		symbol: SYMBOL[current.farbe],
		text: `${SENTENCE[current.farbe]}${suffix}`,
		bisTs,
		slotTs: current.ts
	};
}

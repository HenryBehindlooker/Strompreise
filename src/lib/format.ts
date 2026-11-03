/**
 * Anzeige-Formatierung (läuft im Browser und auf dem Server).
 * Intern ist alles UTC in Unix-Sekunden; die Ausgabe ist immer Europe/Berlin.
 */

const TZ = 'Europe/Berlin';

const timeFmt = new Intl.DateTimeFormat('de-DE', {
	timeZone: TZ,
	hour: '2-digit',
	minute: '2-digit'
});
const dayTimeFmt = new Intl.DateTimeFormat('de-DE', {
	timeZone: TZ,
	weekday: 'short',
	day: '2-digit',
	month: '2-digit',
	hour: '2-digit',
	minute: '2-digit'
});
const dayFmt = new Intl.DateTimeFormat('de-DE', {
	timeZone: TZ,
	weekday: 'short',
	day: '2-digit',
	month: '2-digit'
});
const dayShortFmt = new Intl.DateTimeFormat('de-DE', {
	timeZone: TZ,
	day: '2-digit',
	month: '2-digit'
});
const numberFmt = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const integerFmt = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

const d = (sec: number) => new Date(sec * 1000);

/** "15:30" */
export function formatTime(sec: number): string {
	return timeFmt.format(d(sec));
}

/** "Sa., 24.10., 14:00" */
export function formatDayTime(sec: number): string {
	return dayTimeFmt.format(d(sec));
}

/** "24.10." – kurz genug für Diagrammachsen auf dem Telefon. */
export function formatDayShort(sec: number): string {
	return dayShortFmt.format(d(sec));
}

/** "Sa., 24.10." */
export function formatDay(sec: number): string {
	return dayFmt.format(d(sec));
}

/** "Sa., 24.10., 14:00–17:00 Uhr" – ein Zeitfenster innerhalb eines Tages oder über Tage. */
export function formatWindow(fromSec: number, toSec: number): string {
	return `${formatDayTime(fromSec)}–${formatTime(toSec)} Uhr`;
}

/** Preis in EUR/MWh, z. B. "87,5 €/MWh". Null → "–". */
export function formatEurMwh(value: number | null): string {
	return value === null ? '–' : `${numberFmt.format(value)} €/MWh`;
}

/** Anteil in Prozent, z. B. "61 %". Null → "–". */
export function formatPct(value: number | null): string {
	return value === null ? '–' : `${integerFmt.format(value)} %`;
}

/** Megawatt, z. B. "12.345 MW". */
export function formatMw(value: number): string {
	return `${integerFmt.format(value)} MW`;
}

/** Dauer in Minuten als lesbarer Text: "45 Min", "2 Std." */
export function formatAge(minutes: number): string {
	if (minutes < 60) return `${minutes} Min`;
	return `${integerFmt.format(Math.floor(minutes / 60))} Std.`;
}

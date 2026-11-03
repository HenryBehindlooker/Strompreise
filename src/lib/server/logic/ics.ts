/**
 * ICS-Export (RFC 5545) für Zeitfenster. Reine Funktionen.
 * Zeilenenden CRLF, Zeilen max. 75 Oktette (Umbruch mit Leerzeichen am Anfang).
 */

export interface IcsWindow {
	from: number;
	to: number;
	score: number;
	avgEurMwh: number | null;
	avgRenewableSharePct: number | null;
}

const enc = new TextEncoder();

/** UTC im ICS-Format, z. B. 20261024T120000Z. */
export function icsUtc(unixSec: number): string {
	const d = new Date(unixSec * 1000);
	const p = (n: number) => String(n).padStart(2, '0');
	return (
		`${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
		`T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
	);
}

/** Text-Escaping nach RFC 5545 (Backslash, Semikolon, Komma, Zeilenende). */
export function escapeText(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r?\n/g, '\\n');
}

/** Zeile auf max. 75 Oktette umbrechen, ohne Mehrbyte-Zeichen zu teilen. */
export function foldLine(line: string): string {
	if (enc.encode(line).length <= 75) return line;
	const parts: string[] = [];
	let current = '';
	let bytes = 0;
	let limit = 75;
	for (const ch of line) {
		const size = enc.encode(ch).length;
		if (bytes + size > limit) {
			parts.push(current);
			current = '';
			bytes = 0;
			limit = 74; // Folgezeilen beginnen mit einem Leerzeichen (1 Oktett)
		}
		current += ch;
		bytes += size;
	}
	parts.push(current);
	return parts.join('\r\n ');
}

const decimal = (value: number) => value.toFixed(1).replace('.', ',');

export function summaryFor(window: IcsWindow): string {
	const price =
		window.avgEurMwh === null ? 'Preis unbekannt' : `Ø ${decimal(window.avgEurMwh)} €/MWh`;
	const share =
		window.avgRenewableSharePct === null ? null : `${Math.round(window.avgRenewableSharePct)} % EE`;
	return ['Strom-Ampel: günstiges Zeitfenster', price, share].filter(Boolean).join(' · ');
}

/** Kalenderdatei mit einem Termin je Zeitfenster. `nowSec` ist DTSTAMP. */
export function buildIcs(windows: readonly IcsWindow[], nowSec: number): string {
	const lines: string[] = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Strom-Ampel//Strompreise//DE',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${escapeText('Strom-Ampel: beste Zeitfenster')}`
	];
	for (const w of windows) {
		const description = [
			w.avgEurMwh === null ? null : `Durchschnittspreis: ${decimal(w.avgEurMwh)} €/MWh`,
			w.avgRenewableSharePct === null
				? null
				: `Erneuerbaren-Anteil: ${Math.round(w.avgRenewableSharePct)} %`,
			'Quelle: Energy-Charts / Fraunhofer ISE (CC BY 4.0); Bundesnetzagentur | SMARD.de'
		]
			.filter(Boolean)
			.join('\n');
		lines.push(
			'BEGIN:VEVENT',
			`UID:${w.from}-${w.to}@strom-ampel`,
			`DTSTAMP:${icsUtc(nowSec)}`,
			`DTSTART:${icsUtc(w.from)}`,
			`DTEND:${icsUtc(w.to)}`,
			`SUMMARY:${escapeText(summaryFor(w))}`,
			`DESCRIPTION:${escapeText(description)}`,
			'TRANSP:TRANSPARENT',
			'END:VEVENT'
		);
	}
	lines.push('END:VCALENDAR');
	return lines.map(foldLine).join('\r\n') + '\r\n';
}

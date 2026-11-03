/**
 * Oberflächentexte (Deutsch). Ausgelagert, damit eine weitere Sprache später
 * als zweite Datei mit derselben Struktur dazukommt.
 */
export const de = {
	appName: 'Strom-Ampel',
	nav: { home: 'Start', about: 'Über' },
	hero: {
		title: 'Jetzt Strom verbrauchen?',
		noData: 'Keine aktuellen Preisdaten'
	},
	farben: { gruen: 'Grün', gelb: 'Gelb', rot: 'Rot', unbekannt: 'Unbekannt' },
	windows: {
		title: 'Beste Zeitfenster',
		subtitle: 'Die nächsten 48 Stunden, 3 Stunden am Stück',
		empty: 'Noch keine Zeitfenster verfügbar, weil Preisdaten fehlen.',
		avgPrice: 'Ø Preis',
		avgRenewable: 'Ø EE-Anteil'
	},
	charts: {
		price: 'Strompreis, nächste 48 Stunden',
		priceCaption: 'Day-Ahead-Preis in EUR/MWh (Gebotszone DE-LU)',
		renewable: 'Erneuerbaren-Anteil, Prognose',
		renewableCaption: 'Anteil der erneuerbaren Erzeugung in Prozent',
		mix: 'Strommix, letzte 24 Stunden',
		mixCaption: 'Erzeugung in MW, gestapelt nach Erzeugungsart',
		empty: 'Keine Daten für dieses Diagramm.',
		table: 'Als Tabelle anzeigen',
		time: 'Zeit',
		value: 'Wert',
		other: 'Sonstige'
	},
	push: {
		title: 'Morgen-Hinweis',
		text: 'Auf Wunsch eine Nachricht, wenn morgen zwischen 11 und 14 Uhr ein grünes Zeitfenster liegt.',
		enable: 'Hinweis aktivieren',
		disable: 'Hinweis ausschalten',
		denied: 'Benachrichtigungen wurden im Browser nicht erlaubt.',
		saved: 'Hinweis ist aktiv.',
		removed: 'Hinweis ist ausgeschaltet.',
		error: 'Das hat leider nicht geklappt. Bitte später noch einmal versuchen.'
	},
	footer: {
		sources: 'Daten: Energy-Charts / Fraunhofer ISE (CC BY 4.0); Bundesnetzagentur | SMARD.de',
		stand: 'Stand',
		unknown: 'unbekannt',
		statusLine: 'Datenstand'
	},
	about: {
		title: 'Über die Strom-Ampel',
		intro:
			'Die Strom-Ampel zeigt für Deutschland (Gebotszone DE-LU), ob jetzt ein günstiger Zeitpunkt ist, Strom zu verbrauchen.'
	}
} as const;

export type Messages = typeof de;

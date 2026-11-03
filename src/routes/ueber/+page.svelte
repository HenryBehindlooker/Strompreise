<script lang="ts">
	import { de } from '#lib/i18n/de';

	const REPO = 'https://github.com/HenryBehindlooker/Strompreise';
</script>

<svelte:head>
	<title>{de.about.title} · {de.appName}</title>
</svelte:head>

<article class="text">
	<h1>{de.about.title}</h1>
	<p>{de.about.intro}</p>

	<h2>So entsteht die Ampel</h2>
	<p>
		Jede Stunde (bzw. Viertelstunde) im nächsten Zeitraum von 48 Stunden bekommt eine Bewertung von
		0 bis 1. Sie setzt sich aus zwei Teilen zusammen, je zur Hälfte gewichtet:
	</p>
	<ul>
		<li>
			<strong>Preis:</strong> je günstiger der Strompreis im Vergleich zu den übrigen Stunden, desto höher
			der Anteil.
		</li>
		<li>
			<strong>Erneuerbaren-Anteil:</strong> je höher der erwartete Anteil erneuerbarer Erzeugung, desto
			höher der Anteil.
		</li>
	</ul>
	<p>
		Ab 0,66 zeigt die Ampel <strong>Grün</strong>, ab 0,33 <strong>Gelb</strong>, darunter
		<strong>Rot</strong>. Die Ampel nutzt außerdem ein Symbol und Text, damit sie auch ohne Farbe
		lesbar ist. Gewichte und Schwellen sind konfigurierbar.
	</p>
	<p>
		Die Zeitfenster sind zusammenhängende Abschnitte von 3 Stunden mit dem besten Durchschnitts-
		Bewertung; sie überschneiden sich nicht.
	</p>

	<h2>Datenquellen</h2>
	<ul>
		<li>
			<strong>Energy-Charts</strong> des Fraunhofer ISE, Lizenz CC BY 4.0.
		</li>
		<li>
			<strong>SMARD.de</strong> der Bundesnetzagentur, als Ausweichquelle, wenn Energy-Charts nicht erreichbar
			ist.
		</li>
	</ul>
	<p>
		Die Anwendung ruft die Quellen nicht bei jedem Seitenaufruf ab. Hintergrundjobs holen die Daten
		regelmäßig und speichern sie. Die Startseite zeigt den Zeitpunkt des letzten erfolgreichen
		Abrufs in der Fußzeile.
	</p>

	<h2>Lizenz und Quellcode</h2>
	<p>
		Die Software steht unter der
		<a href="{REPO}/blob/main/LICENSE">GNU Affero General Public License v3.0</a>. Den Quellcode
		findest du auf <a href={REPO}>GitHub</a>.
	</p>
	<p class="hinweis">
		Die Anzeige ist eine Orientierung. Preise und Prognosen können sich ändern; für Abrechnungen
		gelten die Angaben deines Stromanbieters.
	</p>
</article>

<style>
	.text {
		max-width: 42rem;
	}
	h1 {
		font-size: 1.6rem;
		margin: 0 0 0.75rem;
	}
	h2 {
		font-size: 1.15rem;
		margin: 1.5rem 0 0.5rem;
	}
	p,
	li {
		color: var(--text-primary);
	}
	.hinweis {
		color: var(--text-secondary);
		font-size: 0.9rem;
	}
</style>

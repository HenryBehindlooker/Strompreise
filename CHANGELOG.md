# Changelog

Alle wichtigen Änderungen an diesem Projekt. Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), die Versionierung folgt [SemVer](https://semver.org/lang/de/).

## [0.1.0] – 2026-11-03

Erste Version mit Oberfläche, API, PWA und Deployment. **Die Datenquellen-Adapter (Energy-Charts, SMARD) fehlen noch.** Ohne sie gibt es keine Live-Daten.

### Hinzugefügt

- **Setup:** SvelteKit mit TypeScript (strict), ESLint, Prettier, Vitest, Playwright, GitHub-Actions-CI mit Lint, Typprüfung, Unit- und E2E-Tests.
- **Datenbank:** SQLite mit Drizzle und Migrationen. Tabellen für Erzeugung, Preise, EE-Anteil und Abrufprotokoll. Upserts sind idempotent. Aufbewahrung 90 Tage mit Verdichtung zu Stundenwerten.
- **Hintergrundjobs:** Strommix alle 15 Minuten, Preise stündlich bis morgen vollständig, EE-Prognose stündlich, tägliche Aufbewahrung. Quellen-Fallback in Reihenfolge, jeder Abruf wird protokolliert.
- **Ampel:** Score aus Preis-Perzentil und EE-Anteil, konfigurierbare Gewichte und Schwellen, Satz mit Uhrzeit des nächsten Wechsels.
- **Zeitfenster:** beste nicht überlappende Fenster ab jetzt im 48-Stunden-Horizont.
- **JSON-API:** `/api/now`, `/api/forecast`, `/api/windows`, `/api/status`, mit Validierung und passenden Cache-Headern.
- **Oberfläche:** mobile-first, Hell- und Dunkelmodus, Diagramme mit Tabellenalternative, Fußzeile mit Quellenhinweis und Stand, Seite „Über“.
- **PWA:** Manifest, Service Worker mit letztem Stand offline.
- **ICS-Export** der Zeitfenster unter `/api/windows.ics`.
- **Morgen-Hinweis** per Web-Push, nur mit VAPID-Schlüsseln aktiv, höchstens eine Nachricht pro Tag.
- **Deployment:** Dockerfile (mehrstufig, Laufzeit als Benutzer `node`), `docker-compose.yml` mit Caddy für HTTPS, Healthcheck auf `/api/status`, persistentes Volume für die Datenbank.

### Behoben

- Semikola im ICS-Text wurden nicht escaped (falsche Escape-Sequenz). Der Test hatte denselben Fehler und ist korrigiert.

### Bekannte Einschränkungen

- Keine Datenquelle angebunden: Energy-Charts- und SMARD-Adapter fehlen noch.
- Die Abfrage des Erneuerbaren-Anteils nutzt die Prognose, nicht den gemessenen Ist-Anteil.
- Die Zuordnung der Erzeugungsarten zu Anzeigenamen ist vorbereitet, aber nur für bekannte Schlüssel gepflegt.
- Web-Push und ICS sind mit synthetischen Daten getestet, nicht mit echten Abonnenten oder Kalender-Apps.

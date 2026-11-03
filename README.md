# Strom-Ampel

Open-Source-WebApp für Deutschland (DE-LU): zeigt live den Strommix, den
Day-Ahead-Preis und den Erneuerbaren-Anteil und sagt per Ampel, ob jetzt ein
guter Zeitpunkt ist, Strom zu verbrauchen. Zusätzlich werden die besten
Zeitfenster der nächsten 24–48 h vorgeschlagen (z. B. für Waschmaschine oder
E-Auto).

> **Status:** Phase 0 (Setup). Die Funktionen folgen phasenweise, siehe unten.

## Geplante Features

- Live-Strommix, Day-Ahead-Preis und EE-Anteil (DE-LU)
- Ampel „Jetzt Strom verbrauchen?“ mit Text und Icon (nicht nur Farbe)
- Beste Zeitfenster der nächsten 48 h, Export als ICS
- Chart für Preis und EE-Anteil, Strommix-Chart
- Mobile-first, Light- und Dark-Mode, PWA mit Offline-Stand
- Optional: Web-Push für grüne Zeitfenster

## Technik

- SvelteKit + TypeScript (strict), `adapter-node`
- SQLite (better-sqlite3) mit Drizzle ORM
- Hintergrund-Jobs mit node-cron im Server-Prozess
- Tests: Vitest (Unit), Playwright (E2E-Smoke)
- ESLint + Prettier

Nutzer-Anfragen gehen nie direkt an Upstream-APIs. Ein Worker holt die Daten
und schreibt sie in die Datenbank; die Web-Oberfläche liest nur daraus.

## Quickstart (lokal)

Voraussetzung: Node.js 22 oder neuer.

```bash
npm ci
cp .env.example .env
npm run dev
```

Die App läuft danach unter <http://localhost:5173>.

## Entwicklung

| Befehl                       | Zweck                       |
| ---------------------------- | --------------------------- |
| `npm run lint`               | Prettier-Check und ESLint   |
| `npm run check`              | Typprüfung (svelte-check)   |
| `npm run test:unit -- --run` | Unit-Tests (Vitest)         |
| `npm run test:e2e`           | E2E-Smoke-Test (Playwright) |
| `npm test`                   | Unit- und E2E-Tests         |

Vor dem ersten E2E-Lauf den Browser installieren: `npx playwright install chromium`.
Ist bereits ein Chromium vorhanden, kann sein Pfad über `PLAYWRIGHT_CHROMIUM_PATH` angegeben werden.

## Datenquellen

- **Energy-Charts** (Fraunhofer ISE), primäre Quelle, CC BY 4.0
- **SMARD** (Bundesnetzagentur), Fallback ohne Schlüssel

Die Adapter folgen in Phase 1.

## Docker

Folgt in Phase 7 (Dockerfile, docker-compose mit Caddy für HTTPS).

## Mitwirken

Beiträge sind willkommen. Bitte vor größeren Änderungen ein Issue öffnen und
sicherstellen, dass `npm run lint` und `npm test` grün sind.

## Lizenz

Dieses Projekt steht unter der [GNU Affero General Public License v3.0](LICENSE).

Datenhinweis: Daten: Energy-Charts / Fraunhofer ISE (CC BY 4.0);
Bundesnetzagentur | SMARD.de

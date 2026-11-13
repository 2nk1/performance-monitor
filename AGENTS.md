# Performance Monitor

Statische React-SPA (Vite, React Router, TanStack Query) mit Supabase als Backend.
Das Projekt nutzt **kein** Next.js. Deployment über GitHub Pages (Basis-Pfad `/performance-monitor/`).

## Befehle

- `npm run dev` – Entwicklungsserver
- `npm run lint`, `npm run format`, `npm test`, `npm run build` – vor jedem PR ausführen
- `npm run supabase:types` – Typen aus der lokalen Supabase-Instanz generieren (`--local`)

## Struktur

- `src/pages` – Seiten, `src/components` – wiederverwendbare Komponenten
- `src/lib/data.ts` – Abfragen, `src/lib/mutations.ts` – Schreibzugriffe
- `src/lib/growth` – Wachstumsauswertung
- `src/lib/supabase/database.types.ts` – generierte Typen
- `supabase/migrations` – SQL-Migrationen (Format `YYYYMMDDHHMMSS_name.sql`)

## Datenbankänderungen

Die App wird per GitHub Pages ausgeliefert, die Datenbank separat. Beide ändern sich nie gleichzeitig. Deshalb bei Spalten und Tabellen in zwei Schritten arbeiten (expand/contract):

1. Neue Spalte anlegen und Daten übernehmen, App-Version ausrollen.
2. Erst danach die alte Spalte in einer eigenen Migration entfernen.

Nie Spalten entfernen, die die live App noch liest. Nach dem Merge den Deploy-Workflow abwarten, bevor der zweite Schritt folgt. Zwei Merges kurz hintereinander können sich im Deploy überholen: dann den Workflow manuell neu starten.

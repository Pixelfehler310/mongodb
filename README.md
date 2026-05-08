# MongoDB vs. PostgreSQL Showcase (Uni Projekt)

Dieses Projekt vergleicht MongoDB als dokumentenorientierte NoSQL-Datenbank mit PostgreSQL als relationaler Referenz:

- Flexibles Schema in einer `products` Collection
- Embedded Reviews ohne JOINs
- Aggregation Pipeline fuer Analytics
- normalisierte PostgreSQL-Tabellen fuer Produkte, Attribute, Tags und Reviews
- Lokaler Betrieb mit Docker, wahlweise ueber MongoDB Atlas oder lokaler MongoDB-Container

## Komponenten

- Backend: Express + TypeScript + nativer MongoDB Node.js Driver + PostgreSQL `pg` Pool
- Frontend: React + Vite + TypeScript + React Query + Zustand
- Infrastruktur: Docker Compose (lokal), MongoDB Atlas (Cloud), lokaler MongoDB-Container, lokaler PostgreSQL-Container, InfluxDB und Grafana fuer Benchmark-Visualisierung

## API (v1)

- `GET /api/v1/health`
- `GET /api/v1/products`
- `GET /api/v1/products/:id`
- `POST /api/v1/products/:id/reviews`
- `GET /api/v1/categories`
- `GET /api/v1/analytics`
- `POST /api/v1/seed`

Die fachlichen Endpunkte akzeptieren `?db=mongo` oder `?db=postgres`. Der Seed-Endpunkt akzeptiert zusaetzlich `?db=both`, damit beide Datenbanken denselben deterministischen Datensatz erhalten.

## Docker-Umgebungen im Projekt

Es gibt jetzt zwei klar getrennte Docker-Setups:

- Atlas-Setup (Cloud DB): `docker-compose.yml`
- Lokales Vergleichssetup (MongoDB-Container + PostgreSQL-Container): `docker-compose.local.yml`

Beide Setups starten Backend, Frontend und PostgreSQL. Das lokale Setup startet zusaetzlich eine lokale MongoDB. Im Frontend kann per Datenbank-Toggle zwischen MongoDB und PostgreSQL gewechselt werden.

## Voraussetzungen

- Docker Desktop laeuft
- Port `3000` (Backend) ist frei
- Port `3001` (Grafana) ist frei
- Port `4173` (Frontend) ist frei
- Port `8086` (InfluxDB) ist frei
- Fuer lokales Mongo optional: Port `27017` ist frei (nur falls Host-Zugriff gewuenscht)
- Fuer lokales PostgreSQL optional: Port `5432` ist frei (nur falls Host-Zugriff gewuenscht)

## Umgebungsdateien

- Atlas-Modus: `.env.example` nach `.env` kopieren
- Lokal-Modus: `.env.local.example` nach `.env.local` kopieren

Wichtig: die Dateien nicht mischen. Nutze fuer jeden Modus die passenden Startbefehle.

## Schnellstart A: Atlas (Cloud)

### 1) Env-Datei anlegen

```powershell
Copy-Item .env.example .env
```

Danach in `.env` mindestens `MONGODB_URI` mit echten Atlas-Daten setzen.

### 2) Atlas vorbereiten

1. In Atlas unter `Database Access` pruefen, dass der DB-User existiert.
2. In Atlas unter `Network Access` die eigene IP erlauben.
3. Connection String aus `Connect -> Drivers` uebernehmen.

### 3) Stack starten

```bash
docker compose up --build
```

### 4) Verifizieren

1. Health: `http://localhost:3000/api/v1/health`
2. Frontend: `http://localhost:4173`
3. Optional API-Test: `http://localhost:3000/api/v1/products?limit=5`

### 5) Stoppen / Reset

```bash
docker compose down
```

Hard reset der Container/Volumes:

```bash
docker compose down -v
```

## Schnellstart B: Lokaler MongoDB-Container

### 1) Env-Datei anlegen

```powershell
Copy-Item .env.local.example .env.local
```

Die Standardwerte sind bereits auf den lokalen Compose-Stack abgestimmt.

### 2) Lokalen Stack starten

```bash
docker compose --env-file .env.local -f docker-compose.local.yml up --build
```

Was dabei passiert:

- `mongo` startet aus `mongo:7` und speichert Daten in einem Docker Volume (`mongo_data`).
- `postgres` startet aus `postgres:16` und speichert Daten in einem Docker Volume (`postgres_data`).
- `backend` wartet auf Mongo- und PostgreSQL-Healthchecks.
- `frontend` wartet auf den Backend-Healthcheck.
- `influxdb` speichert die Live-Metriken der k6-Runs.
- `grafana` visualisiert die k6-Runs live unter `http://localhost:3001`.

### 3) Verifizieren

1. Health: `http://localhost:3000/api/v1/health`
2. Frontend: `http://localhost:4173`
3. Optional Produktliste: `http://localhost:3000/api/v1/products?limit=5`
4. Optional DB von Host pruefen: `mongodb://localhost:27017`

### 4) Seeding (optional)

Per API:

```bash
curl -X POST "http://localhost:3000/api/v1/seed?db=both"
```

Hinweis: Seed ersetzt bestehende Produktdaten in den gewaehlt(en) Datenbank(en) (destruktiv).

Fuer groessere Datenmengen nicht den Demo-Endpunkt verwenden. Der API-Seed ist in [backend/src/validation/schemas.ts](backend/src/validation/schemas.ts) auf `10000` Datensaetze begrenzt und ist fuer Showcase-Daten gedacht.

Stattdessen im Backend direkt in Batches seeden:

```bash
cd backend
npm run seed:bulk -- --db mongo --total 250000 --batch-size 5000
```

Oder fuer beide Datenbanken:

```bash
cd backend
npm run seed:bulk -- --db both --total 100000 --batch-size 2000
```

Optionen:

- `--db mongo|postgres|both`
- `--total <anzahl>` Gesamtmenge der Datensaetze
- `--batch-size <anzahl>` Groesse pro Insert-Block
- `--clear-existing true|false` Bestehende Daten vor dem ersten Batch loeschen
- `--seed <zahl>` Deterministischer Seed fuer reproduzierbare Daten

Empfehlung:

- MongoDB: mit `5000` bis `20000` pro Batch starten
- PostgreSQL: kleiner starten, z. B. `1000` bis `5000`, weil aktuell pro Produkt mehrere Inserts ausgefuehrt werden

### 4b) Performance testen

Einfacher HTTP-Lasttest fuer vorhandene API-Endpunkte:

```bash
cd backend
npm run perf:test -- --url "http://localhost:3000/api/v1/products?db=mongo&limit=20" --concurrency 50 --duration 30
```

Vergleich PostgreSQL:

```bash
npm run perf:test -- --url "http://localhost:3000/api/v1/products?db=postgres&limit=20" --concurrency 50 --duration 30
```

Der Befehl gibt JSON mit `requests_per_second`, `p50`, `p95`, `p99` und Statuscodes aus.

Sinnvolle Testfaelle fuer den Vergleich:

- Produktliste ohne Filter
- Produktliste mit `category`, `price_*` und `attributes.*`
- Textsuche mit `search=laptop`
- `GET /api/v1/analytics?db=mongo` gegen `?db=postgres`

### 4c) Vollstaendige k6-Performanceanalyse

Fuer die eigentliche Auswertung aus dem Umsetzungskonzept gibt es jetzt einen reproduzierbaren k6-Flow unter `benchmark/`.

Vorbereitung:

1. Lokalen Stack starten:

```bash
npm run docker:local:up
```

2. Fuer belastbare Lese- und Analyse-Benchmarks einen groesseren, identischen Datensatz in beide Datenbanken schreiben:

```bash
npm run docker:local:seed:bulk -- --db both --total 10000 --batch-size 2000 --seed 20260503
```

3. Einzelnes k6-Szenario ausfuehren, zum Beispiel Produktdetails gegen MongoDB:

```bash
npm run benchmark:local:scenario -- --scenario read-product --db mongo --vus 50 --warmup 30 --duration 60
```

4. Gesamte Suite gegen beide Datenbanken fahren:

```bash
npm run benchmark:local:suite -- --db both --vus 50 --warmup 30 --duration 60 --seed-count 10000
```

Die Ergebnisse landen unter `benchmark/results/<timestamp>/`:

- ein JSON pro Run mit den exportierten k6-Metriken
- `suite-summary.json` mit verdichteten Kennzahlen fuer alle Szenarien
- jeder Run und jede Suite liefern zusaetzlich eine `grafana_url` fuer die Live- bzw. Nachansicht

Implementierte Szenarien:

- `read-product`: Produktdetail mit Reviews, Tags und Attributen
- `catalog-search`: Katalogabfrage mit Kategorie-, Attribut- und Textfilter
- `analytics-rollup`: Aggregations-Endpunkt fuer Kategorien und Ratings
- `bulk-insert`: API-basierter Bulk-Insert mit `POST /api/v1/seed?db=<mode>`

Wichtige Hinweise:

- `bulk-insert` ist destruktiv, weil der Seed-Endpunkt bestehende Produktdaten ersetzt.
- Atlas ist bewusst nicht Teil dieses Benchmark-Flows. Die Performanceanalyse laeuft nur ueber `docker-compose.local.yml`.
- Der Frontend-Performance-Tab bleibt als schneller In-App-Labortest erhalten. Fuer die eigentliche Ausarbeitung und reproduzierbare Zahlen ist k6 der massgebliche Pfad.

### 4d) Live-Visualisierung der k6-Runs mit Grafana

Der lokale Compose-Stack startet jetzt automatisch auch InfluxDB und Grafana. Dadurch koennen echte k6-Runs waehrend der Ausfuehrung live visualisiert werden.

Wichtige URLs:

- Grafana Dashboard: `http://localhost:3001`
- InfluxDB HTTP API: `http://localhost:8086`

Ablauf:

1. Lokalen Stack starten:

```bash
npm run docker:local:up
```

2. Optional groesseren Datensatz in beide Datenbanken schreiben:

```bash
npm run docker:local:seed:bulk -- both 10000
```

3. Benchmark starten, zum Beispiel ein einzelnes Szenario:

```bash
npm run benchmark:local:scenario -- read-product mongo grafana-demo 10 10 15 1000
```

Oder die gesamte Suite:

```bash
npm run benchmark:local:suite -- --db both --vus 50 --warmup 30 --duration 60 --seed-count 10000
```

4. Das Grafana-Dashboard oeffnen und nach `suite_id`, `scenario`, `db_mode` und `run_id` filtern.

Hinweise zur Visualisierung:

- Das Dashboard ist als provisioniertes Standard-Dashboard unter `K6 Benchmarks / K6 Live Overview` hinterlegt.
- Grafana ist lokal anonym lesbar konfiguriert, damit die Demo ohne Login funktioniert.
- Die CLI-Ausgabe der Benchmark-Runner enthaelt zusaetzlich eine `grafana_url`, die direkt auf die passende Suite bzw. den passenden Run zeigt.

### 5) Stoppen / Reset

Container stoppen:

```bash
docker compose --env-file .env.local -f docker-compose.local.yml down
```

Container + lokales DB-Volume loeschen:

```bash
docker compose --env-file .env.local -f docker-compose.local.yml down -v
```

## Zwischen den Umgebungen wechseln

Von Atlas zu lokal wechseln:

1. Atlas-Stack stoppen (`docker compose down`)
2. Lokalen Stack mit `--env-file .env.local -f docker-compose.local.yml` starten

Von lokal zu Atlas wechseln:

1. Lokalen Stack stoppen (`docker compose --env-file .env.local -f docker-compose.local.yml down`)
2. Atlas-Stack mit `docker compose up --build` starten

## Troubleshooting (Kurz)

- `Authentication failed` (Atlas):
	- Credentials in `MONGODB_URI` pruefen
	- Sonderzeichen im Passwort URL-encoden

- `timed out` gegen Atlas:
	- IP in Atlas Network Access freigeben
	- VPN/Firewall pruefen

- Backend unhealthy im lokalen Modus:
	- Pruefen, ob `mongo` healthy ist (`docker compose ... ps`)
	- Logs ansehen (`docker compose ... logs backend mongo`)

- Frontend zeigt keine Daten:
	- Health-Endpoint pruefen
	- Bei leerer lokaler DB einmal `/seed` ausfuehren

## Lokal ohne Docker (optional)

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Dann Frontend unter `http://localhost:5173` oeffnen.

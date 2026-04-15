# MongoDB Showcase (Uni Projekt)

Dieses Projekt demonstriert die Vorteile von MongoDB als dokumentenorientierte NoSQL-Datenbank:

- Flexibles Schema in einer `products` Collection
- Embedded Reviews ohne JOINs
- Aggregation Pipeline fuer Analytics
- Lokaler Betrieb mit Docker, wahlweise über Mongo DB Cloud Atlas oder lokaler MongoDB-Container

## Komponenten

- Backend: Express + TypeScript + nativer MongoDB Node.js Driver
- Frontend: React + Vite + TypeScript + React Query + Zustand
- Infrastruktur: Docker Compose (lokal), MongoDB Atlas (Cloud) oder lokaler MongoDB-Container

## API (v1)

- `GET /api/v1/health`
- `GET /api/v1/products`
- `GET /api/v1/products/:id`
- `POST /api/v1/products/:id/reviews`
- `GET /api/v1/categories`
- `GET /api/v1/analytics`
- `POST /api/v1/seed`

## Docker-Umgebungen im Projekt

Es gibt jetzt zwei klar getrennte Docker-Setups:

- Atlas-Setup (Cloud DB): `docker-compose.yml`
- Lokales Setup (eigener MongoDB-Container): `docker-compose.local.yml`

Beide Setups starten Backend und Frontend. Der Unterschied ist nur die Datenbankquelle.

## Voraussetzungen

- Docker Desktop laeuft
- Port `3000` (Backend) ist frei
- Port `4173` (Frontend) ist frei
- Fuer lokales Mongo optional: Port `27017` ist frei (nur falls Host-Zugriff gewuenscht)

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
- `backend` wartet auf den Mongo-Healthcheck.
- `frontend` wartet auf den Backend-Healthcheck.

### 3) Verifizieren

1. Health: `http://localhost:3000/api/v1/health`
2. Frontend: `http://localhost:4173`
3. Optional Produktliste: `http://localhost:3000/api/v1/products?limit=5`
4. Optional DB von Host pruefen: `mongodb://localhost:27017`

### 4) Seeding (optional)

Per API:

```bash
curl -X POST http://localhost:3000/api/v1/seed
```

Hinweis: Seed ersetzt bestehende Produktdaten (destruktiv).

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

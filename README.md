# MongoDB Showcase (Uni Projekt)

Dieses Projekt demonstriert die Vorteile von MongoDB als dokumentenorientierte NoSQL-Datenbank:

- Flexibles Schema in einer `products` Collection
- Embedded Reviews ohne JOINs
- Aggregation Pipeline fuer Analytics
- Lokaler Betrieb mit Docker, Datenbank in MongoDB Atlas

## Komponenten

- Backend: Express + TypeScript + nativer MongoDB Node.js Driver
- Frontend: React + Vite + TypeScript + React Query + Zustand
- Infrastruktur: Docker Compose (lokal), MongoDB Atlas (Cloud)

## API (v1)

- `GET /api/v1/health`
- `GET /api/v1/products`
- `GET /api/v1/products/:id`
- `POST /api/v1/products/:id/reviews`
- `GET /api/v1/categories`
- `GET /api/v1/analytics`
- `POST /api/v1/seed`

## Schnellstart (Docker)

1. `.env.example` nach `.env` kopieren und Atlas-URI eintragen.
2. In Atlas unter Network Access die eigene IP erlauben.
3. Projekt starten:

```bash
docker compose up --build
```

1. Frontend oeffnen: `http://localhost:4173`
2. Backend Healthcheck: `http://localhost:3000/api/v1/health`

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

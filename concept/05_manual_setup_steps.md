# 05 - Manuelle Setup-Schritte nach dem Docker-Fehler

Dieses Dokument erklaert dir Schritt fuer Schritt, was du jetzt manuell machen musst, damit das Projekt lokal startet.

## 1) Warum der Fehler kommt

Du hast aktuell zwei Meldungen gesehen:

1. `version is obsolete`
- Das ist nur ein Hinweis (Warning), kein Blocker.
- Docker Compose funktioniert trotzdem.
- Optional kannst du die `version:`-Zeile aus `docker-compose.yml` entfernen.

2. `.env not found`
- Das ist der eigentliche Stopper.
- Dein Backend laedt Umgebungsvariablen aus einer Datei `.env` im Projekt-Root.
- Diese Datei existiert bei dir noch nicht.

## 2) .env-Datei anlegen (Pflicht)

Im Projekt-Root ausfuehren (`C:\Users\simon\Documents\GitHub\uni\mongodb`):

```powershell
Copy-Item .env.example .env
```

Danach `.env` oeffnen und vor allem `MONGODB_URI` korrekt eintragen.

Beispielstruktur (an deine echten Werte anpassen):

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/<db-name>?retryWrites=true&w=majority
MONGODB_DB_NAME=mongo_showcase
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
CORS_ORIGIN=*
SEED_ON_START=true
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

### Wichtig bei MONGODB_URI

- `<username>` und `<password>` muessen zu deinem Atlas DB User passen.
- `<cluster-url>` ist dein Atlas Cluster Host (z. B. `cluster0.xxxxx.mongodb.net`).
- `<db-name>` sollte zu deiner Datenbank passen (z. B. `mongo_showcase`).
- Sonderzeichen im Passwort muessen URL-encoded sein.
  Beispiel:
  - `@` -> `%40`
  - `#` -> `%23`
  - `!` -> `%21`

## 3) MongoDB Atlas einmal korrekt vorbereiten (Pflicht)

In Atlas manuell pruefen:

1. Database Access
- DB User existiert (Username/Passwort korrekt).
- User hat mindestens Read/Write auf die Ziel-DB.

2. Network Access
- Deine aktuelle IP ist erlaubt.
- Fuer schnelle Demo kannst du temporaer `0.0.0.0/0` freigeben (nur fuer Uni-Demo, spaeter wieder einschranken).

3. Connection String
- In Atlas unter `Connect -> Drivers` den URI kopieren.
- In deine `.env` in `MONGODB_URI` einsetzen.

## 4) Optional: Warning wegen version-Zeile bereinigen

In `docker-compose.yml` kannst du diese erste Zeile entfernen:

```yaml
version: "3.9"
```

Das entfernt nur die Warning, aendert aber nicht die Funktion.

## 5) Container sauber starten

Im Projekt-Root:

```powershell
docker compose up --build
```

Falls du alte/kaputte Container von vorher hast:

```powershell
docker compose down -v
docker compose up --build
```

## 6) Nach dem Start pruefen

1. Backend Healthcheck
- Browser: `http://localhost:3000/api/v1/health`
- Erwartung: JSON mit `status: "ok"` und `mongodb: "connected"`

2. Frontend
- Browser: `http://localhost:4173`
- Erwartung: Katalogseite laedt, Produkte sichtbar (wenn Seed aktiv oder bereits Daten vorhanden)

3. Optional API-Test
- Browser: `http://localhost:3000/api/v1/products?limit=5`

## 7) Typische Probleme und schnelle Loesung

### Problem A: `Authentication failed`
- DB User/Passwort in `MONGODB_URI` falsch.
- Passwort nicht URL-encoded.

### Problem B: `timed out` / `could not connect`
- Network Access in Atlas (IP nicht erlaubt).
- Lokales Netzwerk/VPN blockiert.

### Problem C: Frontend startet, aber keine Daten
- Backend nicht gesund (`/health` pruefen).
- Falsches `VITE_API_BASE_URL`.
- Seed ausfuehren: POST `/api/v1/seed`.

### Problem D: Port bereits belegt
- Port 3000 oder 4173 wird schon benutzt.
- Laufende Prozesse stoppen oder Ports in Compose aendern.

## 8) Mini-Checklist (zum Abhaken)

- [ ] `.env` aus `.env.example` erstellt
- [ ] `MONGODB_URI` mit echten Atlas-Daten gesetzt
- [ ] Atlas DB User vorhanden und korrekt
- [ ] Atlas IP-Freigabe gesetzt
- [ ] `docker compose up --build` erfolgreich
- [ ] `http://localhost:3000/api/v1/health` zeigt `ok`
- [ ] `http://localhost:4173` ist erreichbar

Wenn diese Liste durch ist, ist dein lokales Demo-Setup voll einsatzbereit.
# Projekt Übersicht & Spezifikationen

## 1. Inhaltlicher Überblick (Use Case)
Ziel des Projekts ist ein eindrucksvoller Showcase von MongoDB als nicht-relationale, dokumentenorientierte Datenbank. 
Fokus liegt auf den Vorteilen gegenüber klassischen SQL-Datenbanken:
- **Flexibles Schema (Polymorphismus):** Unterschiedliche Struktur innerhalb derselben Collection.
- **Eingebettete Daten (Nesting):** Vermeidung von teuren JOINs durch Arrays und Sub-Dokumente.
- **Aggregation Pipeline:** Komplexe Echtzeit-Datenanalysen.

**Gewähltes Projekt-Szenario: E-Commerce Produktkatalog & Analytics**
* Produkte mit extrem unterschiedlichen Attributen (z.B. Kleidung mit Größe/Farbe vs. Elektronik mit RAM/CPU) in derselben Collection.
* Nutzerbewertungen und Rezensionen sind direkt in das Produkt-Dokument eingebettet.

## 2. Technologie-Stack
* **Datenbank:** MongoDB Atlas (Cloud)
* **Middle Layer (Backend):** Node.js (Express oder Fastify) + *Nativer MongoDB Node.js Driver*. Bewusster Verzicht auf Mongoose (ORM/ODM), um die echten MongoDB-Queries und Aggregationen unverfälscht zu demonstrieren.
* **Frontend:** React (Vite, TypeScript, TailwindCSS) für eine klare, visuelle Darstellung der Produkte und der Analytics-Dashboards.

## 3. Infrastruktur & Hosting
* **Datenbank-Hosting:** MongoDB Atlas
* **Anwendungs-Hosting:** Ausschließlich lokal via **Docker & Docker Compose**.
* **Aufbau:** 
  - Backend-Container (Node.js)
  - Frontend-Container (React SPA)
  - Ein einfaches `docker-compose up -d` startet das gesamte Projekt portabel auf jedem Rechner.

# Projekt Übersicht & Spezifikationen

## 1. Inhaltlicher Überblick (Use Case)
Ziel des Projekts ist kein reiner MongoDB-Showcase mehr, sondern ein fachlich sauberer Vergleich zwischen einem **relationalen** und einem **dokumentenorientierten** Datenmodell am selben Anwendungsszenario.

Im Mittelpunkt steht die Frage, wie sich **PostgreSQL** und **MongoDB** bei hierarchischen Produktdaten, sich ändernden Anforderungen und analytischen Auswertungen unterscheiden.

**Gewähltes Projekt-Szenario: E-Commerce Produktkatalog & Analytics**
* Produkte mit stark variierenden Attributen (z. B. Kleidung mit Größe/Farbe vs. Elektronik mit RAM/CPU).
* Nutzerbewertungen und Rezensionen als hierarchische Datenstruktur mit Erweiterungspotenzial, etwa für zusätzliche `reactions`.
* Analytische Auswertungen über Kategorien, Preise, Bestände und Bewertungen.

## 2. Wissenschaftlicher Fokus
Verglichen werden zwei Dinge auf derselben fachlichen Ebene:
* **Datenmodellierung:** Tabellen, Relationen und Migrationen in PostgreSQL vs. eingebettete Dokumente und flexible Felder in MongoDB.
* **Implementierungsaufwand:** Query-Komplexität, Mapping im Backend und Aufwand bei Anforderungsänderungen.
* **Messbare Effizienz:** Lese- und Schreib-Performance unter identischen lokalen Bedingungen.

Das Infrastrukturthema wird bewusst nachgeordnet behandelt:
* **Docker** dient als neutrales Testlabor für faire Benchmarks.
* **MongoDB Atlas** dient als Ausblick auf produktionsnahe Bereitstellung und Managed Operations.

## 3. Technologie-Stack
* **Dokumentenorientierte Datenbank:** MongoDB
* **Relationale Vergleichsdatenbank:** PostgreSQL
* **Middle Layer (Backend):** Node.js + TypeScript mit klar getrennten Datenzugriffsschichten fuer beide Datenbanken
* **Frontend:** React (Vite, TypeScript) fuer identische Use Cases und vergleichbare Oberflaechen
* **Benchmark-Umgebung:** Docker Compose mit lokaler Ausfuehrung beider Datenbanken auf derselben Hardware

## 4. Infrastruktur & Hosting
* **Lokales Testlabor:** Docker & Docker Compose starten Frontend, Backend, MongoDB und PostgreSQL in einer kontrollierten Umgebung.
* **Fairness-Prinzip:** Beide Datenbanken laufen auf demselben Rechner, mit denselben Netzwerkbedingungen und demselben Testdatensatz.
* **Atlas als Ausblick:** Der Managed-Service wird nicht als primaeres Vergleichsobjekt behandelt, sondern als Beispiel fuer spaetere produktive Skalierung des dokumentenorientierten Ansatzes.

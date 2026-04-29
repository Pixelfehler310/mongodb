# 06. Umsetzungskonzept: Fairer Vergleich zwischen PostgreSQL und MongoDB

## 1. Zielsetzung
Dieses Dokument konkretisiert die ueberarbeitete Projektstrategie. Ziel ist ein wissenschaftlich sauberer Vergleich zwischen einem **relationalen** und einem **dokumentenorientierten** Datenbanksystem, ohne Infrastrukturfragen mit dem eigentlichen Datenbankvergleich zu vermischen.

Verglichen werden daher:
* **PostgreSQL** als relationale Referenz
* **MongoDB** als dokumentenorientierte Referenz

Nicht verglichen werden:
* lokale Laufzeit vs. Cloud-Laufzeit
* Docker vs. Atlas als Infrastrukturprodukte

## 2. Leitidee des Vergleichs
Die Untersuchung soll beantworten, wie sich beide Datenbankmodelle bei demselben fachlichen Problem verhalten:
* Wie aufwendig ist die Modellierung hierarchischer Produktdaten?
* Wie stark unterscheiden sich Lese- und Schreiboperationen?
* Wie teuer werden spaetere Anforderungsaenderungen?
* Wie unterschiedlich ist die Developer Experience im Backend?

Docker dient dabei nur als **neutrales Testlabor**, damit beide Datenbanken auf identischer Hardware und unter denselben Netzwerkbedingungen laufen. MongoDB Atlas wird erst spaeter als **Betriebs- und Skalierungs-Ausblick** eingeordnet.

## 3. Fachliches Vergleichsszenario
Als gemeinsames Fachszenario bleibt der bestehende **E-Commerce Produktkatalog** erhalten. Er ist geeignet, weil er sowohl strukturierte als auch halbstrukturierte Daten enthaelt.

### Gemeinsame Kerndaten
* Produktstammdaten: `sku`, `name`, `description`, `price`, `category`, `stock`
* variable Produktattribute: z. B. `size`, `color`, `ram`, `cpu`
* Bewertungen: `user`, `rating`, `comment`, `date`
* Tags fuer Suche und Kategorisierung
* Analytics-Daten fuer Aggregationen ueber Kategorien, Preise und Reviews

### Geplanter Aenderungsfall fuer die Auswertung
Um die Modellierungsflexibilitaet sichtbar zu machen, wird zusaetzlich eine Anforderung simuliert:

"Jede Bewertung erhaelt ein Feld `reactions`, das mehrere Reaktionstypen wie `like`, `heart` oder `helpful` speichern kann."

Dieser Aenderungsfall wird fuer beide Datenbanken dokumentiert und verglichen.

## 4. Zielarchitektur

### 4.1 Docker als neutrales Testlabor
Der Vergleich findet lokal in Docker Compose statt. Das Setup umfasst:
* einen Backend-Container
* einen Frontend-Container
* einen MongoDB-Container
* einen PostgreSQL-Container

Vorteil dieses Aufbaus:
* gleiche Hardware
* gleiche Host-Maschine
* gleiche Netzwerkstrecke innerhalb des Compose-Netzes
* wiederholbare Benchmarks ohne externe Cloud-Latenzen

### 4.2 Atlas als nachgelagerter Ausblick
Atlas wird nicht fuer Performance-Messungen genutzt. Stattdessen wird Atlas spaeter verwendet, um zu zeigen:
* wie einfach sich MongoDB in einer Managed-Umgebung betreiben laesst
* welche betrieblichen Vorteile ein Managed Service bietet
* dass der dokumentenorientierte Ansatz ueber das lokale Demo-Setup hinaus produktionsnah einsetzbar ist

## 5. Vergleich der Datenmodellierung

### 5.1 PostgreSQL als relationale Referenz
Arbeitsannahme fuer das Umsetzungskonzept ist **PostgreSQL**, weil es in Docker leicht betreibbar ist, eine starke SQL-Referenz darstellt und saubere JOIN-, Index- und Migrationskonzepte fuer die Ausarbeitung bietet.

Moegliches relationales Schema:
* `products`
* `categories`
* `product_attributes` oder alternativ kategoriebasierte Spezialisierungstabellen
* `reviews`
* `review_reactions` fuer den spaeteren Aenderungsfall
* `product_tags` als Join-Tabelle

Zu untersuchende Punkte:
* Anzahl benoetigter Tabellen
* Notwendigkeit von JOINs
* Migrationsaufwand bei Schemaaenderungen
* Klarheit und Strenge der Datenintegritaet

### 5.2 MongoDB als dokumentenorientierte Referenz
MongoDB speichert die zusammengehoerigen Daten bevorzugt in einem Produktdokument.

Moegliche Struktur:
* zentrale Collection `products`
* `attributes` als flexibles Objekt
* `reviews` als eingebettetes Array von Subdokumenten
* `reactions` direkt innerhalb eines Review-Subdokuments
* `tags` als Array im Produktdokument

Zu untersuchende Punkte:
* geringerer Bedarf an JOIN-aehnlichen Operationen
* direkter Zugriff auf hierarchische Daten
* flexible Erweiterung der Struktur
* Risiko uneinheitlicher Daten ohne konsequente Validierung

## 6. Umsetzung im Backend
Der Vergleich soll nicht nur auf Datenbankschemata basieren, sondern auch auf der Code-Ebene.

### 6.1 Gemeinsame API-Oberflaeche
Fuer beide Datenbanken sollen identische oder zumindest fachlich gleichwertige Use Cases unter derselben API-Struktur abgebildet werden:
* Produktliste abrufen
* Produktdetails mit Bewertungen laden
* Bewertung hinzufuegen
* Analytics abrufen
* Seed-Daten erzeugen

Wichtig ist dabei, dass nicht zwei verschiedene Fachlogiken verglichen werden, sondern zwei Datenzugriffsstrategien fuer dieselben Anforderungen.

### 6.2 Vergleich der Developer Experience
Im Textteil der Ausarbeitung wird der Backend-Code bewusst gegenuebergestellt:
* SQL-Queries oder ORM-nahe Abbildung in PostgreSQL
* direkte Dokument-Queries und Updates mit dem MongoDB-Treiber
* Aufwand fuer Insert, Read, Update und Aggregation
* Lesbarkeit und Wartbarkeit der jeweiligen Implementierung

## 7. Messkonzept

### 7.1 Messprinzipien
Damit die Ergebnisse belastbar bleiben, gelten folgende Regeln:
* identischer Datensatz fuer beide Datenbanken
* gleiche Hardware und gleiche Docker-Umgebung
* gleiche Anzahl an Wiederholungen pro Messung
* getrennte Messung von Warm-up und eigentlicher Messreihe
* Erfassung von Durchschnitt, Median und Ausreissern

### 7.2 Kernmetriken
Die Ausarbeitung konzentriert sich auf wenige, aber aussagekraeftige Metriken.

**1. Lese-Performance bei hierarchischen Daten**
Messung der Zeit in Millisekunden fuer das Laden eines Produkts mit:
* vielen Reviews
* mehreren Tags
* variablen Attributen

Vergleichspunkt:
* PostgreSQL mit JOINs ueber mehrere Tabellen
* MongoDB mit einem eingebetteten Dokument

**2. Schreib-Performance bei Bulk-Insert**
Messung der Zeit fuer das Einspielen einer grossen Datenmenge, zum Beispiel 10.000 Produkten.

Vergleichspunkt:
* Batch-Insert in relationale Tabellen inklusive Nebentabellen
* `insertMany()` bzw. Bulk-Operationen in MongoDB

**3. Aufwand bei Anforderungsaenderung**
Qualitativer und technischer Vergleich des Aenderungsfalls `reactions`:
* neue Tabellen, Migrationen und Anpassungen in PostgreSQL
* Erweiterung der Dokumentstruktur und Validierung in MongoDB

**4. Developer Experience**
Vergleich der Implementierung anhand von:
* Umfang des Datenzugriffscodes
* Komplexitaet der Queries
* notwendigem Mapping zwischen Fachobjekt und Datenbankstruktur

## 8. Erwartete Trade-offs
Die Ausarbeitung soll keine einseitige Werbeschrift werden, sondern klar benennen, wo welches Modell staerker ist.

### Erwartete Staerken von PostgreSQL
* hohe strukturelle Klarheit
* starke Integritaetsregeln
* gut nachvollziehbare Relationen
* saubere Kontrolle von Migrationen und Constraints

### Erwartete Staerken von MongoDB
* natuerliche Abbildung hierarchischer Daten
* flexible Erweiterbarkeit der Dokumentstruktur
* geringe Reibung bei eingebetteten Teilobjekten
* einfache Modellierung dynamischer Attribute

### Erwartete Schwaechen, die explizit diskutiert werden sollen
* MongoDB kann durch redundante Feldnamen und eingebettete Daten mehr Speicher verbrauchen.
* PostgreSQL kann bei stark verschachtelten Fachobjekten mehr Mapping- und JOIN-Aufwand erzeugen.
* MongoDB benoetigt disziplinierte Validierung, wenn Schemafreiheit nicht zu Inkonsistenzen fuehren soll.
* PostgreSQL reagiert auf spontane Strukturwechsel haeufig mit hoeherem Migrationsaufwand.

## 9. Geplanter Arbeitsablauf

### Arbeitspaket 1: Vergleichsbasis herstellen
* PostgreSQL in das lokale Docker-Setup aufnehmen
* gemeinsames Seed-Szenario fuer beide Datenbanken definieren
* identische Testdaten und Testfaelle festlegen

### Arbeitspaket 2: Datenmodelle ausarbeiten
* relationales Schema fuer PostgreSQL modellieren
* Dokumentstruktur fuer MongoDB finalisieren
* Aenderungsfall `reactions` fuer beide Varianten vorbereiten

### Arbeitspaket 3: Backend-Vergleich implementieren
* gleiche Use Cases fuer beide Datenbanken umsetzen
* Datenzugriffsschicht fuer PostgreSQL ergaenzen
* MongoDB-Implementierung an der Vergleichslogik ausrichten

### Arbeitspaket 4: Messungen durchfuehren
* Lese- und Schreibszenarien automatisieren
* mehrere Messreihen ausfuehren
* Ergebnisse tabellarisch dokumentieren

### Arbeitspaket 5: Auswertung und Ausblick schreiben
* technische Ergebnisse interpretieren
* Developer-Experience-Vergleich formulieren
* Atlas als produktionsnahen Ausblick einordnen

## 10. Ergebnis fuer die Ausarbeitung
Mit diesem Aufbau bleibt die Arbeit fachlich konsistent:
* **Hauptthema:** relational vs. dokumentenorientiert
* **Methodik:** fairer Vergleich im lokalen Docker-Testlabor
* **Praxisbezug:** Atlas als spaetere Betriebsoption, nicht als Stoerfaktor im Benchmark

Dadurch wird aus dem bisherigen MongoDB-Showcase ein belastbares Vergleichsprojekt mit klarem wissenschaftlichem Fokus und einer nachvollziehbaren Umsetzungsstrategie.

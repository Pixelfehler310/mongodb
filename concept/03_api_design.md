# 3. API Design (Middle Layer)

Um die flexiblen Daten aus MongoDB für das Frontend nutzbar zu machen und die Vorteile der Datenbank zu demonstrieren, implementieren wir folgende REST-API-Endpunkte in unserem Node.js-Backend. 

Da wir **viele verschiedene Produktkategorien** haben, liegt ein Fokus auf dynamischem Filtern und dem Auslesen dynamischer Metadaten.

## Datenbank-Toggle

Das Frontend kann über den Query-Parameter `?db=mongo` (Standard) oder `?db=postgres` zwischen den beiden Datenbankbackends wechseln. Das Backend leitet die Anfrage transparent an die jeweils passende Datenzugriffsschicht weiter. Dadurch bleibt die API-Oberflaeche fuer beide Datenbanken identisch — der Unterschied liegt ausschliesslich in der Implementierung der Datenzugriffsschicht.

## Endpunkte

### 1. Produkte abrufen & filtern
* **Route:** `GET /api/products`
* **Beschreibung:** Listet Produkte auf. Demonstriert, wie einfach MongoDB mit dynamischen JSON-Queries umgeht.
* **Query-Parameter (Beispiele):**
  * `?category=Electronics` (Nach Kategorie filtern)
  * `?attributes.ram=16GB` (Tiefes Filtern in dynamischen Attributen)
  * `?price_lt=100` (Preis unter 100)
* **MongoDB Feature:** Flexibles Querying von Nested Fields (`"attributes.key": "value"`).

### 2. Alle verfügbaren Kategorien abrufen
* **Route:** `GET /api/categories`
* **Beschreibung:** Gibt eine flache Liste aller im System existierenden Kategorien zurück (z.B. Clothing, Electronics, Furniture, Books, Food).
* **MongoDB Feature:** `db.products.distinct("category")` – Extrem schnelle Ermittlung aller einzigartigen Werte eines Feldes über Millionen von Dokumenten.

### 3. Produkt-Details abrufen
* **Route:** `GET /api/products/:id`
* **Beschreibung:** Holt ein einzelnes Produkt inklusive aller eingebetteten Reviews.
* **MongoDB Feature:** 1 Lesezugriff statt komplexer SQL-JOINs.

### 4. Ein Review hinzufügen
* **Route:** `POST /api/products/:id/reviews`
* **Body:** `{ "user": "Alice", "rating": 5, "comment": "Klasse!" }`
* **Beschreibung:** Fügt einem existierenden Produkt eine neue Bewertung hinzu.
* **MongoDB Feature:** Der `$push` Update-Operator. Erweitert das `reviews`-Array im Dokument effizient, ohne das gesamte Dokument neu schreiben zu müssen.

### 5. Aggregation & Analytics Dashboard
* **Route:** `GET /api/analytics`
* **Beschreibung:** Berechnet Statistiken über alle (vielen verschiedenen) Kategorien hinweg für ein Dashboard im Frontend.
* **Beispiel-Statistiken:**
  * Durchschnittspreis pro Kategorie.
  * Anzahl der Produkte pro Kategorie.
  * Produkte mit der besten Durchschnittsbewertung.
* **MongoDB Feature:** **Aggregation Pipeline** (`$match`, `$unwind`, `$group`, `$sort`). Zeigt, wie mächtig MongoDB bei der Datenanalyse in Echtzeit ist.

### 6. Mock-Daten generieren (Seed)
* **Route:** `POST /api/seed`
* **Beschreibung:** Generiert initial eine große Menge an Produkten aus verschiedensten Kategorien (Möbel, Kleidung, Software, Lebensmittel, etc.), um die Datenbank für die Präsentation zu füllen.
* **MongoDB Feature:** `insertMany()` für schnelle Massen-Inserts.
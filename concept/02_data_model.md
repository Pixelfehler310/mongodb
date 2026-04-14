# 2. Datenmodell (Schema Design)

In einer klassischen SQL-Datenbank bräuchten wir für dieses E-Commerce-Szenario mindestens drei bis vier Tabellen (z.B. `Products`, `Product_Attributes`, `Categories`, `Reviews`) und müssten diese mit aufwändigen `JOIN`-Abfragen verknüpfen (Entity-Attribute-Value Pattern).

In **MongoDB** nutzen wir die Stärke der Dokumentenorientierung: Wir speichern zusammengehörige Daten gemeinsam in einem einzigen JSON/BSON-Dokument in der Collection `products`. 

Hier zeigen wir zwei Ausprägungen des Projekt-Datensatzes, um das **flexible Schema (Polymorphismus)** und **Embedded Documents** zu demonstrieren.

## Die `products` Collection

### Beispiel 1: Ein Kleidungsstück (T-Shirt)
```json
{
  "_id": {"$oid": "60d5ec49f1b2c8b1f8e4e1a1"},
  "sku": "TSHIRT-BASIC-BLK-M",
  "name": "Basic Cotton T-Shirt",
  "description": "Ein bequemes Basic-Shirt aus 100% Baumwolle.",
  "price": 19.99,
  "category": "Clothing",
  "stock": 150,
  
  // 🌟 FLEXIBLES SCHEMA: Attribute spezifisch für Kleidung
  "attributes": {
    "size": "M",
    "color": "Black",
    "material": "Cotton"
  },

  // 🌟 EMBEDDED DOCUMENTS: Reviews sind direkt im Produkt gespeichert (Kein JOIN nötig!)
  "reviews": [
    {
      "user": "Max Mustermann",
      "rating": 5,
      "comment": "Passt perfekt und Qualität ist super!",
      "date": {"$date": "2026-04-10T10:00:00Z"}
    },
    {
      "user": "Anna Schmidt",
      "rating": 4,
      "comment": "Gutes Shirt, blutet minimal beim ersten Waschen aus.",
      "date": {"$date": "2026-04-12T14:30:00Z"}
    }
  ],
  
  // Array für einfache Tags
  "tags": ["basic", "summer", "black", "unisex"]
}
```

### Beispiel 2: Ein Elektronikartikel (Laptop)
*Fällt in dieselbe Collection, hat aber völlig andere Attribute und keine Reviews (leeres Array).*

```json
{
  "_id": {"$oid": "60d5ec49f1b2c8b1f8e4e1a2"},
  "sku": "LAP-MBP-14-M3",
  "name": "MacBook Pro 14\"",
  "description": "Apple M3 Chip, perfekt für Entwickler.",
  "price": 1999.00,
  "category": "Electronics",
  "stock": 23,
  
  // 🌟 FLEXIBLES SCHEMA: Völlig andere Struktur als beim T-Shirt
  "attributes": {
    "cpu": "Apple M3 Pro",
    "ram": "18GB",
    "storage": "512GB SSD",
    "screen_size": 14.2
  },

  "reviews": [],
  "tags": ["apple", "laptop", "programming", "pro"]
}
```

## Vorteile für die Präsentation
1. **Kein JOIN für Reviews:** Das Laden der Produkt-Detailseite erfordert genau **einen** Lesezugriff auf die Festplatte/Datenbank.
2. **Keine EAV-Tabellen:** Wir müssen nicht umständlich Attribute joinen. Egal ob das Frontend Filter für `attributes.ram` oder `attributes.size` anbietet, MongoDB kann Indizes direkt auf diese eingebetteten Felder legen.

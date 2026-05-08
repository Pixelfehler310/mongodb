# 08. Wissenschaftliches Analysekonzept fuer den Datenbankvergleich

## 1. Ziel des Analysekonzepts

Dieses Dokument beschreibt ein wissenschaftlich belastbares Analysekonzept fuer den Vergleich von drei strukturellen Datenbankansaetzen am gemeinsamen Fachszenario eines E-Commerce-Produktkatalogs mit Analytics.

Verglichen werden drei Modelltypen:

1. **Dokumentenorientiert:** MongoDB mit eingebetteten Reviews, Tags und flexiblen Attributen im Produktdokument.
2. **Rein relational:** PostgreSQL mit normalisierten Tabellen fuer Produkte, Attribute, Tags und Reviews.
3. **Hybrid relational-dokumentenorientiert:** PostgreSQL mit klassischer relationaler Kernstruktur und JSONB-Feldern fuer flexible oder verschachtelte Teilstrukturen.

Das Ziel ist nicht, einen pauschalen Sieger zu kueren, sondern die Frage zu beantworten, **welcher Modelltyp fuer welche Anforderungsklasse die besseren Eigenschaften besitzt**. Dabei werden nicht nur Performance, sondern auch Modellierungsaufwand, Schemaflexibilitaet, Wartbarkeit und Skalierungsverhalten betrachtet.

## 2. Forschungsfragen

Die Untersuchung soll die folgenden Leitfragen beantworten:

1. Welcher Modelltyp bildet das gegebene Fachproblem am natuerlichsten ab?
2. Welche Unterschiede ergeben sich bei Lese-, Schreib-, Such- und Analytics-Workloads?
3. Wie stark unterscheiden sich die Systeme bei Tail-Latenzen, nicht nur im Mittelwert?
4. Wie gross ist der Aufwand fuer Anforderungsaenderungen mit variablen oder tiefer verschachtelten Daten?
5. Inwieweit kann ein hybrider JSONB-Ansatz die Vorteile relationaler und dokumentenorientierter Systeme kombinieren?

## 3. Die drei zu vergleichenden Strukturen

### 3.1 MongoDB als dokumentenorientierte Struktur

MongoDB speichert ein Produkt als fachlich zusammenhaengendes Dokument.

Typische Struktur:

* Produktstammdaten als Top-Level-Felder
* `attributes` als flexibles Objekt mit kategoriebasiert variierenden Feldern
* `reviews` als eingebettetes Array von Subdokumenten
* `tags` als String-Array

Wissenschaftlich relevante Eigenschaften:

* sehr natuerliche Abbildung hierarchischer und variabler Daten
* geringer Mapping-Aufwand zwischen API-Objekt und Persistenzmodell
* gute Voraussetzungen fuer dokumentnahe Point-Reads
* Risiko groesserer Dokumente, redundanter Felder und schwierigerer globaler Analytics

### 3.2 PostgreSQL als rein relationale Struktur

Der rein relationale Ansatz zerlegt das Fachobjekt in mehrere logisch getrennte Tabellen. Im aktuellen Projekt entspricht dies dem implementierten Vergleichsmodell mit `products`, `product_attributes`, `product_tags` und `reviews`.

Typische Struktur:

* `products` fuer Kernfelder
* `product_attributes` fuer variable Attribute in Zeilenform
* `product_tags` fuer Schlagwoerter
* `reviews` fuer Bewertungen

Wissenschaftlich relevante Eigenschaften:

* hohe Datenintegritaet durch Constraints und Fremdschluessel
* starke SQL- und Aggregationsfaehigkeiten
* gute Voraussetzungen fuer analytische, filterlastige und relationale Abfragen
* hoeherer JOIN- und Mapping-Aufwand bei zusammengesetzten Fachobjekten

### 3.3 PostgreSQL als hybrider JSONB-Ansatz

Der hybride Ansatz kombiniert relationale Kernfelder mit JSONB-Feldern fuer flexible oder verschachtelte Daten. Er ist im aktuellen Projekt noch nicht implementiert, muss fuer einen dreiseitigen Strukturvergleich jedoch als eigener Vergleichskandidat konzipiert werden.

Typische Struktur:

* `products` als relationale Kerntabelle fuer `id`, `sku`, `name`, `price`, `category`, `stock`, Zeitstempel
* `attributes JSONB` fuer variable Produkteigenschaften
* optional `reviews JSONB` oder `review_payload JSONB` fuer verschachtelte Bewertungsstruktur
* GIN-Indizes oder funktionale Indizes auf JSONB-Pfade fuer haeufige Suchmuster

Wissenschaftlich relevante Eigenschaften:

* verbindet relationale Integritaet mit teilweiser Schemaflexibilitaet
* reduziert Zerlegung und Mapping bei flexiblen Attributen
* bleibt fuer klassische SQL-Aggregationen gut nutzbar
* kann weder die relationale noch die dokumentenorientierte Seite in jedem Spezialfall vollstaendig ersetzen

## 4. Vergleichsdesign und Randbedingungen

Damit die Ergebnisse wissenschaftlich belastbar bleiben, sind folgende Randbedingungen verbindlich:

* identische Hardware fuer alle Testkandidaten
* identische Docker- oder Container-Umgebung
* identischer deterministischer Seed-Datensatz
* identische API-Semantik fuer alle Systeme
* gleiche Lastparameter je Szenario
* gleiche Anzahl an Wiederholungen pro Szenario
* feste Warm-up-Phase vor jeder Messphase
* getrennte Erfassung von Warm-up und Messphase
* randomisierte oder rotierende Reihenfolge der Datenbanklaeufe, um Reihenfolgeeffekte zu reduzieren

Empfohlene Basisparameter:

* mindestens 3, besser 5 Wiederholungen pro Kombination
* Warm-up 30 Sekunden
* Messdauer 60 Sekunden bei Lese- und Suchszenarien
* separater Einzel- oder Batch-Run fuer Bulk-Insert
* Seed-Groessen in mehreren Stufen, zum Beispiel 10.000, 100.000 und 1.000.000 Produkte

## 5. Notwendige Testfaelle

Die Testfaelle muessen so gewaehlt werden, dass die vermuteten Staerken und Schwaechen aller drei Strukturtypen sichtbar werden. Einzelne Szenarien genuegen nicht; erforderlich ist eine mehrdimensionale Workload-Matrix.

### 5.1 Point Read

**Beschreibung:** Laden eines einzelnen Produkts inklusive aller zugehoerigen Reviews, Tags und Attribute.

**Warum notwendig:**

* testet den natuerlichsten Vorteil dokumentorientierter Modellierung
* zeigt den JOIN- bzw. Rekonstruktionsaufwand auf relationaler Seite
* zeigt, ob JSONB die Luecke zwischen beiden Modellen schliessen kann

**Messziel:** Produktdetailzugriff unter realistischer Parallelitaet.

### 5.2 Bulk Read

**Beschreibung:** Laden einer groesseren Produktmenge pro Request, zum Beispiel `limit=100`, inklusive typischer Sortierung.

**Warum notwendig:**

* testet throughput-orientierte Leselast
* zeigt, wie effizient grosse Ergebnismengen seriell oder in Seiten geliefert werden
* zeigt den Einfluss von Dokumentgroesse versus Zeilenstruktur

**Messziel:** Vergleich von Durchsatz, Speicherverbrauch und Tail-Latenz bei groesseren Antwortpayloads.

### 5.3 Category Filter

**Beschreibung:** Listenabfrage mit Kategorieeinschraenkung.

**Warum notwendig:**

* bildet einen sehr typischen Katalog-Use-Case ab
* prueft einfache Indexnutzung
* dient als Baseline fuer filterbasierte Browse-Workloads

### 5.4 Attribute Filter

**Beschreibung:** Abfrage nach flexiblen Produkteigenschaften wie `attributes.ram_gb=16`.

**Warum notwendig:**

* dies ist der zentrale Vergleichspunkt zwischen starrem, flexiblem und hybridem Schema
* zeigt, wie teuer flexible Attribute im relationalen Modell werden
* prueft, ob JSONB einen methodisch interessanten Mittelweg bildet

### 5.5 Text Search

**Beschreibung:** Suche nach Begriffen ueber Name, Beschreibung und Tags.

**Warum notwendig:**

* textuelle Suche ist ein klassischer E-Commerce-Fall
* testet Indexstrategien und Query-Optimierung
* zeigt, ob eine dokumentenorientierte Modellierung hier automatisch im Vorteil ist oder nicht

### 5.6 Analytics Rollup

**Beschreibung:** Aggregation ueber Kategorien, Preise, Bewertungen und Top-Produkte.

**Warum notwendig:**

* testet analytische Faehigkeiten statt nur API-nahe CRUD-Workloads
* zeigt die Staerke relationaler Systeme bei Gruppierung und Aggregation
* prueft, ob der JSONB-Ansatz analytisch naeher am relationalen oder am dokumentenorientierten Lager liegt

### 5.7 Single Write / Review Append

**Beschreibung:** Hinzufuegen einer einzelnen Bewertung zu einem bestehenden Produkt.

**Warum notwendig:**

* dokumentiert die Kosten eines kleinen, fachlich zusammenhaengenden Updates
* testet eingebettete Updates gegen relationale Insert-Pfade
* ist relevant fuer reale interaktive Systeme

### 5.8 Bulk Insert

**Beschreibung:** Massenhaftes Einspielen neuer Produkte mit Attributen, Tags und Reviews.

**Warum notwendig:**

* testet Batch-Schreiblast
* macht Insert- und Transaktionskosten sichtbar
* erlaubt die Beobachtung von Write Amplification, WAL-Last und Insert-Strategien

### 5.9 Schema Evolution / Anforderungsaenderung

**Beschreibung:** Einfuehrung eines neuen Feldes wie `reactions` innerhalb von Reviews.

**Warum notwendig:**

* dies ist kein reiner Laufzeittest, sondern ein Strukturtest
* bewertet den Aufwand fuer Evolution des Datenmodells
* ist zentral, wenn Flexibilitaet als Argument fuer MongoDB oder JSONB diskutiert wird

### 5.10 Optional: Mixed Workload

**Beschreibung:** Mischung aus Point Reads, Filter-Reads, Single Writes und Analytics-Anteilen.

**Warum notwendig:**

* reale Systeme bestehen selten aus nur einem Zugriffsmuster
* zeigt, welche Struktur unter gemischter Last robust bleibt

## 6. Metriken, die erfasst werden sollten

Eine wissenschaftlich belastbare Analyse darf nicht nur `req/s` und Durchschnittslatenz betrachten. Erforderlich ist ein Metrikset, das sowohl Nutzerwirkung als auch Systemverhalten abbildet.

### 6.1 Durchsatzmetriken

* **Requests pro Sekunde (RPS):** Zeigt, wie viel Last ein System unter gegebener Parallelitaet verarbeiten kann.
* **Operationen pro Sekunde bei Writes:** Relevant fuer Bulk-Insert und Single-Write-Szenarien.

**Warum:** Durchsatz operationalisiert Kapazitaet. Ein System kann niedrige Latenzen haben, aber dennoch wenig Gesamtlast verarbeiten.

### 6.2 Latenzmetriken

* **Durchschnittslatenz:** liefert einen groben Gesamtwert, ist aber allein nicht ausreichend.
* **Median / P50:** repraesentiert den typischen Request.
* **P95:** zeigt Tail-Latenz fuer schlechte, aber noch haeufige Faelle.
* **P99:** zeigt starke Ausreisser und Stabilitaetsprobleme.
* **Max:** als Indikator fuer extreme Ausreisser, jedoch nur interpretierbar zusammen mit P95/P99.

**Warum:** Datenbanksysteme zeigen unter Last oft schiefe Verteilungen. Gerade fuer Nutzererfahrung und Stabilitaet sind P95 und P99 wichtiger als der Mittelwert.

### 6.3 Erfolgs- und Fehlermetriken

* **Success Rate / Check Rate:** Anteil fachlich korrekter Antworten.
* **HTTP-Fehlerrate:** Statuscodes `4xx` und `5xx`.
* **Timeout-Rate:** wichtig fuer Tail-Latenz und Lastgrenzen.

**Warum:** Hoher Durchsatz ist wertlos, wenn Antworten fachlich falsch oder instabil sind.

### 6.4 Ressourcenmetriken

* **CPU-Auslastung pro Datenbankcontainer**
* **RAM-Verbrauch**
* **Disk I/O / IOPS**
* **Netzwerkvolumen**

**Warum:** Diese Metriken erklaeren, warum ein System schneller oder langsamer ist. Ohne Ressourcenmetriken bleibt die Interpretation oft spekulativ.

### 6.5 Daten- und Speichermetriken

* **Gesamtspeicherbedarf des Datensatzes**
* **Indexgroesse**
* **Wachstum bei groesserem Seed**

**Warum:** Ein System kann schnelle Reads erkaufen, indem es mehr Speicher oder groessere Indizes verbraucht. Das ist fuer die Gesamteinordnung wichtig.

### 6.6 Stabilitaetsmetriken ueber Wiederholungen

* **Spanne zwischen Minimal- und Maximalwerten je Szenario**
* **Standardabweichung oder Variationskoeffizient**
* **Vergleich der Ergebnisse ueber 3-5 Laeufe**

**Warum:** Einzelne Messungen koennen Zufall oder Ausreisser enthalten. Wissenschaftlich tragfaehig werden die Ergebnisse erst durch Wiederholung und Streuungsbetrachtung.

### 6.7 Struktur- und Entwicklungsmetriken

Diese Metriken sind qualitativ oder halbquantitativ, aber fuer die Arbeit sehr wertvoll:

* Anzahl benoetigter Tabellen bzw. Dokumentsegmente
* Anzahl betroffener Dateien fuer eine Anforderungsaenderung
* Anzahl Query- oder Mapping-Schritte im Backend
* Anzahl benoetigter Migrationen
* subjektiv begruendete Komplexitaetsbewertung der Datenzugriffsschicht

**Warum:** Wenn Flexibilitaet und Modellierungsaufwand zentrale Forschungsfragen sind, reicht eine reine Laufzeitmessung nicht aus.

## 7. Hypothesen, die geprueft werden sollen

### 7.1 Strukturbezogene Hypothesen

**H1:** MongoDB bildet den Produktkatalog mit variablen Attributen und eingebetteten Reviews mit dem geringsten Modellierungsaufwand ab.

**H2:** PostgreSQL als rein relationales Modell bietet die hoechste strukturelle Strenge und die sauberste Integritaetskontrolle, erfordert dafuer aber mehr Zerlegung und Mapping.

**H3:** PostgreSQL mit JSONB reduziert den Modellierungsaufwand gegenueber dem rein relationalen Modell deutlich, ohne die relationalen Vorteile vollstaendig aufzugeben.

### 7.2 Performancebezogene Hypothesen

**H4:** MongoDB erzielt beim Point Read die beste oder zumindest gleichwertige Performance, weil fachlich zusammengehoerige Daten in einem Dokument gelesen werden koennen.

**H5:** PostgreSQL rein relational erzielt bei Analytics Rollup die beste Performance, weil SQL-Aggregation und Gruppierung hier natuerlich stark sind.

**H6:** PostgreSQL rein relational oder hybrid erzielt bei Bulk Read, Category Filter und Text Search die stabilsten Tail-Latenzen.

**H7:** Der JSONB-Ansatz liegt bei Attribute Filter und Point Read zwischen MongoDB und dem rein relationalen PostgreSQL-Modell oder kann diese beiden in einzelnen Faellen sogar angleichen.

**H8:** MongoDB zeigt Vorteile bei Write-nahen und dokumentenorientierten Zugriffen, waehrend PostgreSQL vor allem bei analytischen und filterlastigen Queries profitiert.

### 7.3 Evolutionsbezogene Hypothesen

**H9:** Die Einfuehrung eines neuen verschachtelten Feldes wie `reactions` ist in MongoDB am einfachsten, im JSONB-Modell zweitam einfachsten und im rein relationalen Modell am aufwendigsten.

**H10:** Die Flexibilitaetsgewinne des JSONB-Ansatzes gehen mit einem Teilverlust an relationaler Klarheit und moeglicherweise anspruchsvollerer Indexstrategie einher.

## 8. Prognose des zu erwartenden Outcomes

Auf Basis des bestehenden Projektwissens, allgemeiner Datenbankprinzipien und der bereits beobachteten Ergebnisse im Zweiervergleich ist folgende Prognose plausibel:

### 8.1 MongoDB

Erwarteter Staerkebereich:

* Point Read
* Single Write / Review Append
* Schema Evolution
* geringe Reibung bei variablen Attributen

Erwartete Grenzen:

* Analytics Rollup
* komplexe, filterlastige Listen mit vielen Vergleichsoperatoren
* moeglicherweise hoeherer Speicherbedarf durch eingebettete und redundantere Strukturen

### 8.2 PostgreSQL rein relational

Erwarteter Staerkebereich:

* Analytics Rollup
* Category Filter
* Bulk Read
* strukturierte Text- und Suchszenarien bei guter Indexierung

Erwartete Grenzen:

* hoeherer Modellierungs- und Mapping-Aufwand
* komplexere Rekonstruktion eines vollstaendigen Produktobjekts
* hoeherer Aenderungsaufwand bei flexiblen oder tief verschachtelten Fachobjekten

### 8.3 PostgreSQL hybrid mit JSONB

Erwarteter Staerkebereich:

* flexible Attribute mit geringerem Zerlegungsaufwand als im reinen Relationenmodell
* gute Balance zwischen Integritaet und Flexibilitaet
* moeglich nahe an MongoDB beim Point Read und nahe am relationalen Modell bei Analytics, sofern Kernfelder relational bleiben

Erwartete Grenzen:

* nicht zwingend Bestwert in den Spezialdisziplinen
* komplexe Index- und Query-Planung auf JSONB-Feldern
* Gefahr eines Kompromissmodells, das operativ anspruchsvoller ist als beide klaren Extreme

### 8.4 Gesamtprognose

Der wahrscheinlichste Gesamtausgang ist **kein absoluter Gesamtsieger**, sondern ein workload-abhaengiges Muster:

* MongoDB gewinnt die natuerlich dokumentenzentrierten Faelle.
* PostgreSQL rein relational gewinnt die analytischen und stark strukturierten Faelle.
* PostgreSQL JSONB positioniert sich als Mittelweg und kann in mehreren Szenarien einen grossen Teil der Mongo-Vorteile aufnehmen, ohne die SQL-Welt vollstaendig zu verlassen.

Genau diese Differenzierung waere ein wissenschaftlich starkes Ergebnis, weil sie die vereinfachende Annahme widerlegt, dokumentenorientierte Systeme seien in solchen Domainen pauschal schneller.

## 9. Konkrete Auswertungslogik

Fuer die spaetere Auswertung empfiehlt sich folgende Logik:

1. Zuerst Szenarien getrennt analysieren, nicht alle Metriken zu einer Gesamtnote vermischen.
2. Danach die Strukturtypen je Szenarioklasse vergleichen: Point Read, Filter, Search, Analytics, Write.
3. Tail-Latenzen immer mindestens gleichrangig zum Durchsatz diskutieren.
4. Unterschiede unter 5 Prozent nur vorsichtig interpretieren, besonders bei hoher Streuung.
5. Hohe Effektstaerken mit niedriger Streuung als starkes Signal kennzeichnen.
6. Kleine Effektstaerken bei hoher Streuung als offen oder nicht belastbar einstufen.
7. Struktur- und Entwicklungsaufwand als zweiten Auswertungsstrang neben der Performance fuehren.

## 10. Bedrohungen der Validitaet

Das Analysekonzept muss offen benennen, welche Grenzen die Aussagekraft einschraenken koennen:

* Benchmark-Ergebnisse gelten immer nur fuer das konkrete Datenmodell, die konkrete Indexierung und die konkrete API-Implementierung.
* Ein fairer Vergleich setzt gleichwertige, nicht nur funktional korrekte, sondern auch sinnvoll optimierte Queries voraus.
* Ein implementierter Zweiervergleich zwischen MongoDB und rein relationalem PostgreSQL erlaubt keine harten Aussagen ueber JSONB, solange der hybride Kandidat nicht wirklich umgesetzt wurde.
* Kleine Seeds koennen untypische Ergebnisse erzeugen, wenn das Working Set vollstaendig im RAM verbleibt.
* Ein In-App-Runner ist fuer Exploration nuetzlich, die massgebliche wissenschaftliche Quelle sollte jedoch der reproduzierbare k6-Pfad bleiben.

## 11. Kurzer Skalierungsausblick

Bei staerkerer Skalierung mit deutlich besserer Hardware und sehr viel groesseren Datenmengen duerften sich die Verhaeltnisse teilweise verschieben. Solange alle relevanten Daten und Indizes im RAM liegen, profitieren meist alle Systeme stark, und Unterschiede koennen kleiner wirken. Sobald der Datensatz jedoch deutlich ueber das Working Set hinaus waechst, werden Indexqualitaet, I/O-Verhalten, Datenlokalitaet und horizontale Skalierbarkeit wichtiger. PostgreSQL duerfte dann seine Staerken bei strukturierten Filtern, Aggregationen und gut geplanten Indizes weiter ausspielen, waehrend MongoDB bei dokumentenzentrierten Zugriffen und horizontaler Verteilung grosser Write- oder Read-Last interessanter werden kann. Der hybride JSONB-Ansatz bleibt wahrscheinlich attraktiv, solange die Kernstruktur weiterhin relational optimierbar bleibt; bei sehr grossen Datenmengen kann er aber auch die Komplexitaet beider Welten kombinieren.

## 12. Ergebnis des Konzepts

Dieses Analysekonzept schafft eine saubere Basis fuer einen dreiseitigen Strukturvergleich. Es erweitert den bisherigen MongoDB-vs-PostgreSQL-Blick um einen fachlich wichtigen dritten Kandidaten: den hybriden JSONB-Ansatz. Dadurch kann die Arbeit nicht nur zeigen, **welches System schneller ist**, sondern vor allem, **welcher Strukturtyp fuer welche Anforderung sinnvoll ist**.

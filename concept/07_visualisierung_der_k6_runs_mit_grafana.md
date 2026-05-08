# 07. Visualisierung der k6-Runs mit Grafana

## 1. Ausgangslage
Im aktuellen Projekt existieren zwei unterschiedliche Performance-Pfade:

* ein **In-App-Performance-Runner** im Backend mit Live-Anzeige im Frontend
* ein **reproduzierbarer k6-Flow** unter `benchmark/` fuer die eigentliche Messung und Auswertung

Der In-App-Runner ist fuer eine Live-Demo gut geeignet, bildet aber methodisch nicht den eigentlichen Benchmark-Pfad ab. Der k6-Flow ist fachlich sauberer, liefert belastbarere Metriken und ist fuer die schriftliche Ausarbeitung besser geeignet, hat derzeit aber nur Konsolen- und JSON-Ausgabe.

Fuer die Praesentation und fuer eine bessere Nutzbarkeit der Benchmarks soll daher eine **grafische Live-Visualisierung der echten k6-Messungen** eingefuehrt werden.

## 2. Ziel des Konzepts
Das Ziel ist eine Architektur, bei der die eigentlichen Lasttests weiterhin mit **k6** ausgefuehrt werden, waehrend **Grafana** deren Metriken in Echtzeit visualisiert.

Damit werden drei Anforderungen gleichzeitig erfuellt:

* **wissenschaftliche Aussagekraft**: Die finalen Zahlen kommen weiterhin aus k6.
* **Live-Demo-Faehigkeit**: Die Messung kann waehrend des Runs in einer Weboberflaeche verfolgt werden.
* **nachvollziehbare Auswertung**: Die Ergebnisse sind nicht nur als JSON sichtbar, sondern in Diagrammen, Vergleichspanels und Kennzahlen.

## 3. Leitentscheidung

### 3.1 Kernentscheidung
Die sinnvollste Zielarchitektur fuer dieses Projekt ist:

* **k6** als Benchmarking-Engine
* **InfluxDB** als Zeitreihen-Speicher fuer k6-Metriken waehrend des Runs
* **Grafana** als Visualisierungs- und Dashboard-Schicht

### 3.2 Begruendung fuer diese Entscheidung
Diese Kombination ist fuer ein lokales Docker-Setup besonders geeignet, weil sie folgende Vorteile bietet:

* k6 kann Metriken waehrend des Laufs direkt in eine Zeitreihen-Datenbank schreiben.
* Grafana kann diese Daten ohne eigene Zwischenlogik live anzeigen.
* Die Architektur bleibt lokal, reproduzierbar und dockerisierbar.
* Es muss keine eigene Streaming- oder WebSocket-Infrastruktur fuer die k6-Messdaten gebaut werden.
* Die Trennung zwischen **Benchmark-Ausfuehrung** und **Visualisierung** bleibt sauber.

### 3.3 Warum nicht den In-App-Runner als Hauptpfad behalten?
Der In-App-Runner eignet sich fuer eine Demo, aber nicht optimal fuer die eigentliche methodische Auswertung. Es waere fachlich unguenstig, wenn die Live-Visualisierung und die wissenschaftlich genutzten Zahlen aus zwei verschiedenen Systemen stammen.

Deshalb soll mittelfristig gelten:

* **Live-Ansicht fuer die Demo** basiert auf echten k6-Runs.
* **Endauswertung fuer den Bericht** basiert ebenfalls auf k6-Runs.

Damit kommt beides aus derselben Messquelle.

## 4. Zielbild der Architektur

### 4.1 Komponenten
Das lokale Compose-Setup wird um zwei Dienste erweitert:

* `influxdb`
* `grafana`

Die Zielarchitektur besteht dann aus:

* `frontend`: Produkt-UI und ggf. Verlinkung zum Grafana-Dashboard
* `backend`: API fuer Katalog, Analytics, Seed und ggf. Benchmark-Steuerung
* `mongo`: MongoDB als Testkandidat
* `postgres`: PostgreSQL als Testkandidat
* `benchmark`: k6-Container fuer die Lasttests
* `influxdb`: Speicherung der laufenden k6-Metriken als Zeitreihe
* `grafana`: Live-Dashboard fuer Last, Latenz, Fehlerquote und Vergleich MongoDB vs. PostgreSQL

### 4.2 Datenfluss
Der Datenfluss sieht im Zielbild wie folgt aus:

1. Ein Benchmark wird per CLI oder spaeter ueber die Weboberflaeche gestartet.
2. Der `benchmark`-Container fuehrt ein k6-Skript aus.
3. k6 sendet seine Metriken waehrend des Runs an InfluxDB.
4. Grafana liest die aktuellen Metriken aus InfluxDB.
5. Das Dashboard aktualisiert sich waehrend der Ausfuehrung live.
6. Nach dem Lauf bleiben sowohl die JSON-Exports als auch die Zeitreihen fuer die Analyse erhalten.

Damit entstehen zwei Ebenen von Ergebnissen:

* **Live-Metriken in Grafana** fuer Demo und Beobachtung waehrend des Runs
* **JSON-basierte Summary-Dateien** fuer Archivierung, Nachbearbeitung und Aufnahme in den Bericht

## 5. Warum InfluxDB als Metrik-Store?

### 5.1 Starke Passung fuer den lokalen Demo-Fall
InfluxDB passt besonders gut zu diesem Projekt, weil der primaere Anwendungsfall nicht allgemeines Infrastruktur-Monitoring ist, sondern die **gezielte Visualisierung von Testlaeufen**.

Relevant sind hier vor allem:

* Requests pro Sekunde
* Antwortzeiten
* Fehlerquoten
* Vergleich zwischen `db_mode=mongo` und `db_mode=postgres`
* Vergleich zwischen mehreren Szenarien
* zeitlicher Verlauf waehrend eines einzelnen Runs

Genau fuer solche Zeitreihen-Daten ist InfluxDB gut geeignet.

### 5.2 Vorteil gegenueber einer Eigenloesung
Ohne InfluxDB muesste das Projekt selbst loesen:

* Entgegennahme der Metriken aus k6
* Zwischenspeicherung laufender Werte
* Aggregation nach Zeitfenstern
* Persistenz der Messwerte
* Bereitstellung fuer das Frontend

Mit InfluxDB und Grafana wird diese technische Komplexitaet aus dem eigentlichen Projektcode herausgezogen und in Standard-Werkzeuge verlagert.

### 5.3 Vorteil gegenueber nur JSON-Dateien
Die bestehenden JSON-Summaries sind weiterhin nuetzlich, aber sie haben einen Nachteil:

* Sie sind erst **nach dem Lauf** wirklich auswertbar.

Grafana mit Zeitreihen-Speicher ergaenzt diesen Pfad um:

* **Live-Sicht waehrend des Runs**
* **intuitivere Diagramme**
* **leichtere Demo-Fuehrung**

## 6. Zielsetzung der Visualisierung

### 6.1 Welche Fragen soll das Dashboard beantworten?
Das Dashboard soll nicht nur "huebsch" aussehen, sondern fachlich klare Fragen beantworten:

* Wie entwickelt sich die Last waehrend des Testlaufs?
* Welche Datenbank liefert unter Last den hoeheren Durchsatz?
* Welche Datenbank zeigt hoehere Latenzspitzen?
* Gibt es Fehlerraten oder Abbrueche?
* Sind die Unterschiede stabil oder nur kurzfristige Ausschlaege?
* Welches Szenario ist fuer welche Datenbank besonders teuer?

### 6.2 Zielgruppen der Visualisierung
Die Visualisierung adressiert drei Zielgruppen:

**1. Vortrag / Demo**
* schnelle Orientierung
* klare Live-Anzeige
* sichtbare Unterschiede zwischen MongoDB und PostgreSQL

**2. Schriftliche Ausarbeitung**
* Uebernahme von Kennzahlen und Screenshots
* nachvollziehbare Herleitung der Aussagen

**3. Eigene Entwicklung / Testen**
* schnelles Erkennen von Ausreissern
* Sichtbarkeit von Fehlverhalten einzelner Szenarien
* einfaches Vergleichen mehrerer Runs

## 7. Dashboard-Konzept in Grafana

### 7.1 Grundprinzip
Es sollte nicht nur ein einziges Dashboard geben, sondern eine kleine, strukturierte Dashboard-Landschaft.

Empfohlene Aufteilung:

* **Dashboard A: Live Run Overview**
* **Dashboard B: Szenario-Vergleich**
* **Dashboard C: Detailanalyse pro Datenbank**
* **Dashboard D: Abschluss- und Ergebnisansicht**

### 7.2 Dashboard A: Live Run Overview
Zweck:
* Beobachtung eines gerade laufenden Benchmarks
* Live-Demo waehrend des Vortrags

Empfohlene Panels:

* aktueller Szenario-Name
* aktueller `db_mode`
* laufender Testzeitraum
* Requests pro Sekunde als Zeitreihe
* mittlere Latenz als Zeitreihe
* p95-Latenz als Zeitreihe
* Fehlerquote als Zeitreihe
* Erfolgsquote als Stat-Panel

Wirkung in der Demo:
* Man sieht sofort, ob ein Run stabil laeuft.
* Unterschiede zwischen MongoDB und PostgreSQL werden live sichtbar.

### 7.3 Dashboard B: Szenario-Vergleich
Zweck:
* direkter Vergleich der Szenarien `read-product`, `catalog-search`, `analytics-rollup`, `bulk-insert`

Empfohlene Panels:

* Balkendiagramm `avg req/s` pro Szenario und Datenbank
* Balkendiagramm `p95 latency` pro Szenario und Datenbank
* Tabelle mit `success rate`, `checks rate`, `p50`, `p95`, `p99`
* Heatmap fuer Latenz ueber Zeit und Szenario

Fachlicher Nutzen:
* Dieses Dashboard eignet sich besonders gut fuer die spaetere Interpretation in der Ausarbeitung.

### 7.4 Dashboard C: Detailanalyse pro Datenbank
Zweck:
* gezielte Analyse eines Testkandidaten

Filter:

* `db_mode`
* `scenario`
* Zeitfenster

Empfohlene Panels:

* Requests pro Sekunde
* Antwortzeiten nach Perzentilen
* Fehlerquote
* Verlauf waehrend Warm-up und Messphase
* Vergleich mehrerer Laeufe desselben Szenarios

Fachlicher Nutzen:
* Hier koennen Ausreisser und schwankende Phasen untersucht werden.

### 7.5 Dashboard D: Abschluss- und Ergebnisansicht
Zweck:
* komprimierte Endsicht fuer Vortrag und schriftliche Zusammenfassung

Empfohlene Panels:

* schnellste Datenbank insgesamt
* niedrigste p95 insgesamt
* schlechtestes Szenario insgesamt
* Vergleichstabelle aller Runs
* hervorgehobene Kernaussagen in Text- oder Stat-Panels

Wichtiger Punkt:
* Dieses Dashboard ist die Bruecke zwischen Live-Messung und finaler Interpretation.

## 8. Notwendige Metrikdimensionen
Damit Grafana sinnvoll filtern und gruppieren kann, muessen die k6-Metriken mit sauberen Tags versehen werden.

Pflichtdimensionen sind:

* `scenario`
* `db_mode`
* `phase` mit mindestens `warmup` und `measure`
* optional `run_id`
* optional `suite_id`

Diese Tags sind entscheidend fuer die spaetere Visualisierung, weil erst dadurch solche Auswertungen moeglich werden:

* nur Messphase statt Warm-up
* nur MongoDB oder nur PostgreSQL
* nur ein bestimmtes Szenario
* Vergleich mehrerer Runs derselben Suite

## 9. Einbindung in den bestehenden Benchmark-Flow

### 9.1 Was bleibt unveraendert?
Folgende Teile des jetzigen Systems sollen erhalten bleiben:

* die bestehenden k6-Skripte unter `benchmark/`
* die vorhandenen CLI-Runner wie `benchmark:local:suite`
* die JSON-Exports pro Run
* die `suite-summary.json` als kompakte Ergebnisdatei

### 9.2 Was kommt neu hinzu?
Neu hinzu kommen:

* Ausleitung der laufenden Metriken nach InfluxDB
* Grafana als zusaetzlicher Visualisierungspfad
* vordefinierte Dashboards fuer die Projektfragen
* optional eine Startseite oder Verlinkung im Frontend zur Grafana-Ansicht

### 9.3 Wichtiges Architekturprinzip
Grafana soll den k6-Flow **nicht ersetzen**, sondern **visualisieren**.

Das ist wichtig, weil sonst wieder zwei verschiedene Benchmark-Pfade entstehen koennten. Die korrekte Logik lautet:

* k6 erzeugt die Messdaten.
* InfluxDB speichert die Messdaten.
* Grafana visualisiert die Messdaten.

## 10. Moegliche Integrationsstufen

### 10.1 Stufe 1: Reine Live-Visualisierung neben der CLI
In dieser Ausbaustufe startet der Benutzer den Benchmark weiterhin ueber die CLI, zum Beispiel:

```bash
npm run benchmark:local:suite -- --db both --vus 50 --warmup 30 --duration 60 --seed-count 10000
```

Parallel dazu ist Grafana geoeffnet und zeigt die Metriken live an.

Vorteile:

* sehr geringe Eingriffe in die bestehende Architektur
* schneller Mehrwert
* guter erster Integrationsschritt

Nachteile:

* die Demo bleibt auf zwei Oberflaechen verteilt
* Start und Beobachtung sind noch nicht aus einem Guss

### 10.2 Stufe 2: Frontend verlinkt oder embeddet Grafana
In dieser Stufe wird im Frontend ein Bereich geschaffen, der das Grafana-Dashboard verlinkt oder in einer eingebetteten Ansicht oeffnet.

Vorteile:

* bessere Demo-Fuehrung
* Benchmark-Visualisierung ist naeher an der Projekt-UI

Nachteile:

* Authentifizierung, Framing und Rechte muessen sauber konzipiert werden
* fuer lokale Demo gut, fuer allgemeine Produktion weniger relevant

### 10.3 Stufe 3: Weboberflaeche startet den echten k6-Run
In dieser Stufe startet das Frontend nicht mehr nur den In-App-Runner, sondern einen echten k6-Job.

Dann waere der Ablauf:

1. Benutzer startet eine Suite im Frontend.
2. Backend startet den k6-Runner.
3. k6 schreibt live nach InfluxDB.
4. Grafana zeigt die Entwicklung an.
5. Nach Abschluss wird zusaetzlich die `suite-summary.json` im Frontend ausgewertet.

Vorteile:

* fachlich der sauberste Endzustand
* Demo und Auswertung nutzen exakt denselben Benchmark-Pfad

Nachteile:

* hoechster Implementierungsaufwand
* Job-Management, Prozesssteuerung und Fehlerbehandlung werden komplexer

## 11. Konkretes Ziel fuer dieses Projekt
Fuer dieses Projekt ist folgende Reihenfolge am sinnvollsten:

### Phase A: Grafana als parallele Live-Ansicht einfuehren
Zuerst wird die bestehende CLI beibehalten. Ziel ist, dass ein gestarteter k6-Run sofort in Grafana sichtbar ist.

Warum diese Phase zuerst?

* geringstes Risiko
* schnellster sichtbarer Mehrwert
* keine Vermischung von UI- und Benchmark-Logik

### Phase B: Dashboards auf die Forschungsfragen zuschneiden
Danach werden die Grafana-Panels nicht nur technisch, sondern fachlich optimiert:

* Vergleich MongoDB vs. PostgreSQL
* Sichtbarkeit der kritischen Szenarien
* klare Panels fuer Vortrag und Bericht

### Phase C: Optionaler Frontend-Einstiegspunkt
Wenn noch Zeit bleibt, kann das Frontend eine Verlinkung oder eine integrierte Ansicht fuer Grafana erhalten.

### Phase D: Optionaler Vollausbau mit k6-Start ueber das Frontend
Das ist die langfristig beste, aber nicht zwingend notwendige Endausbaustufe.

## 12. Vorteile fuer die Uni-Demo
Die Einfuehrung von Grafana verbessert die Demo in mehreren Punkten:

### 12.1 Bessere Sichtbarkeit waehrend des Vortrags
Statt nur Konsolenausgaben zu zeigen, kann im Vortrag live demonstriert werden:

* wie die Last ansteigt
* wie die Antwortzeiten reagieren
* welche Datenbank stabiler bleibt

### 12.2 Bessere Nachvollziehbarkeit fuer das Publikum
Die Unterschiede zwischen MongoDB und PostgreSQL werden in Diagrammen intuitiver erfassbar als in JSON-Dateien.

### 12.3 Bessere Anschlussfaehigkeit an die Auswertung
Screenshots oder exportierte Grafana-Panels lassen sich spaeter leichter in Praesentation und Bericht verwenden als rohe Konsolenausgaben.

## 13. Vorteile fuer die schriftliche Ausarbeitung
Grafana ist nicht nur ein Demo-Tool, sondern verbessert auch die Auswertbarkeit:

* Zeitreihen machen Lastverlaeufe sichtbar.
* p95- und p99-Spitzen lassen sich besser erklaeren.
* Die Unterschiede zwischen Szenarien werden leichter dokumentierbar.
* Auffaellige Phasen koennen anhand von Screenshots belegt werden.

Wichtig bleibt aber:
Die eigentliche Referenz fuer tabellarische Endwerte sollte weiterhin aus den strukturierten k6-Ergebnissen und `suite-summary.json` kommen. Grafana dient in erster Linie der **Live-Beobachtung** und **visuellen Interpretation**.

## 14. Risiken und Herausforderungen

### 14.1 Zusaetzliche Infrastruktur
Mit InfluxDB und Grafana kommen weitere Container hinzu. Das erhoeht:

* die Startzeit des Stacks
* den Ressourcenverbrauch
* den Konfigurationsaufwand

Dieser Mehraufwand ist aber fuer ein lokales Testlabor vertretbar.

### 14.2 Dashboard-Qualitaet entscheidet ueber den Nutzen
Grafana bringt nicht automatisch ein gutes Uni-Dashboard mit. Wenn die Panels nicht auf die Projektfragen zugeschnitten sind, entsteht nur ein technisch beeindruckender, aber fachlich schwacher Bildschirm.

Deshalb ist ein wichtiger Teil der Arbeit nicht nur die technische Anbindung, sondern die **fachliche Gestaltung der Dashboards**.

### 14.3 Vergleichbarkeit mehrerer Runs
Wenn Zeitreihen aus mehreren Testlaeufen zusammen in InfluxDB liegen, muessen die Daten sauber filterbar sein. Sonst vermischen sich Runs miteinander.

Deshalb sollten moeglichst frueh Konzepte fuer `run_id` und `suite_id` eingeplant werden.

### 14.4 Demo-Stabilitaet
Eine Live-Demo mit mehreren Containern und laufender Metrik-Pipeline ist stoerungsanfaelliger als eine reine CLI.

Fuer die Praesentation sollte deshalb ein abgesicherter Ablauf vorbereitet werden:

* getesteter Seed-Datensatz
* getestete k6-Parameter
* vorbereitete Grafana-Dashboards
* definierte Fallback-Screenshots

## 15. Abgrenzung zu Alternativen

### 15.1 Eigene Visualisierung im Frontend
Moeglich, aber aufwendiger, weil dann Metrikspeicherung, Streaming und Aggregation selbst gebaut werden muessen.

Fuer dieses Projekt ist das nur dann sinnvoll, wenn unbedingt alles innerhalb der eigenen UI stattfinden muss.

### 15.2 Locust statt k6
Locust hat eine eingebaute Weboberflaeche. Ein Umstieg waere aber fachlich und technisch unguenstig, weil der bestehende Benchmark-Flow bereits sauber auf k6 basiert.

### 15.3 Grafana ohne echten k6-Metrik-Stream
Wenn Grafana nur spaeter die JSON-Summary nachlaedt, ist der Kernnutzen verloren. Das Konzept setzt deshalb bewusst auf **echte Live-Metriken waehrend des Laufs**.

## 16. Empfohlene Soll-Architektur
Die empfohlene Soll-Architektur lautet daher:

* Beibehaltung des bestehenden k6-Flows als Benchmark-Standard
* Erweiterung des Docker-Stacks um InfluxDB und Grafana
* Einspeisung laufender k6-Metriken in InfluxDB
* vordefinierte Grafana-Dashboards fuer Live-Sicht und Abschlussauswertung
* spaetere optionale Verknuepfung mit dem Frontend

In Kurzform:

**k6 bleibt die Messmaschine, Grafana wird die Beobachtungs- und Praesentationsschicht.**

## 17. Konkrete Empfehlung fuer die naechste Umsetzungsphase
Die naechste sinnvolle technische Phase ist:

1. `docker-compose.local.yml` um `influxdb` und `grafana` erweitern.
2. Den `benchmark`-Flow so erweitern, dass k6 seine Metriken waehrend des Laufs nach InfluxDB schreibt.
3. Ein erstes Grafana-Dashboard fuer `req/s`, `avg latency`, `p95 latency`, `error rate` und `db_mode` aufsetzen.
4. Erst danach entscheiden, ob eine Verlinkung oder Einbettung ins Frontend den Aufwand wert ist.

## 18. Ergebnis des Konzepts
Mit dieser Architektur entsteht ein sehr guter Kompromiss zwischen methodischer Strenge und Demo-Tauglichkeit:

* **Die Benchmark-Quelle bleibt fachlich sauber**: k6.
* **Die Live-Visualisierung wird deutlich besser**: Grafana.
* **Die Ergebnisse werden praesentierbarer**: nicht nur JSON, sondern nachvollziehbare Diagramme.
* **Die Projektarchitektur bleibt beherrschbar**: keine komplette Eigenentwicklung fuer Live-Metriken.

Fuer dieses Uni-Projekt ist das die sinnvollste Strategie, weil sie sowohl die wissenschaftliche Auswertung als auch die Vorfuehrbarkeit des Systems staerkt.
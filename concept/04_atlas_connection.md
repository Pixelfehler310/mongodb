# 4. MongoDB Atlas Anbindung (Cloud API & Datenbank)

Da wir die Datenbank nicht lokal betreiben, sondern **MongoDB Atlas** nutzen, ist die korrekte Anbindung des Middle Layers (Node.js Backend) an die Cloud ein wichtiger zentraler Bestandteil der Architektur.

## Architektur der Anbindung

### 1. Der Connection String (URI)
Die Verbindung erfolgt über einen sicheren `mongodb+srv://` Connection String. Das `srv`-Protokoll kümmert sich automatisch um DNS-Auflösung und leitet uns an den optimalen Knotenpunkt im MongoDB Replica Set (Verbund von Servern) in der Cloud weiter.
* **Format:** `mongodb+srv://<username>:<password>@<cluster-url>/<dbname>?retryWrites=true&w=majority`

### 2. Treiber: Nativer Node.js Driver
Wir verwenden das offizielle npm-Paket `mongodb` (ohne Abstraktionen wie Mongoose). 
* Das Backend erstellt beim Start **einen** zentralen `MongoClient`.
* **Connection Pooling:** Der Treiber baut nicht für jeden API-Request eine neue Verbindung zur Atlas-Cloud auf, sondern hält einen "Pool" von aktiven Verbindungen offen (Standard: bis zu 100). Das macht das Backend extrem schnell und ressourcenschonend.

### 3. Sicherheit (Security Best Practices)
* **Environment Variables (`.env`):** Der Connection String inklusive Passwort wird **niemals** hart im Code gespeichert oder auf GitHub hochgeladen. Er wird über eine `.env`-Datei an den Docker-Container des Backends übergeben.
* **Database User:** Wir legen in Atlas einen speziellen Benutzer an, der nur Lese- und Schreibrechte (`readWrite`) für unsere spezifische Projekt-Datenbank hat, aber keine Admin-Rechte über den ganzen Cluster.
* **Network Access (IP Allowlisting):** Da das Backend lokal in Docker läuft, muss die aktuelle öffentliche IP-Adresse deines lokalen Rechners im MongoDB Atlas Dashboard unter "Network Access" freigeschaltet (allowlisted) sein. (Alternativ: `0.0.0.0/0` für Testzwecke, was den Zugriff von überall erlaubt).

### 4. Resilienz (Fehlertoleranz)
* **Retryable Writes / Reads:** (`retryWrites=true`) Falls in der Cloud kurzzeitig ein Netzwerkproblem auftritt, versucht der Treiber automatisch im Hintergrund, die Abfrage erneut zu senden, bevor ein Fehler an das Frontend geworfen wird.

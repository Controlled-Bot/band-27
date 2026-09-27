# Geburtstagsbuch „Welches Buch ist das?“

## Ordner

```
index.html            Seite (nicht anfassen nötig)
js/data.js            ALLE Texte, Passwort, Bildpfade  <- hier arbeitest du
js/app.js             Logik
css/style.css         Design
vendor/               Blätter-Bibliothek (StPageFlip, lokal eingebunden)
images/               1.jpg, 2.jpg, ... und first-chat.png
audio/song.mp3        optionale Hintergrundmusik
tools/                Skript zum Komprimieren der Fotos
```

## Checkliste vor dem Verschicken

1. In `js/data.js` alle `[Platzhalter]` ersetzen. Solange noch einer drin ist, ist er auf der Seite **gelb markiert**.
   - `passwort`, `passwortSeite.hinweis`
   - Cover-Chat (nach `images/first-chat.png`, ohne Username und Emojis)
   - Prolog: Zitat und Quelle
   - Foto-Unterschriften, `name`, `gruss`
   - Gutschein: `code` und `wert`
2. Fotos als `images/1.jpg`, `images/2.jpg` ... ablegen (mehr oder weniger Fotos: einfach die Liste `fotos` anpassen).
3. Fotos komprimieren: `pip install pillow` und dann `python tools/bilder-komprimieren.py`.
4. Optional `audio/song.mp3` ablegen. Ohne Datei verschwindet der Musik-Button von selbst.
5. Lokal testen: im Ordner `python -m http.server 8000` und am PC `http://localhost:8000` öffnen
   (Handy-Ansicht in Chrome: F12, dann Handy-Symbol).

Hinweis: Der Passwortschutz ist nur ein Sichtschutz. Wer den Quelltext liest, findet das Passwort
und den Gutscheincode. Den Link also nur ihr schicken.

## Kostenlos hosten

### Variante A: Netlify Drop (am schnellsten, ca. 2 Minuten)
1. https://app.netlify.com/drop öffnen, kostenlos anmelden.
2. Den kompletten Ordner `Gift` ins Browserfenster ziehen.
3. Fertig, du bekommst eine URL wie `https://zufaelliger-name.netlify.app`.
4. Unter *Site configuration > Change site name* einen schöneren Namen wählen, z. B. `band-27`.
5. Änderungen: in Netlify unter *Deploys* den Ordner erneut hineinziehen.

### Variante B: GitHub Pages
1. Auf github.com ein neues Repository anlegen, z. B. `band-27` (Public, bei kostenlosem Konto nötig).
2. *Add file > Upload files*, den **Inhalt** des Ordners `Gift` hochladen (index.html muss direkt im Hauptverzeichnis liegen), *Commit changes*.
3. *Settings > Pages > Source: Deploy from a branch*, Branch `main`, Ordner `/ (root)`, *Save*.
4. Nach 1 bis 2 Minuten ist die Seite unter `https://DEINNAME.github.io/band-27/` erreichbar.

Bei GitHub Pages ist das Repository öffentlich, also auch Texte und Gutscheincode. Netlify ist dafür die bessere Wahl.

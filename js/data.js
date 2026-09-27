/* =====================================================================
   ALLE TEXTE, BILDER UND EINSTELLUNGEN
   ---------------------------------------------------------------------
   Hier änderst du alles, ohne den restlichen Code anzufassen.

   - Alles in [eckigen Klammern] ist ein PLATZHALTER. Auf der Seite wird
     es gelb markiert, damit du nichts übersiehst. Einfach ersetzen
     (inkl. Klammern).
   - Texte mit "ENTWURF" im Kommentar sind Vorschläge. Anpassen oder
     so lassen, wie du magst.
   - Jeder Eintrag in einer Liste [...] ist ein eigener Absatz.
   - *Sternchen* = kursiv.
   - Wird ein Text zu lang, verkleinert sich die Schrift auf der Seite
     automatisch ein wenig. Bei sehr viel Text lieber auf eine neue
     Seite aufteilen (siehe Prolog, "seiten").
   ===================================================================== */

window.BUCH = {

  /* ---------- Allgemein ---------- */
  name: "[Ihr Vorname]",

  // Einfacher Passwortschutz (Groß/Kleinschreibung egal, Leerzeichen am Rand egal).
  // Hinweis: Das ist nur ein Sichtschutz, kein echter Schutz. Jeder, der den
  // Quelltext öffnet, kann es lesen. Für eine Geburtstagsseite reicht das.
  passwort: "[PASSWORT]",
  passwortSeite: {
    titel: "Dieses Buch ist noch versiegelt.",
    text: "Nur für eine bestimmte Leserin. Bitte das Passwort eingeben.",
    hinweis: "Kleiner Tipp: [Passwort-Hinweis, z. B. dein Geburtsdatum ohne Punkte]",
    button: "Aufschlagen",
    fehler: "Hm, das war es leider nicht. Noch ein Versuch?"
  },

  // Hintergrundmusik: nur per Button, kein Autoplay.
  // Fehlt die Datei, wird der Button automatisch ausgeblendet.
  musik: {
    aktiv: true,
    datei: "audio/song.mp3",
    lautstaerke: 0.5
  },

  /* ---------- 1. Cover ---------- */
  cover: {
    titel: "Welches Buch ist das?",
    untertitel: "Band 27",
    // Unser erster Chat, im Buchstil nachgebaut (ohne Usernamen und Emojis).
    // von: "ich" = rechts, von: "sie" = links
    chatUeberschrift: "Aus dem ersten Kapitel",
    chat: [
      { von: "ich", text: "Welches Buch ist das?" },            // ENTWURF, mit images/first-chat.png abgleichen
      { von: "sie", text: "[Ihre Antwort aus dem ersten Chat]" },
      { von: "ich", text: "[Deine Antwort]" }
      // weitere Nachrichten einfach nach demselben Muster ergänzen
    ]
  },

  /* ---------- Titelblatt (Innenseite) ---------- */
  titelblatt: {
    titel: "Welches Buch ist das?",
    untertitel: "Band 27",
    zeile: "Eine Geschichte in wenigen Kapiteln",
    verlag: "Erschienen zum 1. Oktober"
  },

  /* ---------- 2. Widmung ---------- */
  widmung: {
    // ENTWURF
    text: [
      "Für die einzige Person, die mir sagen konnte, welches Buch das ist.",
      "Auch wenn es keins war."
    ]
  },

  /* ---------- 3. Prolog ---------- */
  prolog: {
    label: "Prolog",
    titel: "Ein zufälliges Zitat",
    // Jede innere Liste ist eine Buchseite. Der erste Absatz bekommt die Initiale.
    // ENTWURF: Details in [Klammern] ergänzen
    seiten: [
      [
        "Manche Geschichten beginnen in einer Buchhandlung. Manche auf einer Party. Diese hier beginnt mit einem Video, in dem ein Buch zu sehen war. Oder genauer: in dem ich *dachte*, ein Buch zu sehen.",
        "Da war dieser eine Satz: [das Zitat aus dem Video]. Klang nach einem Roman, den man gelesen haben muss. Also tat ich, was jeder vernünftige Mensch tun würde, und schrieb einer völlig Fremden: *Welches Buch ist das?*"
      ],
      [
        "Die Antwort war so kurz wie vernichtend: gar keins. Es war ein Zitat. [Von wem/woher das Zitat stammte.]",
        "Ich hatte also ein Gespräch mit der Frage nach einem Buch begonnen, das es nicht gibt. Kein Einstieg, den man in Ratgebern findet.",
        "Aber wer viel liest, weiß: Die besten Geschichten fangen selten so an, wie man es erwartet. Und manchmal beginnen sie einfach mit einem kleinen Missverständnis."
      ]
    ]
  },

  /* ---------- 4. Kapitel 27 ---------- */
  kapitel: {
    label: "Kapitel 27",
    titel: "Die Hauptfigur",
    // ENTWURF
    intro: [
      "Jede gute Geschichte braucht eine Hauptfigur. Diese hier liest schneller, als andere Leute Klappentexte überfliegen, und hat eine Meinung zu jedem Buch. Meistens die richtige.",
      "Es folgen einige Aufnahmen aus dem Archiv. Beweisstücke, sozusagen."
    ],
    // Bilder in den Ordner /images legen und hier eintragen.
    // Beliebig viele möglich. Querformat und Hochformat gehen beide.
    fotos: [
      { bild: "images/1.jpg", text: "[Unterschrift, z. B.: Die Hauptfigur in ihrem natürlichen Lebensraum.]" },
      { bild: "images/2.jpg", text: "[Unterschrift, z. B.: Streng, aber fair. Wie ihre Buchkritiken.]" },
      { bild: "images/3.jpg", text: "[Unterschrift, z. B.: Hier noch ahnungslos, dass sie bald in einem Buch landet.]" },
      { bild: "images/4.jpg", text: "[Unterschrift]" }
    ],
    fotosProSeite: 2
  },

  /* ---------- 5. Epilog ---------- */
  epilog: {
    label: "Epilog",
    titel: "Alles Gute",
    // ENTWURF
    text: [
      "Band 27 also. Die Kritik ist sich einig: Die Reihe wird mit jedem Teil besser, und niemand rechnet damit, dass ihr die Ideen ausgehen.",
      "Ich wünsche dir ein Jahr voller guter Bücher, noch besserer Tage und genug ruhiger Abende, um beides zu genießen. Und falls du mal nicht weißt, was du als Nächstes lesen sollst: Ich kenne jemanden, der sehr gerne danach fragt.",
      "Alles Gute zum Geburtstag, [Ihr Vorname]!"
    ],
    gruss: "[Dein Name]"
  },

  /* ---------- 6. Anhang: Brief ---------- */
  anhang: {
    label: "Anhang",
    titel: "Ein Brief für dich",
    hinweis: "Siegel antippen",
    siegel: "27",
    brief: {
      anrede: "Liebe [Ihr Vorname],",
      // ENTWURF
      text: [
        "eigentlich schenkt man einer Leserin ein Buch. Aber nach unserem Start traue ich mir bei der Frage, welches, ehrlich gesagt nicht mehr ganz über den Weg.",
        "Deshalb etwas für die Leseabende drumherum: Tee, Kerze, Handcreme für die vielen Seiten. Du entscheidest."
      ],
      gutschein: {
        titel: "dm-Gutschein",
        wert: "[Betrag] €",
        code: "[CODE]",
        buttonText: "Code kopieren",
        kopiertText: "Kopiert!"
      },
      gruss: "[Dein Name]"
    }
  },

  /* ---------- 7. Rückseite ---------- */
  rueckseite: {
    // ENTWURF
    klappentext: "Eine Geschichte, die mit einem Zitat beginnt, das kein Buch war. Mit einer Frage, die eigentlich eine ganz andere Antwort verdient hätte. Und mit einer Hauptfigur, die man nach den ersten Seiten nicht mehr so leicht aus der Hand legt.",
    rezensionen: [
      { text: "Überraschend gut für einen 27. Band.", quelle: "Das Feuilleton" },
      { text: "Hätte ich schon viel früher lesen sollen.", quelle: "Ein aufmerksamer Leser" }
    ],
    isbn: "ISBN 01-10-1999"   // ENTWURF, ggf. anpassen
  },

  /* ---------- Kleinkram ---------- */
  ui: {
    blaetternHinweis: "Wischen oder tippen zum Blättern",
    musikAn: "Musik an",
    musikAus: "Musik aus",
    leereSeite: "Fortsetzung folgt."
  }
};

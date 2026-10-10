// UI translations. German texts are the source and the keys; EN maps them to English.
// Missing English entries fall back to German and are reported once in the console.

const KEY = "showlager-lang"

function detect() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === "de" || saved === "en") return saved
  } catch {}
  return String(navigator.language || "en").toLowerCase().startsWith("de") ? "de" : "en"
}

export const lang = detect()
export const locale = lang === "de" ? "de-DE" : "en-GB"
document.documentElement.lang = lang

export function setLang(l) {
  try { localStorage.setItem(KEY, l) } catch {}
  location.reload()
}

const reported = new Set()
export function t(de, vars) {
  let s = de
  if (lang === "en") {
    const en = EN[de]
    if (en === undefined) {
      if (!reported.has(de)) { reported.add(de); console.warn("[i18n] missing English text:", de) }
    } else s = en
  }
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : s
}

// t() with singular/plural source texts; vars get {n}
export const tn = (n, one, many, vars) => t(n === 1 ? one : many, { n, ...vars })

// messages from the server (English) shown in German when the UI is German
const SERVER_DE = {
  "This instance is already set up.": "Diese Instanz ist bereits eingerichtet.",
  "The setup code is wrong. You find it in the server log.": "Der Einrichtungscode stimmt nicht. Er steht im Server-Log.",
  "Please enter your name.": "Bitte deinen Namen eingeben.",
  "Please enter a valid e-mail address.": "Bitte eine gültige E-Mail-Adresse eingeben.",
  "The password needs at least 8 characters.": "Das Passwort braucht mindestens 8 Zeichen.",
  "Not a valid GDTF file (not a zip archive).": "Keine gültige GDTF-Datei (kein ZIP-Archiv).",
  "description.xml is missing in the GDTF file.": "description.xml fehlt in der GDTF-Datei.",
  "No FixtureType found in the GDTF file.": "Kein FixtureType in der GDTF-Datei gefunden.",
  "Cannot be blank.": "Darf nicht leer sein.",
  "Must be a valid email address.": "Muss eine gültige E-Mail-Adresse sein.",
  "Value must be unique.": "Dieser Wert ist bereits vergeben.",
  "The authenticated record is not allowed to perform this action.": "Dafür fehlen dir die Rechte.",
  "Something went wrong while processing your request.": "Beim Verarbeiten ist etwas schiefgelaufen.",
}
export const serverMsg = (msg) => (lang === "de" && SERVER_DE[msg]) || msg

// GDTF channel names are stored in English with the attribute; German UI shows German names
const ATTR_DE = {
  ColorAdd_R: "Rot", ColorAdd_G: "Grün", ColorAdd_B: "Blau", ColorAdd_W: "Weiß", ColorAdd_WW: "Warmweiß",
  ColorAdd_CW: "Kaltweiß", ColorAdd_A: "Amber", ColorAdd_UV: "UV", ColorAdd_L: "Lime", ColorAdd_C: "Cyan",
  ColorAdd_M: "Magenta", ColorAdd_Y: "Gelb", ColorSub_C: "Cyan (subtraktiv)", ColorSub_M: "Magenta (subtraktiv)",
  ColorSub_Y: "Gelb (subtraktiv)", Shutter1: "Shutter/Strobe", Focus1: "Fokus", Prism1: "Prisma", Color1: "Farbrad",
  ColorMacro1: "Farbmakro", Control1: "Steuerung", Fog: "Nebel", Fan: "Lüfter", StrobeFrequency: "Strobe-Frequenz",
  PanTiltSpeed: "Pan/Tilt-Speed",
}
export function chName(c) {
  if (lang !== "de" || !c.attr) return c.name
  const base = ATTR_DE[c.attr]
  if (!base) return c.fine ? c.name.replace(/ fine$/, " fein") : c.name
  return (c.geo ? `${c.geo} ` : "") + base + (c.fine ? (c.fine === 1 ? " fein" : " ultra") : "")
}

const EN = {
  // ---------- shell & general
  "Inventar": "Inventory", "Lagerorte": "Locations", "Patch": "Patch", "Gerätetypen": "Fixture types", "Etiketten": "Labels",
  "Orte": "Locations", "Typen": "Types", "Mehr": "More", "Navigation": "Navigation", "Hauptnavigation": "Main navigation",
  "Nicht gefunden": "Not found", "Zurück zum Inventar": "Back to the inventory", "Inventar für Showtechnik": "Stage equipment inventory",
  "Admin": "Admin", "Mitglied": "Member", "Mitglieder": "Members", "API-Schlüssel": "API keys", "Einstellungen": "Settings",
  "Konto": "Account", "Lade Inventar…": "Loading inventory…", "Lade…": "Loading…", "Laden fehlgeschlagen": "Loading failed",
  "Neu laden": "Reload", "Löschen": "Delete", "Keine Verbindung zum Server.": "No connection to the server.",
  "Abbrechen": "Cancel", "Speichern": "Save", "Gespeichert": "Saved", "Bearbeiten": "Edit", "Schließen": "Close",
  "Kopieren": "Copy", "Kopiert": "Copied", "Kopieren nicht möglich, bitte markieren.": "Copying is not possible here, please select the text.",
  "Entfernen": "Remove", "Behalten": "Keep", "Anlegen": "Create", "Öffnen": "Open", "Fertig": "Done", "Übernehmen": "Apply",
  "Zurücksetzen": "Reset", "Weniger": "Fewer", ",": ".",

  // ---------- conditions & fields
  "In Ordnung": "OK", "Defekt": "Defective", "In Reparatur": "In repair", "Verschollen": "Missing",
  "Name": "Name", "Kategorie": "Category", "Typ": "Type", "Anzahl": "Quantity", "Lagerort": "Location", "Platz": "Spot",
  "Zustand": "Condition", "Seriennummer": "Serial number", "Fotos": "Photos", "Notizen": "Notes", "Universe": "Universe",
  "DMX-Adresse": "DMX address", "DMX-Mode": "DMX mode", "Hersteller": "Manufacturer", "Modell": "Model", "E-Mail": "E-mail",
  "Passwort": "Password", "Passwort-Wiederholung": "Password confirmation", "Altes Passwort": "Old password", "Zuständig": "Responsible",

  // ---------- patch colours
  "Blau": "Blue", "Petrol": "Teal", "Oliv": "Olive", "Ocker": "Ochre", "Rost": "Rust", "Beere": "Berry", "Violett": "Violet",
  "Schiefer": "Slate", "Himmel": "Sky", "eigene": "custom",

  // ---------- login / setup / account
  "E-Mail oder Passwort stimmt nicht.": "E-mail or password is wrong.", "Anmelden…": "Signing in…", "Anmelden": "Sign in",
  "Noch keinen Zugang? Frag im Verein nach, ein Admin legt dir ein Konto an.": "No account yet? Ask in your club, an admin will create one for you.",
  "Die beiden Passwörter stimmen nicht überein.": "The two passwords don't match.", "Eingerichtet. Willkommen!": "All set. Welcome!",
  "Showlager einrichten": "Set up Showlager", "Einmalig beim ersten Start": "Once, on first start", "Einrichtungscode": "Setup code",
  "Steht im Server-Log, z. B. mit docker compose logs pocketbase.": "It's in the server log, e.g. via docker compose logs pocketbase.",
  "Verein": "Club", "Name des Vereins": "Club name", "z. B. Theaterverein Musterstadt": "e.g. Springfield Theatre Club",
  "Kürzel": "Initials", "Für das Logo": "For the logo", "Präfix Inventarnummer": "Inventory number prefix", "Erste Nummer: {no}": "First number: {no}",
  "Dein Admin-Konto": "Your admin account", "Mindestens 8 Zeichen": "At least 8 characters", "Wiederholen": "Repeat",
  "Wird eingerichtet…": "Setting up…", "Einrichten und anmelden": "Set up and sign in",
  "Name, Kürzel und Präfix lassen sich später unter Einstellungen ändern. Weitere Mitglieder legst du danach unter Mitglieder an.": "Name, initials and prefix can be changed later under Settings. Add more members afterwards under Members.",
  "Name gespeichert": "Name saved", "Die neuen Passwörter stimmen nicht überein.": "The new passwords don't match.",
  "Passwort geändert": "Password changed", "Abmelden": "Sign out", "Sprache": "Language", "Darstellung": "Appearance",
  "Farbschema": "Colour scheme", "Wie Gerät": "System", "Hell": "Light", "Dunkel": "Dark", "Passwort ändern": "Change password",
  "Aktuelles Passwort": "Current password", "Neues Passwort": "New password", "Konto, Sprache & Darstellung": "Account, language & appearance",

  // ---------- members
  "Das Passwort braucht mindestens 8 Zeichen.": "The password needs at least 8 characters.",
  "Passwort für {name} geändert": "Password for {name} changed",
  "Konto von {name} löschen? Einträge im Verlauf bleiben ohne Namen erhalten.": "Delete {name}'s account? History entries stay, without the name.",
  "Konto gelöscht": "Account deleted", "Nur für Admins.": "Admins only.",
  "Wer sich anmelden darf. Mitglieder können alles anlegen und bearbeiten, löschen dürfen nur Admins.": "Who can sign in. Members can create and edit everything, only admins can delete.",
  "Zugangsdaten weitergeben:": "Pass on the login details:", "Rolle": "Role", "Seit": "Since", "Neues Mitglied": "New member",
  "Startpasswort": "Initial password", "Kann das Mitglied später unter Konto ändern": "The member can change it later under Account",
  "Konto anlegen": "Create account", "Passwort für {name}": "Password for {name}", "Neues Zufallspasswort": "New random password",
  "Zufällig": "Random", "Passwort setzen": "Set password",
  "Mindestens 8 Zeichen. Das alte Passwort gilt danach nicht mehr, das Mitglied wird auf allen Geräten abgemeldet.": "At least 8 characters. The old password stops working and the member is signed out on all devices.",
  "{name} ist jetzt Admin": "{name} is now an admin", "{name} ist jetzt Mitglied": "{name} is now a member",
  "Etiketten drucken": "Print labels",

  // ---------- settings
  "Einstellungen fehlen auf dem Server.": "Settings are missing on the server.", "Einstellungen gespeichert": "Settings saved",
  "Gilt für alle Mitglieder.": "Applies to all members.",
  "Erscheint in der Seitenleiste und als Feld {Verein} auf Etiketten.": "Shown in the sidebar and as field {Club} on labels.",
  "Bis zu 5 Zeichen, für das Logo oben links und den Browser-Tab.": "Up to 5 characters, for the logo at the top left and the browser tab.",
  "z. B. TVM": "e.g. STC", "Inventarnummern": "Inventory numbers", "Präfix": "Prefix",
  "Nur A–Z und 0–9. Das nächste neue Teil bekommt {no}. Bestehende Nummern bleiben unverändert.": "Only A–Z and 0–9. The next new item gets {no}. Existing numbers stay the same.",

  // ---------- API keys
  "Neuer Schlüssel „{name}“": "New key “{name}”",
  "Der Schlüssel wird nur jetzt angezeigt. Kopiere ihn an einen sicheren Ort.": "The key is only shown now. Copy it to a safe place.",
  "Claude Code": "Claude Code", "MCP-Konfiguration (JSON)": "MCP configuration (JSON)", "REST-API (curl)": "REST API (curl)",
  "Schlüssel „{name}“ widerrufen? Agenten und Skripte damit verlieren sofort den Zugriff.": "Revoke key “{name}”? Agents and scripts using it lose access immediately.",
  "Widerrufen": "Revoke", "Schlüssel widerrufen": "Key revoked",
  "Für KI-Agenten (MCP) und Skripte (REST-API). Ein Schlüssel handelt in deinem Namen, kann aber nichts löschen und keine Konten oder Einstellungen ändern. Änderungen erscheinen im Verlauf mit dem Namen des Schlüssels.": "For AI agents (MCP) and scripts (REST API). A key acts on your behalf but cannot delete anything or change accounts or settings. Changes show up in the history with the key's name.",
  "API-Dokumentation": "API documentation", "Neuer Schlüssel": "New key", "Wofür? z. B. „Claude“ oder „Inventur-Skript“": "What for? e.g. “Claude” or “stocktaking script”",
  "Zugriff": "Access", "Nur lesen": "Read only", "Lesen und schreiben": "Read and write",
  "Darf Teile, Lagerorte und Gerätetypen anlegen und ändern sowie Fotos, GDTF und Anleitungen hochladen.": "Can create and change items, locations and fixture types, and upload photos, GDTF files and manuals.",
  "Darf alles lesen, aber nichts ändern.": "Can read everything but change nothing.", "Schlüssel erstellen": "Create key",
  "Noch keine Schlüssel": "No keys yet", "Erstelle einen Schlüssel, um einen KI-Agenten oder ein Skript anzubinden.": "Create a key to connect an AI agent or a script.",
  "Schlüssel": "Key", "Erstellt": "Created", "Zuletzt benutzt": "Last used", "noch nie": "never",

  // ---------- inventory list
  "Noch nichts erfasst": "Nothing recorded yet", "Erstes Teil anlegen": "Add the first item",
  "Leg Scheinwerfer, Kabel, Stative und alles andere als einzelne Teile an. Jedes Teil bekommt automatisch eine Inventarnummer ({a}, {b}, …) und einen QR-Code für das Etikett.": "Add lights, cables, stands and everything else as items. Each item automatically gets an inventory number ({a}, {b}, …) and a QR code for its label.",
  "Für DMX-Geräte lohnt es sich, zuerst den Gerätetyp mit GDTF-Datei anzulegen.": "For DMX fixtures it pays to create the fixture type with a GDTF file first.",
  "{n} Stück": "{n} pcs", "Neues Teil": "New item", "Suchen: Nummer, Name, Typ, Lagerort, Seriennr. …": "Search: number, name, type, location, serial …",
  "Inventar durchsuchen": "Search the inventory", "Alle Kategorien": "All categories", "Ohne Kategorie": "No category",
  "Alle Lagerorte": "All locations", "Ohne Lagerort": "No location", "Gerätetyp": "Fixture type", "Alle Typen": "All types",
  "Ohne Typ": "No type", "Jeder Zustand": "Any condition", "Nur DMX": "DMX only", "Nichts gefunden": "Nothing found",
  "Keine Teile passen zu Suche und Filtern.": "No items match your search and filters.", "Alle auswählen": "Select all",
  "Nr.": "No.", "Gerät": "Item", "DMX zuletzt": "Last DMX", "{n} auswählen": "Select {n}", "{n} ausgewählt": "{n} selected",
  "Auswahl aufheben": "Clear selection", "{n} Eintrag": "{n} entry", "{n} Einträge": "{n} entries",

  // ---------- item detail
  "Für diesen Mode sind keine Kanäle hinterlegt.": "No channels are defined for this mode.", "DMX-Daten gespeichert": "DMX data saved",
  "DMX · zuletzt bekannt": "DMX · last known", "Ändern": "Change", "Startadresse": "Start address", "leer = unbekannt": "empty = unknown",
  "Mode": "Mode", "{n} Kan.": "{n} ch", "Adresse {a} + {n} Kanäle passt nicht mehr in das Universe (max. 512).": "Address {a} + {n} channels doesn't fit into the universe (max. 512).",
  "Im Patch": "In patch", "unbekannt": "unknown", "Gesetzt am {date} von {name}": "Set on {date} by {name}", "Gesetzt am {date}": "Set on {date}",
  "älter als ein halbes Jahr, vor dem Einsatz prüfen": "older than six months, check before use", "Keine Adresse bekannt.": "No address known.",
  "Trag die Adresse ein, sobald das Gerät gepatcht ist.": "Enter the address once the fixture is patched.",
  "Kanalbelegung ausblenden": "Hide channel layout", "Kanalbelegung {mode} zeigen": "Show channel layout {mode}",
  "{n} Kanal": "{n} channel", "{n} Kanäle": "{n} channels",
  "(gelöschter Typ)": "(deleted type)", "(gelöschter Ort)": "(deleted location)", "{n} Foto": "{n} photo", "{n} Fotos": "{n} photos",
  "Verlauf": "History", "Noch keine Änderungen.": "No changes yet.", "System": "System",
  "über API-Schlüssel „{name}“": "via API key “{name}”", "hat das Teil angelegt": "created the item", "hat geändert:": "changed:",
  "Teil nicht gefunden": "Item not found", "Zum Inventar": "To the inventory", "Es wurde gelöscht oder der Link ist falsch.": "It was deleted or the link is wrong.",
  "{no} „{name}“ endgültig löschen? Der Verlauf wird mitgelöscht.": "Delete {no} “{name}” for good? Its history is deleted too.",
  "{no} gelöscht": "{no} deleted", "Etikett": "Label", "Duplizieren": "Duplicate", "Erfasst": "Recorded", "Foto {n}": "Photo {n}",
  "Keine Fotos": "No photos", "Ein Foto hilft, das Teil im Lager wiederzufinden.": "A photo helps to find the item in storage.",
  "Foto hinzufügen": "Add photo", "Unterlagen": "Documents", "Anleitung": "Manual",

  // ---------- item edit
  "Bitte einen Namen eingeben.": "Please enter a name.", "{no} angelegt": "{no} created", "Teil bearbeiten": "Edit item",
  "Teil duplizieren": "Duplicate item", "Die Inventarnummer wird beim Speichern automatisch vergeben.": "The inventory number is assigned automatically when you save.",
  "Allgemein": "General", "Optional. Für DMX-Geräte mit Modes und Kanälen.": "Optional. For DMX fixtures with modes and channels.",
  "{n} DMX-Mode hinterlegt": "{n} DMX mode defined", "{n} DMX-Modes hinterlegt": "{n} DMX modes defined",
  "Kein Typ": "No type", "Neuer Gerätetyp…": "New fixture type…", "z. B. PAR Bühne links": "e.g. PAR stage left",
  "Typ angelegt. GDTF und Modes kannst du später unter Gerätetypen ergänzen.": "Type created. Add GDTF and modes later under Fixture types.",
  "Für Kleinteile wie Kabel": "For small parts like cables", "Lager": "Storage", "Kein Lagerort": "No location",
  "Neuer Lagerort…": "New location…", "Kiste, Regal, Case …": "Box, shelf, case …", "Name, z. B. Keller Schmidt": "Name, e.g. Smith's basement",
  "Adresse (optional)": "Address (optional)", "belegt {a}–{b}": "uses {a}–{b}", "Fotos hinzufügen": "Add photos",
  "Antippen für Kamera oder Galerie, oder Dateien hierher ziehen": "Tap for camera or gallery, or drop files here",
  "Macken, Zubehör, Besonderheiten …": "Quirks, accessories, special notes …",
  "Speichern und gleich das nächste gleiche Teil anlegen": "Save and start the next identical item right away", "Speichern + nächstes": "Save + next",

  // ---------- labels
  "Passt nicht auf den Bogen. Etikett verkleinern, Rand verringern oder A5-Trennung ausschalten.": "Doesn't fit on the sheet. Make the label smaller, reduce the margin or turn off the A5 split.",
  "{n} pro A4-Bogen ({c} × {r} je A5-Hälfte)": "{n} per A4 sheet ({c} × {r} per A5 half)", "{n} pro A4-Bogen ({c} × {r})": "{n} per A4 sheet ({c} × {r})",
  "Teile · {n} ausgewählt": "Items · {n} selected", "{n} Etiketten": "{n} labels", "Alle abwählen": "Deselect all",
  "Teile suchen…": "Search items…", "Teile suchen": "Search items", "Anzahl Etiketten": "Number of labels",
  "Ein Etikett weniger für {no}": "One label fewer for {no}", "Anzahl Etiketten für {no}": "Number of labels for {no}",
  "Ein Etikett mehr für {no}": "One more label for {no}", "Keine Treffer.": "No matches.", "Alle {n} Treffer auswählen": "Select all {n} matches",
  "Anzahl für alle:": "Quantity for all:", "Anzahl für alle": "Quantity for all",
  "Für jedes Stück ein Etikett, z. B. 12 Kabel = 12 Etiketten": "One label per piece, e.g. 12 cables = 12 labels",
  "Stückzahl aus Inventar": "Quantity from inventory", "Druck": "Print", "Start bei Position": "Start at position",
  "Angebrochener Bogen? In der Vorschau auf die erste freie Stelle klicken.": "Partly used sheet? Click the first free spot in the preview.",
  "Schnittlinien drucken": "Print cut lines", "Teile auswählen": "Select items",
  "{n} Etikett drucken": "Print {n} label", "{n} Etiketten drucken": "Print {n} labels", "{n} Bogen": "{n} sheet", "{n} Bögen": "{n} sheets",
  "Im Druckdialog Skalierung 100 % bzw. „Tatsächliche Größe“ und Ränder „Keine“ wählen.": "In the print dialog choose scale 100 % or “Actual size” and margins “None”.",
  "A4-Bogen": "A4 sheet", "{a} von {b}": "{a} of {b}", "Vorheriger Bogen": "Previous sheet", "Nächster Bogen": "Next sheet",
  "Etikett gestalten": "Design label",
  "Schraffiert: schon verbrauchte Stellen. Die graue Linie in der Mitte ist die Trennung der beiden A5-Sticker.": "Hatched: spots already used. The grey line in the middle is the split between the two A5 stickers.",
  "Vorlage gespeichert": "Template saved", "Logo hochgeladen": "Logo uploaded", "Werkzeuge": "Tools", "Text": "Text",
  "Feld hinzufügen": "Add field", "Feld…": "Field…", "Linie": "Line", "Rahmen": "Frame", "QR-Code": "QR code", "Logo": "Logo",
  "Rückgängig (⌘Z)": "Undo (⌘Z)", "Rückgängig": "Undo", "Wiederholen (⇧⌘Z)": "Redo (⇧⌘Z)", "Standardvorlage": "Default template",
  "Verwerfen": "Discard", "Vorschau mit": "Preview with", "Beispieldaten": "Sample data", "Raster": "Grid", "Größe": "Size",
  "Eigene Größe": "Custom size", "Breite (mm)": "Width (mm)", "Höhe (mm)": "Height (mm)",
  "Inhalt beim Ändern der Größe mitskalieren": "Scale content when resizing", "Bogen": "Sheet", "Abstand (mm)": "Gap (mm)", "Rand (mm)": "Margin (mm)",
  "Nicht über die Trennung der A5-Sticker drucken": "Don't print across the split between the A5 stickers",
  "Element anklicken zum Bearbeiten, ziehen zum Verschieben, an den Griffen ziehen für die Größe. Doppelklick auf Text bearbeitet ihn direkt.": "Click an element to edit it, drag to move, drag the handles to resize. Double-click text to edit it in place.",
  "0,25 mm, mit": "0.25 mm, with", "duplizieren": "duplicate", "löschen": "delete", "rückgängig": "undo",
  "beim Ziehen: ohne Einrasten": "while dragging: no snapping", "Ebenen": "Layers", "Nach hinten": "Send backward", "Nach vorne": "Bring forward",
  "Duplizieren (⌘D)": "Duplicate (⌘D)", "Breite": "Width", "Höhe": "Height", "Inhalt": "Content",
  "Felder in geschweiften Klammern werden pro Teil ersetzt. Ist kein Feld befüllt, entfällt der Text.": "Fields in curly braces are filled in per item. If none of the fields has a value, the text is left out.",
  "Schrift": "Font", "Schriftart": "Typeface", "Stärke": "Weight", "Normal": "Regular", "Mittel": "Medium", "Halbfett": "Semibold",
  "Fett": "Bold", "Ausrichtung": "Alignment", "Horizontal": "Horizontal", "Links": "Left", "Mitte": "Centre", "Rechts": "Right",
  "Vertikal": "Vertical", "Oben": "Top", "Unten": "Bottom", "Farbe": "Colour", "Schwarz": "Black", "Dunkelgrau": "Dark grey",
  "Grau": "Grey", "Hellgrau": "Light grey", "Großbuchstaben": "Uppercase", "Einzeilig": "Single line",
  "Bei langem Text automatisch verkleinern": "Shrink long text to fit", "Strichstärke (mm)": "Stroke (mm)", "Eckenradius (mm)": "Corner radius (mm)",
  "Die kürzere Seite ist die Strichstärke.": "The shorter side is the stroke width.", "Enthält den Link zum jeweiligen Teil.": "Contains the link to the item.",
  "Unter etwa 12 mm wird das Scannen mit dem Handy unzuverlässig.": "Below about 12 mm, scanning with a phone gets unreliable.",
  "Das Logo gilt für alle Etiketten.": "The logo applies to all labels.", "Noch kein Logo hochgeladen.": "No logo uploaded yet.",
  "Logo ersetzen": "Replace logo", "Logo hochladen": "Upload logo",
  "Kleine Etiketten mit QR-Code, gekachelt auf A4-Sticker-Bögen zum Ausschneiden.": "Small labels with QR codes, tiled on A4 sticker sheets to cut out.",
  "Drucken": "Print", "Kabel": "Cable", "Klein": "Small", "Standard": "Standard", "Groß": "Large", "Case (A6)": "Case (A6)",
  "Inventarnummer": "Inventory number", "Hersteller + Modell": "Manufacturer + model", "Zuständige Person": "Responsible person",
  "DMX-Modes": "DMX modes", "Letzte DMX-Adresse": "Last DMX address", "Leistung": "Power", "Gewicht": "Weight",
  "Vereinsname": "Club name", "Druckdatum": "Print date", "Link zum Teil": "Link to the item",
  "Beispielteil": "Sample item", "Hersteller Modell": "Manufacturer Model", "Licht": "Lighting", "Keller": "Basement", "Kiste 1": "Box 1",

  // ---------- locations
  "Wo die Technik gerade liegt: Keller, Garagen, Dachböden der Mitglieder.": "Where the equipment is right now: members' basements, garages and attics.",
  "Neuer Lagerort": "New location", "Noch keine Lagerorte": "No locations yet", "Ersten Lagerort anlegen": "Add the first location",
  "Leg für jeden Ort, an dem Vereinstechnik liegt, einen Lagerort an, z. B. „Keller Schmidt“ oder „Garage Bürgerhaus“. Optional mit zuständiger Person und Adresse.": "Create a location for every place where club equipment is kept, e.g. “Smith's basement” or “Community hall garage”. Optionally with a responsible person and an address.",
  "bei {name}": "at {name}'s", "Eintrag": "entry", "Einträge": "entries", "Ungeklärt": "Unclear", "anzeigen": "show",
  "Lagerort nicht gefunden": "Location not found", "Zu den Lagerorten": "To the locations",
  "„{name}“ löschen? {n} Teile stehen danach ohne Lagerort da.": "Delete “{name}”? {n} items will have no location afterwards.",
  "„{name}“ löschen?": "Delete “{name}”?", "Lagerort gelöscht": "Location deleted", "Teil hier anlegen": "Add item here",
  "Hier liegt noch nichts": "Nothing here yet", "Weise Teilen beim Bearbeiten diesen Lagerort zu.": "Assign this location to items when editing them.",
  "Ohne Platzangabe": "No spot given", "Lagerort gespeichert": "Location saved", "Lagerort bearbeiten": "Edit location",
  "z. B. Keller Schmidt": "e.g. Smith's basement", "Niemand bestimmtes": "Nobody in particular", "Adresse": "Address",
  "Zugang, Schlüssel, Öffnungszeiten …": "Access, keys, opening hours …",

  // ---------- patch
  "Adresse muss zwischen 1 und 512 liegen.": "The address must be between 1 and 512.", "Gerät im Patch": "Fixture in patch",
  "Mode gespeichert": "Mode saved", "— wählen —": "— choose —", "Kein Gerätetyp mit Modes, belegt 1 Kanal.": "No fixture type with modes, uses 1 channel.",
  "{no} entpatcht": "{no} unpatched", "Nur dieses entpatchen": "Unpatch only this one", "Startadresse in Universe {u}": "Start address in universe {u}",
  "Setzen": "Set", "Entpatcht": "Unpatched", "Alle {n} entpatchen": "Unpatch all {n}", "Entpatchen": "Unpatch", "{n} Geräte": "{n} fixtures",
  "Passt dort nicht mehr ins Universe.": "Doesn't fit into the universe there.",
  "Zuletzt bekannte DMX-Adressen. Geräte ziehen zum Umpatchen. Jede Änderung wird sofort gespeichert und im Verlauf des Geräts protokolliert.": "Last known DMX addresses. Drag fixtures to repatch. Every change is saved right away and logged in the fixture's history.",
  "Universe {n}": "Universe {n}", "Universe hinzufügen": "Add universe", "{n} / 512 belegt": "{n} / 512 used",
  "Keine Überschneidungen": "No overlaps", "Tippe auf den Startkanal für": "Tap the start channel for", "Mode unbekannt": "Mode unknown",
  "Überschneidung": "Overlap", "Überschneidungen": "Overlaps", "{n} Überschneidung": "{n} overlap", "{n} Überschneidungen": "{n} overlaps",
  "Nicht gepatcht": "Not patched", "Filtern…": "Filter…", "Ungepatchte Geräte filtern": "Filter unpatched fixtures",
  "Hier loslassen, um zu entpatchen": "Drop here to unpatch", "Ziehen oder antippen und dann Startkanal wählen": "Drag, or tap and then choose the start channel",
  "Alle DMX-Geräte haben eine Adresse. Geräte ohne Adresse erscheinen hier, sobald ihr Typ DMX-Modes hat.": "All DMX fixtures have an address. Fixtures without one show up here once their type has DMX modes.",
  "Typen in Universe {u}": "Types in universe {u}",

  // ---------- fixture types
  "Ein Typ beschreibt ein Modell: DMX-Modes, Kanalbelegung, GDTF-Datei und Anleitung. Zehn gleiche PARs teilen sich einen Typ.": "A type describes a model: DMX modes, channel layout, GDTF file and manual. Ten identical PARs share one type.",
  "Neuer Typ": "New type", "Noch keine Gerätetypen": "No fixture types yet", "GDTF-Datei hochladen": "Upload GDTF file",
  "Am schnellsten geht es mit einer GDTF-Datei vom Hersteller oder von gdtf-share.com: Hersteller, Modell, alle Modes und Kanäle werden daraus übernommen. Ohne GDTF kannst du Modes auch von Hand eintragen.": "The quickest way is a GDTF file from the manufacturer or gdtf-share.com: manufacturer, model and all modes and channels are taken from it. Without GDTF you can also enter modes by hand.",
  "Keine DMX-Modes": "No DMX modes", "Geräte": "fixtures", "Typ nicht gefunden": "Type not found", "Zu den Gerätetypen": "To the fixture types",
  "„{name}“ löschen? {n} Teile verlieren dadurch ihren Typ (die Teile selbst bleiben erhalten).": "Delete “{name}”? {n} items lose their type (the items themselves stay).",
  "Typ gelöscht": "Type deleted", "Gerät anlegen": "Add fixture", "DMX-Modes & Kanalbelegung": "DMX modes & channel layout",
  "Keine Modes hinterlegt.": "No modes defined.", "GDTF hochladen oder Modes eintragen": "Upload GDTF or enter modes",
  "Geräte dieses Typs": "Fixtures of this type", "Noch keine Geräte.": "No fixtures yet.", "Erstes Gerät anlegen": "Add the first fixture",
  "Patch-Farbe": "Patch colour", "Keine Dateien.": "No files.", "GDTF oder Anleitung hochladen": "Upload GDTF or manual",
  "Mode-Name": "Mode name", "z. B. 8ch": "e.g. 8ch", "Kanäle": "Channels", "Mode entfernen": "Remove mode", "Kanalbelegung": "Channel layout",
  "Eine Zeile pro Kanal, von oben nach unten (Kanal 1, 2, 3 …). Leer lassen, wenn unbekannt.": "One line per channel, top to bottom (channel 1, 2, 3 …). Leave empty if unknown.",
  "Dimmer\nRot\nGrün\nBlau\nStrobe": "Dimmer\nRed\nGreen\nBlue\nStrobe",
  "Diese Belegung stammt aus der GDTF-Datei (mehrere DMX-Breaks oder Lücken) und lässt sich nur über eine neue GDTF ändern.": "This layout comes from the GDTF file (several DMX breaks or gaps) and can only be changed with a new GDTF.",
  "GDTF wird gelesen…": "Reading GDTF…",
  "{name}: {modes} übernommen ({list}). Die Datei wird beim Speichern unverändert abgelegt.": "{name}: {modes} imported ({list}). The file is stored unchanged when you save.",
  "{n} Mode": "{n} mode", "{n} Modes": "{n} modes",
  "Hersteller und Modell sind Pflichtfelder.": "Manufacturer and model are required.", "Jeder Mode braucht einen Namen.": "Every mode needs a name.",
  "Mode-Namen müssen eindeutig sein.": "Mode names must be unique.", "Gerätetyp gespeichert": "Fixture type saved",
  "Gerätetyp bearbeiten": "Edit fixture type", "Neuer Gerätetyp": "New fixture type", "GDTF-Datei": "GDTF file", "gespeichert": "saved", "neu": "new",
  "Andere GDTF-Datei wählen": "Choose another GDTF file", "GDTF-Datei wählen oder hierher ziehen": "Choose a GDTF file or drop it here",
  "Hersteller, Modell, Modes und Kanäle werden ausgelesen": "Manufacturer, model, modes and channels are read from it",
  "z. B. Stairville": "e.g. Stairville", "z. B. LED Par 56 MKII": "e.g. LED Par 56 MKII", "Leistung (W)": "Power (W)", "Gewicht (kg)": "Weight (kg)",
  "Farbe im Patch": "Colour in the patch", "Automatisch": "Automatic", "Bild ersetzen": "Replace image", "Bild hinzufügen": "Add image",
  "Bild entfernen": "Remove image", "Keine Modes. Für Geräte ohne DMX (Kabel, Stative) einfach leer lassen.": "No modes. Leave empty for equipment without DMX (cables, stands).",
  "Anleitungen": "Manuals", "PDF-Anleitung hinzufügen": "Add PDF manual", "Bis 50 MB pro Datei": "Up to 50 MB per file",
  "Eigenheiten, Firmware, Zubehör …": "Quirks, firmware, accessories …",
}

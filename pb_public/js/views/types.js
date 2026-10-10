import { html, useState } from "../../vendor/preact-htm.mjs"
import {
  useStore, save, remove, go, toast, confirmDialog, errMsg, isAdmin,
  TAPES, tapeOf, modesOf, locOf, fileUrl, itemsOfType, fmtRange,
} from "../store.js"
import { Icon, Plate, Cond, Swatch, Field, Empty, Head, FileDrop, useForm } from "../ui.js"
import { ChannelList } from "./items.js"
import { parseGdtf } from "../gdtf.js"

const label = (t) => `${t.manufacturer} ${t.model}`

export function TypeList() {
  const s = useStore()
  return html`<div class="wrap">
    <${Head}
      title=${html`<h1>Gerätetypen</h1>`}
      sub="Ein Typ beschreibt ein Modell: DMX-Modes, Kanalbelegung, GDTF-Datei und Anleitung. Zehn gleiche PARs teilen sich einen Typ."
      actions=${html`<a class="btn primary" href="#/typ/neu"><${Icon} name="plus" />Neuer Typ</a>`} />
    ${!s.types.length ? html`<${Empty} title="Noch keine Gerätetypen"
        action=${html`<a class="btn primary" href="#/typ/neu"><${Icon} name="upload" />GDTF-Datei hochladen</a>`}>
        Am schnellsten geht es mit einer GDTF-Datei vom Hersteller oder von gdtf-share.com: Hersteller, Modell, alle Modes und
        Kanäle werden daraus übernommen. Ohne GDTF kannst du Modes auch von Hand eintragen.<//>` : html`
      <div class="tiles">
        ${s.types.map((t) => {
          const items = itemsOfType(t.id)
          const modes = modesOf(t)
          return html`<a class="tile" href=${`#/typ/${t.id}`} key=${t.id}>
            <div class="tile-top">
              ${t.image ? html`<img class="tile-img" src=${fileUrl(t, t.image, "160x160")} alt="" loading="lazy" />`
                : html`<span class="tile-img none"><${Icon} name="spot" /></span>`}
              <div><span class="k">${t.manufacturer}</span><span class="big">${t.model}</span></div>
            </div>
            ${modes.length ? html`<div class="modes">${modes.map((m) => html`<span class="mode-pill">${m.name}${String(m.name).includes(String(m.footprint)) ? null : html`<b>${m.footprint}</b>`}</span>`)}</div>`
              : html`<span class="faint" style="font-size:14px">Keine DMX-Modes</span>`}
            <div class="tile-foot">
              <span><b>${items.length}</b> ${items.length === 1 ? "Gerät" : "Geräte"}</span>
              <span class="row">${t.gdtf ? html`<span class="chip plain accent">GDTF</span>` : null}${t.manual?.length ? html`<span class="chip plain">Anleitung</span>` : null}</span>
            </div>
          </a>`
        })}
      </div>`}
  </div>`
}

function ModeTabs({ modes, start = 0 }) {
  const [cur, setCur] = useState(0)
  const m = modes[Math.min(cur, modes.length - 1)]
  return html`<div class="stack">
    <div class="tabs" role="tablist">
      ${modes.map((mm, n) => html`<button role="tab" aria-selected=${n === cur} onClick=${() => setCur(n)}>${mm.name} <span class="mono faint">${mm.footprint}</span></button>`)}
    </div>
    <${ChannelList} mode=${m} start=${start} />
  </div>`
}

export function TypeDetail({ id }) {
  const s = useStore()
  const t = s.types.find((x) => x.id === id)
  if (!t) return html`<div class="wrap"><${Empty} title="Typ nicht gefunden" action=${html`<a class="btn" href="#/typen">Zu den Gerätetypen</a>`} /></div>`
  const items = itemsOfType(t.id)
  const modes = modesOf(t)

  const del = async () => {
    const msg = items.length
      ? `„${label(t)}“ löschen? ${items.length} Teile verlieren dadurch ihren Typ (die Teile selbst bleiben erhalten).`
      : `„${label(t)}“ löschen?`
    if (!(await confirmDialog(msg))) return
    try { await remove("fixture_types", t.id); toast("Typ gelöscht"); go("/typen") } catch (err) { toast(errMsg(err), true) }
  }

  return html`<div class="wrap">
    <${Head}
      crumb=${["#/typen", "Gerätetypen"]}
      title=${html`<span class="label">${t.manufacturer}</span><h1>${t.model}</h1>`}
      actions=${html`
        <a class="btn primary" href=${`#/typ/${t.id}/bearbeiten`}><${Icon} name="edit" />Bearbeiten</a>
        <a class="btn" href=${`#/neu?typ=${t.id}`}><${Icon} name="plus" />Gerät anlegen</a>
        ${isAdmin() ? html`<button class="btn danger icon" aria-label="Löschen" title="Löschen" onClick=${del}><${Icon} name="trash" /></button>` : null}`} />

    <div class="detail">
      <div class="col">
        <section class="panel">
          <h2>DMX-Modes & Kanalbelegung</h2>
          ${modes.length ? html`<${ModeTabs} modes=${modes} />` : html`<p class="muted">Keine Modes hinterlegt. <a href=${`#/typ/${t.id}/bearbeiten`}>GDTF hochladen oder Modes eintragen</a></p>`}
        </section>
        <section class="panel">
          <h2>Geräte dieses Typs · ${items.length}</h2>
          ${items.length ? html`<div class="tablewrap" style="border:0"><table class="t"><tbody>
            ${items.map((i) => html`<tr onClick=${() => go(`/i/${i.id}`)}>
              <td><${Plate} no=${i.inv_no} /></td>
              <td><a href=${`#/i/${i.id}`} style="text-decoration:none;font-weight:600">${i.name}</a><span class="sub">${locOf(i)?.name || ""}</span></td>
              <td class="dmx">${i.dmx_address > 0 ? fmtRange(i) : ""}${i.dmx_mode ? html` <span class="faint">${i.dmx_mode}</span>` : null}</td>
              <td><${Cond} c=${i.condition} /></td>
            </tr>`)}
          </tbody></table></div>` : html`<p class="muted">Noch keine Geräte. <a href=${`#/neu?typ=${t.id}`}>Erstes Gerät anlegen</a></p>`}
        </section>
      </div>
      <div class="col">
        <section class="panel">
          <div class="tile-top">
            ${t.image ? html`<img class="tile-img" style="width:88px;height:88px" src=${fileUrl(t, t.image, "160x160")} alt="" />` : null}
            <dl class="facts" style="flex:1">
              <div><dt>Patch-Farbe</dt><dd class="row"><${Swatch} type=${t} />${TAPES.find(([c]) => c === tapeOf(t))?.[1] || "eigene"}</dd></div>
              ${t.power_w ? html`<div><dt>Leistung</dt><dd class="mono">${t.power_w} W</dd></div>` : null}
              ${t.weight_kg ? html`<div><dt>Gewicht</dt><dd class="mono">${String(t.weight_kg).replace(".", ",")} kg</dd></div>` : null}
            </dl>
          </div>
          ${t.notes ? html`<p class="notes">${t.notes}</p>` : null}
        </section>
        <section class="panel">
          <h2>Unterlagen</h2>
          ${t.gdtf || t.manual?.length ? html`<div class="files">
            ${t.gdtf ? html`<a class="file" href=${fileUrl(t, t.gdtf) + "?download=1"}><${Icon} name="download" /><span>${t.gdtf}</span><small>GDTF</small></a>` : null}
            ${(t.manual || []).map((m) => html`<a class="file" href=${fileUrl(t, m)} target="_blank" rel="noopener"><${Icon} name="file" /><span>${m}</span><small>Anleitung</small></a>`)}
          </div>` : html`<p class="muted">Keine Dateien. <a href=${`#/typ/${t.id}/bearbeiten`}>GDTF oder Anleitung hochladen</a></p>`}
        </section>
      </div>
    </div>
  </div>`
}

// ---------------------------------------------------------------- edit

// Text editing works for plain modes (channels 1..n, no extra DMX breaks).
const isPlain = (m) => !m.channels.some((c) => c.brk) && m.channels.every((c, i) => c.ch === i + 1)

function ModeEditor({ mode, onChange, onRemove }) {
  const plain = isPlain(mode)
  const [text, setText] = useState(mode.channels.map((c) => c.name).join("\n"))
  const setLines = (val) => {
    setText(val)
    const names = val.split("\n").map((l) => l.trim()).filter(Boolean)
    const channels = names.map((name, i) => {
      const prev = mode.channels[i]
      return prev && prev.name === name ? prev : { ch: i + 1, name }
    })
    onChange({ ...mode, channels, footprint: channels.length || mode.footprint })
  }
  return html`<div class="mode-ed">
    <div class="mode-ed-head">
      <${Field} label="Mode-Name"><input value=${mode.name} onInput=${(e) => onChange({ ...mode, name: e.target.value })} placeholder="z. B. 8ch" /><//>
      <${Field} label="Kanäle">
        <input type="number" min="1" max="512" style="width:90px" value=${mode.footprint || ""} disabled=${mode.channels.length > 0}
          onInput=${(e) => onChange({ ...mode, footprint: Number(e.target.value) || 0 })} /><//>
      <button type="button" class="btn icon" aria-label="Mode entfernen" title="Mode entfernen" onClick=${onRemove}><${Icon} name="trash" /></button>
    </div>
    ${plain ? html`<${Field} label="Kanalbelegung" hint="Eine Zeile pro Kanal, von oben nach unten (Kanal 1, 2, 3 …). Leer lassen, wenn unbekannt.">
        <textarea class="code" rows=${Math.min(16, Math.max(4, mode.channels.length + 1))} value=${text} onInput=${(e) => setLines(e.target.value)}
          placeholder=${"Dimmer\nRot\nGrün\nBlau\nStrobe"}></textarea><//>`
      : html`<p class="hint">Diese Belegung stammt aus der GDTF-Datei (mehrere DMX-Breaks oder Lücken) und lässt sich nur über eine neue GDTF ändern.</p>
        <${ChannelList} mode=${mode} start=${0} />`}
  </div>`
}

export function TypeEdit({ id }) {
  const s = useStore()
  const t = id ? s.types.find((x) => x.id === id) : null
  const [v, setV, bind] = useForm(() => ({
    manufacturer: t?.manufacturer || "", model: t?.model || "", color: t?.color || "",
    power_w: t?.power_w || "", weight_kg: t?.weight_kg || "", notes: t?.notes || "",
    modes: structuredClone(modesOf(t)),
  }))
  const [gdtf, setGdtf] = useState(null)        // new File
  const [image, setImage] = useState(null)      // new File
  const [dropImage, setDropImage] = useState(false)
  const [manuals, setManuals] = useState([])
  const [dropManuals, setDropManuals] = useState([])
  const [parseInfo, setParseInfo] = useState(null)
  const [modeKey, setModeKey] = useState(0)     // remount editors when GDTF replaces modes
  const [busy, setBusy] = useState(false)

  if (id && !t) return html`<div class="wrap"><${Empty} title="Typ nicht gefunden" /></div>`

  const onGdtf = async ([file]) => {
    try {
      const g = await parseGdtf(file)
      setGdtf(file)
      setV((x) => ({ ...x, manufacturer: g.manufacturer || x.manufacturer, model: g.model || x.model, modes: g.modes }))
      setModeKey((k) => k + 1)
      if (g.thumbnail && !t?.image && !image) setImage(g.thumbnail)
      setParseInfo({ ok: true, text: `${g.manufacturer} ${g.model}: ${g.modes.length} Mode${g.modes.length === 1 ? "" : "s"} übernommen (${g.modes.map((m) => `${m.name} · ${m.footprint} Kan.`).join(", ")}). Die Datei wird beim Speichern unverändert abgelegt.` })
    } catch (err) {
      setParseInfo({ ok: false, text: `${file.name}: ${err.message}` })
    }
  }

  const setMode = (n, m) => setV((x) => ({ ...x, modes: x.modes.map((mm, i) => (i === n ? m : mm)) }))

  const submit = async (e) => {
    e.preventDefault()
    if (!v.manufacturer.trim() || !v.model.trim()) { toast("Hersteller und Modell sind Pflichtfelder.", true); return }
    const names = v.modes.map((m) => m.name.trim())
    if (names.some((n) => !n)) { toast("Jeder Mode braucht einen Namen.", true); return }
    if (new Set(names).size !== names.length) { toast("Mode-Namen müssen eindeutig sein.", true); return }
    setBusy(true)
    const data = {
      manufacturer: v.manufacturer.trim(), model: v.model.trim(), color: v.color, notes: v.notes,
      power_w: Number(v.power_w) || 0, weight_kg: Number(String(v.weight_kg).replace(",", ".")) || 0,
      modes: v.modes.map((m) => ({ ...m, name: m.name.trim() })),
    }
    if (gdtf) data.gdtf = gdtf
    if (image) data.image = image
    else if (dropImage) data.image = null
    if (manuals.length) data["manual+"] = manuals
    if (dropManuals.length) data["manual-"] = dropManuals
    try {
      const rec = await save("fixture_types", t?.id, data)
      toast("Gerätetyp gespeichert")
      go(`/typ/${rec.id}`)
    } catch (err) { toast(errMsg(err), true) } finally { setBusy(false) }
  }

  const curImage = image ? URL.createObjectURL(image) : t?.image && !dropImage ? fileUrl(t, t.image, "160x160") : null

  return html`<div class="wrap narrow">
    <${Head}
      crumb=${t ? [`#/typ/${t.id}`, label(t)] : ["#/typen", "Gerätetypen"]}
      title=${html`<h1>${t ? "Gerätetyp bearbeiten" : "Neuer Gerätetyp"}</h1>`} />

    <form class="form" onSubmit=${submit}>
      <section class="section">
        <h2>GDTF-Datei</h2>
        ${t?.gdtf && !gdtf ? html`<div class="files"><a class="file" href=${fileUrl(t, t.gdtf) + "?download=1"}><${Icon} name="download" /><span>${t.gdtf}</span><small>gespeichert</small></a></div>` : null}
        ${gdtf ? html`<div class="files"><div class="file"><${Icon} name="file" /><span>${gdtf.name}</span><small>neu</small></div></div>` : null}
        <${FileDrop} accept=".gdtf" onFiles=${onGdtf}>
          <strong>${t?.gdtf || gdtf ? "Andere GDTF-Datei wählen" : "GDTF-Datei wählen oder hierher ziehen"}</strong>
          <span>Hersteller, Modell, Modes und Kanäle werden ausgelesen</span>
        <//>
        ${parseInfo ? html`<p class=${parseInfo.ok ? "hint" : "err"}>${parseInfo.text}</p>` : null}
      </section>

      <section class="section">
        <h2>Modell</h2>
        <div class="grid2">
          <${Field} label="Hersteller *"><input id="t-man" required ...${bind("manufacturer")} placeholder="z. B. Stairville" /><//>
          <${Field} label="Modell *"><input id="t-model" required ...${bind("model")} placeholder="z. B. LED Par 56 MKII" /><//>
          <${Field} label="Leistung (W)"><input id="t-w" type="number" min="0" inputmode="numeric" ...${bind("power_w")} /><//>
          <${Field} label="Gewicht (kg)"><input id="t-kg" inputmode="decimal" ...${bind("weight_kg")} /><//>
        </div>
        <div class="field"><span>Farbe im Patch</span>
          <div class="tape-picker">
            ${TAPES.map(([c, n]) => html`<button type="button" data-c style=${`--tape:${c}`} title=${n} aria-label=${n}
              aria-pressed=${(v.color || tapeOf(t || { id: "x" })) === c && !!v.color} onClick=${() => setV((x) => ({ ...x, color: c }))}></button>`)}
            <button type="button" class="btn sm ghost" style="width:auto" aria-pressed=${!v.color} onClick=${() => setV((x) => ({ ...x, color: "" }))}>Automatisch</button>
          </div>
        </div>
        <div class="row">
          ${curImage ? html`<img src=${curImage} alt="" style="width:72px;height:72px;object-fit:contain;background:var(--surface-2);border-radius:4px;padding:4px" />` : null}
          <label class="btn sm"><${Icon} name="camera" />${curImage ? "Bild ersetzen" : "Bild hinzufügen"}
            <input type="file" accept="image/*" hidden onChange=${(e) => { setImage(e.target.files[0] || null); setDropImage(false) }} /></label>
          ${curImage ? html`<button type="button" class="btn sm ghost" onClick=${() => { setImage(null); setDropImage(true) }}>Bild entfernen</button>` : null}
        </div>
      </section>

      <section class="section">
        <div class="spread"><h2>DMX-Modes</h2>
          <button type="button" class="btn sm" onClick=${() => setV((x) => ({ ...x, modes: [...x.modes, { name: "", footprint: 0, channels: [] }] }))}>
            <${Icon} name="plus" />Mode</button></div>
        ${!v.modes.length ? html`<p class="muted">Keine Modes. Für Geräte ohne DMX (Kabel, Stative) einfach leer lassen.</p>` : null}
        ${v.modes.map((m, n) => html`<${ModeEditor} key=${`${modeKey}-${n}`} mode=${m} onChange=${(mm) => setMode(n, mm)}
          onRemove=${() => setV((x) => ({ ...x, modes: x.modes.filter((_, i) => i !== n) }))} />`)}
      </section>

      <section class="section">
        <h2>Anleitungen</h2>
        ${(t?.manual || []).length || manuals.length ? html`<div class="files">
          ${(t?.manual || []).map((m) => {
            const gone = dropManuals.includes(m)
            return html`<div class="file" style=${gone ? "opacity:.45" : ""}><${Icon} name="file" /><span>${m}</span>
              <button type="button" class="btn sm ghost" style="margin-left:auto" onClick=${() => setDropManuals(gone ? dropManuals.filter((x) => x !== m) : [...dropManuals, m])}>${gone ? "Behalten" : "Entfernen"}</button></div>`
          })}
          ${manuals.map((f, n) => html`<div class="file"><${Icon} name="file" /><span>${f.name}</span>
            <button type="button" class="btn sm ghost" style="margin-left:auto" onClick=${() => setManuals(manuals.filter((_, i) => i !== n))}>Entfernen</button></div>`)}
        </div>` : null}
        <${FileDrop} accept=".pdf,application/pdf,image/*" multiple onFiles=${(files) => setManuals([...manuals, ...files])}>
          <strong>PDF-Anleitung hinzufügen</strong><span>Bis 50 MB pro Datei</span>
        <//>
      </section>

      <section class="section">
        <${Field} label="Notizen"><textarea id="t-notes" ...${bind("notes")} placeholder="Eigenheiten, Firmware, Zubehör …"></textarea><//>
      </section>

      <div class="form-foot">
        <button type="button" class="btn ghost" onClick=${() => (t ? go(`/typ/${t.id}`) : go("/typen"))}>Abbrechen</button>
        <button class="btn primary" disabled=${busy}><${Icon} name="check" />Speichern</button>
      </div>
    </form>
  </div>`
}

import { html, useState } from "../../vendor/preact-htm.mjs"
import {
  pb, useStore, save, remove, go, toast, confirmDialog, errMsg, isAdmin,
  TAPES, tapeOf, modesOf, locOf, fileUrl, itemsOfType, fmtRange,
} from "../store.js"
import { t, tn, chName } from "../i18n.js"
import { Icon, Plate, Cond, Swatch, Field, Empty, Head, FileDrop, useForm } from "../ui.js"
import { ChannelList } from "./items.js"

const label = (ty) => `${ty.manufacturer} ${ty.model}`

export function TypeList() {
  const s = useStore()
  return html`<div class="wrap">
    <${Head}
      title=${html`<h1>${t("Gerätetypen")}</h1>`}
      sub=${t("Ein Typ beschreibt ein Modell: DMX-Modes, Kanalbelegung, GDTF-Datei und Anleitung. Zehn gleiche PARs teilen sich einen Typ.")}
      actions=${html`<a class="btn primary" href="#/typ/neu"><${Icon} name="plus" />${t("Neuer Typ")}</a>`} />
    ${!s.types.length ? html`<${Empty} title=${t("Noch keine Gerätetypen")}
        action=${html`<a class="btn primary" href="#/typ/neu"><${Icon} name="upload" />${t("GDTF-Datei hochladen")}</a>`}>
        ${t("Am schnellsten geht es mit einer GDTF-Datei vom Hersteller oder von gdtf-share.com: Hersteller, Modell, alle Modes und Kanäle werden daraus übernommen. Ohne GDTF kannst du Modes auch von Hand eintragen.")}<//>` : html`
      <div class="tiles">
        ${s.types.map((ty) => {
          const items = itemsOfType(ty.id)
          const modes = modesOf(ty)
          return html`<a class="tile" href=${`#/typ/${ty.id}`} key=${ty.id}>
            <div class="tile-top">
              ${ty.image ? html`<img class="tile-img" src=${fileUrl(ty, ty.image, "160x160")} alt="" loading="lazy" />`
                : html`<span class="tile-img none"><${Icon} name="spot" /></span>`}
              <div><span class="k">${ty.manufacturer}</span><span class="big">${ty.model}</span></div>
            </div>
            ${modes.length ? html`<div class="modes">${modes.map((m) => html`<span class="mode-pill">${m.name}${String(m.name).includes(String(m.footprint)) ? null : html`<b>${m.footprint}</b>`}</span>`)}</div>`
              : html`<span class="faint" style="font-size:14px">${t("Keine DMX-Modes")}</span>`}
            <div class="tile-foot">
              <span><b>${items.length}</b> ${items.length === 1 ? t("Gerät") : t("Geräte")}</span>
              <span class="row">${ty.gdtf ? html`<span class="chip plain accent">GDTF</span>` : null}${ty.manual?.length ? html`<span class="chip plain">${t("Anleitung")}</span>` : null}</span>
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
  const ty = s.types.find((x) => x.id === id)
  if (!ty) return html`<div class="wrap"><${Empty} title=${t("Typ nicht gefunden")} action=${html`<a class="btn" href="#/typen">${t("Zu den Gerätetypen")}</a>`} /></div>`
  const items = itemsOfType(ty.id)
  const modes = modesOf(ty)

  const del = async () => {
    const msg = items.length
      ? t("„{name}“ löschen? {n} Teile verlieren dadurch ihren Typ (die Teile selbst bleiben erhalten).", { name: label(ty), n: items.length })
      : t("„{name}“ löschen?", { name: label(ty) })
    if (!(await confirmDialog(msg))) return
    try { await remove("fixture_types", ty.id); toast(t("Typ gelöscht")); go("/typen") } catch (err) { toast(errMsg(err), true) }
  }

  return html`<div class="wrap">
    <${Head}
      crumb=${["#/typen", t("Gerätetypen")]}
      title=${html`<span class="label">${ty.manufacturer}</span><h1>${ty.model}</h1>`}
      actions=${html`
        <a class="btn primary" href=${`#/typ/${ty.id}/bearbeiten`}><${Icon} name="edit" />${t("Bearbeiten")}</a>
        <a class="btn" href=${`#/neu?typ=${ty.id}`}><${Icon} name="plus" />${t("Gerät anlegen")}</a>
        ${isAdmin() ? html`<button class="btn danger icon" aria-label=${t("Löschen")} title=${t("Löschen")} onClick=${del}><${Icon} name="trash" /></button>` : null}`} />

    <div class="detail">
      <div class="col">
        <section class="panel">
          <h2>${t("DMX-Modes & Kanalbelegung")}</h2>
          ${modes.length ? html`<${ModeTabs} modes=${modes} />` : html`<p class="muted">${t("Keine Modes hinterlegt.")} <a href=${`#/typ/${ty.id}/bearbeiten`}>${t("GDTF hochladen oder Modes eintragen")}</a></p>`}
        </section>
        <section class="panel">
          <h2>${t("Geräte dieses Typs")} · ${items.length}</h2>
          ${items.length ? html`<div class="tablewrap" style="border:0"><table class="t"><tbody>
            ${items.map((i) => html`<tr onClick=${() => go(`/i/${i.id}`)}>
              <td><${Plate} no=${i.inv_no} /></td>
              <td><a href=${`#/i/${i.id}`} style="text-decoration:none;font-weight:600">${i.name}</a><span class="sub">${locOf(i)?.name || ""}</span></td>
              <td class="dmx">${i.dmx_address > 0 ? fmtRange(i) : ""}${i.dmx_mode ? html` <span class="faint">${i.dmx_mode}</span>` : null}</td>
              <td><${Cond} c=${i.condition} /></td>
            </tr>`)}
          </tbody></table></div>` : html`<p class="muted">${t("Noch keine Geräte.")} <a href=${`#/neu?typ=${ty.id}`}>${t("Erstes Gerät anlegen")}</a></p>`}
        </section>
      </div>
      <div class="col">
        <section class="panel">
          <div class="tile-top">
            ${ty.image ? html`<img class="tile-img" style="width:88px;height:88px" src=${fileUrl(ty, ty.image, "160x160")} alt="" />` : null}
            <dl class="facts" style="flex:1">
              <div><dt>${t("Patch-Farbe")}</dt><dd class="row"><${Swatch} type=${ty} />${t(TAPES.find(([c]) => c === tapeOf(ty))?.[1] || "eigene")}</dd></div>
              ${ty.power_w ? html`<div><dt>${t("Leistung")}</dt><dd class="mono">${ty.power_w} W</dd></div>` : null}
              ${ty.weight_kg ? html`<div><dt>${t("Gewicht")}</dt><dd class="mono">${String(ty.weight_kg).replace(".", t(","))} kg</dd></div>` : null}
            </dl>
          </div>
          ${ty.notes ? html`<p class="notes">${ty.notes}</p>` : null}
        </section>
        <section class="panel">
          <h2>${t("Unterlagen")}</h2>
          ${ty.gdtf || ty.manual?.length ? html`<div class="files">
            ${ty.gdtf ? html`<a class="file" href=${fileUrl(ty, ty.gdtf) + "?download=1"}><${Icon} name="download" /><span>${ty.gdtf}</span><small>GDTF</small></a>` : null}
            ${(ty.manual || []).map((m) => html`<a class="file" href=${fileUrl(ty, m)} target="_blank" rel="noopener"><${Icon} name="file" /><span>${m}</span><small>${t("Anleitung")}</small></a>`)}
          </div>` : html`<p class="muted">${t("Keine Dateien.")} <a href=${`#/typ/${ty.id}/bearbeiten`}>${t("GDTF oder Anleitung hochladen")}</a></p>`}
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
  const [text, setText] = useState(mode.channels.map(chName).join("\n"))
  const setLines = (val) => {
    setText(val)
    const names = val.split("\n").map((l) => l.trim()).filter(Boolean)
    // unchanged lines keep their GDTF data (attribute, value ranges)
    const channels = names.map((name, i) => {
      const prev = mode.channels[i]
      return prev && chName(prev) === name ? prev : { ch: i + 1, name }
    })
    onChange({ ...mode, channels, footprint: channels.length || mode.footprint })
  }
  return html`<div class="mode-ed">
    <div class="mode-ed-head">
      <${Field} label=${t("Mode-Name")}><input value=${mode.name} onInput=${(e) => onChange({ ...mode, name: e.target.value })} placeholder=${t("z. B. 8ch")} /><//>
      <${Field} label=${t("Kanäle")}>
        <input type="number" min="1" max="512" style="width:90px" value=${mode.footprint || ""} disabled=${mode.channels.length > 0}
          onInput=${(e) => onChange({ ...mode, footprint: Number(e.target.value) || 0 })} /><//>
      <button type="button" class="btn icon" aria-label=${t("Mode entfernen")} title=${t("Mode entfernen")} onClick=${onRemove}><${Icon} name="trash" /></button>
    </div>
    ${plain ? html`<${Field} label=${t("Kanalbelegung")} hint=${t("Eine Zeile pro Kanal, von oben nach unten (Kanal 1, 2, 3 …). Leer lassen, wenn unbekannt.")}>
        <textarea class="code" rows=${Math.min(16, Math.max(4, mode.channels.length + 1))} value=${text} onInput=${(e) => setLines(e.target.value)}
          placeholder=${t("Dimmer\nRot\nGrün\nBlau\nStrobe")}></textarea><//>`
      : html`<p class="hint">${t("Diese Belegung stammt aus der GDTF-Datei (mehrere DMX-Breaks oder Lücken) und lässt sich nur über eine neue GDTF ändern.")}</p>
        <${ChannelList} mode=${mode} start=${0} />`}
  </div>`
}

function fileFromBase64({ name, base64 }) {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], name, { type: name.endsWith(".svg") ? "image/svg+xml" : "image/png" })
}

export function TypeEdit({ id }) {
  const s = useStore()
  const ty = id ? s.types.find((x) => x.id === id) : null
  const [v, setV, bind] = useForm(() => ({
    manufacturer: ty?.manufacturer || "", model: ty?.model || "", color: ty?.color || "",
    power_w: ty?.power_w || "", weight_kg: ty?.weight_kg || "", notes: ty?.notes || "",
    modes: structuredClone(modesOf(ty)),
  }))
  const [gdtf, setGdtf] = useState(null)        // new File
  const [image, setImage] = useState(null)      // new File
  const [dropImage, setDropImage] = useState(false)
  const [manuals, setManuals] = useState([])
  const [dropManuals, setDropManuals] = useState([])
  const [parseInfo, setParseInfo] = useState(null)
  const [modeKey, setModeKey] = useState(0)     // remount editors when GDTF replaces modes
  const [busy, setBusy] = useState(false)

  if (id && !ty) return html`<div class="wrap"><${Empty} title=${t("Typ nicht gefunden")} /></div>`

  // the server parses the GDTF (same parser as for API uploads); the file itself is stored unchanged on save
  const onGdtf = async ([file]) => {
    setParseInfo({ ok: true, text: t("GDTF wird gelesen…") })
    try {
      const fd = new FormData()
      fd.append("file", file)
      const g = await pb.send("/api/gdtf/parse", { method: "POST", body: fd })
      setGdtf(file)
      setV((x) => ({ ...x, manufacturer: g.manufacturer || x.manufacturer, model: g.model || x.model, modes: g.modes }))
      setModeKey((k) => k + 1)
      if (g.thumbnail && !ty?.image && !image) setImage(fileFromBase64(g.thumbnail))
      setParseInfo({
        ok: true,
        text: t("{name}: {modes} übernommen ({list}). Die Datei wird beim Speichern unverändert abgelegt.", {
          name: `${g.manufacturer} ${g.model}`,
          modes: tn(g.modes.length, "{n} Mode", "{n} Modes"),
          list: g.modes.map((m) => `${m.name} · ${t("{n} Kan.", { n: m.footprint })}`).join(", "),
        }),
      })
    } catch (err) {
      setParseInfo({ ok: false, text: `${file.name}: ${errMsg(err)}` })
    }
  }

  const setMode = (n, m) => setV((x) => ({ ...x, modes: x.modes.map((mm, i) => (i === n ? m : mm)) }))

  const submit = async (e) => {
    e.preventDefault()
    if (!v.manufacturer.trim() || !v.model.trim()) { toast(t("Hersteller und Modell sind Pflichtfelder."), true); return }
    const names = v.modes.map((m) => m.name.trim())
    if (names.some((n) => !n)) { toast(t("Jeder Mode braucht einen Namen."), true); return }
    if (new Set(names).size !== names.length) { toast(t("Mode-Namen müssen eindeutig sein."), true); return }
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
      const rec = await save("fixture_types", ty?.id, data)
      toast(t("Gerätetyp gespeichert"))
      go(`/typ/${rec.id}`)
    } catch (err) { toast(errMsg(err), true) } finally { setBusy(false) }
  }

  const curImage = image ? URL.createObjectURL(image) : ty?.image && !dropImage ? fileUrl(ty, ty.image, "160x160") : null

  return html`<div class="wrap narrow">
    <${Head}
      crumb=${ty ? [`#/typ/${ty.id}`, label(ty)] : ["#/typen", t("Gerätetypen")]}
      title=${html`<h1>${ty ? t("Gerätetyp bearbeiten") : t("Neuer Gerätetyp")}</h1>`} />

    <form class="form" onSubmit=${submit}>
      <section class="section">
        <h2>${t("GDTF-Datei")}</h2>
        ${ty?.gdtf && !gdtf ? html`<div class="files"><a class="file" href=${fileUrl(ty, ty.gdtf) + "?download=1"}><${Icon} name="download" /><span>${ty.gdtf}</span><small>${t("gespeichert")}</small></a></div>` : null}
        ${gdtf ? html`<div class="files"><div class="file"><${Icon} name="file" /><span>${gdtf.name}</span><small>${t("neu")}</small></div></div>` : null}
        <${FileDrop} accept=".gdtf" onFiles=${onGdtf}>
          <strong>${ty?.gdtf || gdtf ? t("Andere GDTF-Datei wählen") : t("GDTF-Datei wählen oder hierher ziehen")}</strong>
          <span>${t("Hersteller, Modell, Modes und Kanäle werden ausgelesen")}</span>
        <//>
        ${parseInfo ? html`<p class=${parseInfo.ok ? "hint" : "err"}>${parseInfo.text}</p>` : null}
      </section>

      <section class="section">
        <h2>${t("Modell")}</h2>
        <div class="grid2">
          <${Field} label=${`${t("Hersteller")} *`}><input id="t-man" required ...${bind("manufacturer")} placeholder=${t("z. B. Stairville")} /><//>
          <${Field} label=${`${t("Modell")} *`}><input id="t-model" required ...${bind("model")} placeholder=${t("z. B. LED Par 56 MKII")} /><//>
          <${Field} label=${t("Leistung (W)")}><input id="t-w" type="number" min="0" inputmode="numeric" ...${bind("power_w")} /><//>
          <${Field} label=${t("Gewicht (kg)")}><input id="t-kg" inputmode="decimal" ...${bind("weight_kg")} /><//>
        </div>
        <div class="field"><span>${t("Farbe im Patch")}</span>
          <div class="tape-picker">
            ${TAPES.map(([c, n]) => html`<button type="button" data-c style=${`--tape:${c}`} title=${t(n)} aria-label=${t(n)}
              aria-pressed=${(v.color || tapeOf(ty || { id: "x" })) === c && !!v.color} onClick=${() => setV((x) => ({ ...x, color: c }))}></button>`)}
            <button type="button" class="btn sm ghost" style="width:auto" aria-pressed=${!v.color} onClick=${() => setV((x) => ({ ...x, color: "" }))}>${t("Automatisch")}</button>
          </div>
        </div>
        <div class="row">
          ${curImage ? html`<img src=${curImage} alt="" style="width:72px;height:72px;object-fit:contain;background:var(--surface-2);border-radius:4px;padding:4px" />` : null}
          <label class="btn sm"><${Icon} name="camera" />${curImage ? t("Bild ersetzen") : t("Bild hinzufügen")}
            <input type="file" accept="image/*" hidden onChange=${(e) => { setImage(e.target.files[0] || null); setDropImage(false) }} /></label>
          ${curImage ? html`<button type="button" class="btn sm ghost" onClick=${() => { setImage(null); setDropImage(true) }}>${t("Bild entfernen")}</button>` : null}
        </div>
      </section>

      <section class="section">
        <div class="spread"><h2>${t("DMX-Modes")}</h2>
          <button type="button" class="btn sm" onClick=${() => setV((x) => ({ ...x, modes: [...x.modes, { name: "", footprint: 0, channels: [] }] }))}>
            <${Icon} name="plus" />${t("Mode")}</button></div>
        ${!v.modes.length ? html`<p class="muted">${t("Keine Modes. Für Geräte ohne DMX (Kabel, Stative) einfach leer lassen.")}</p>` : null}
        ${v.modes.map((m, n) => html`<${ModeEditor} key=${`${modeKey}-${n}`} mode=${m} onChange=${(mm) => setMode(n, mm)}
          onRemove=${() => setV((x) => ({ ...x, modes: x.modes.filter((_, i) => i !== n) }))} />`)}
      </section>

      <section class="section">
        <h2>${t("Anleitungen")}</h2>
        ${(ty?.manual || []).length || manuals.length ? html`<div class="files">
          ${(ty?.manual || []).map((m) => {
            const gone = dropManuals.includes(m)
            return html`<div class="file" style=${gone ? "opacity:.45" : ""}><${Icon} name="file" /><span>${m}</span>
              <button type="button" class="btn sm ghost" style="margin-left:auto" onClick=${() => setDropManuals(gone ? dropManuals.filter((x) => x !== m) : [...dropManuals, m])}>${gone ? t("Behalten") : t("Entfernen")}</button></div>`
          })}
          ${manuals.map((file, n) => html`<div class="file"><${Icon} name="file" /><span>${file.name}</span>
            <button type="button" class="btn sm ghost" style="margin-left:auto" onClick=${() => setManuals(manuals.filter((_, i) => i !== n))}>${t("Entfernen")}</button></div>`)}
        </div>` : null}
        <${FileDrop} accept=".pdf,application/pdf,image/*" multiple onFiles=${(files) => setManuals([...manuals, ...files])}>
          <strong>${t("PDF-Anleitung hinzufügen")}</strong><span>${t("Bis 50 MB pro Datei")}</span>
        <//>
      </section>

      <section class="section">
        <${Field} label=${t("Notizen")}><textarea id="t-notes" ...${bind("notes")} placeholder=${t("Eigenheiten, Firmware, Zubehör …")}></textarea><//>
      </section>

      <div class="form-foot">
        <button type="button" class="btn ghost" onClick=${() => (ty ? go(`/typ/${ty.id}`) : go("/typen"))}>${t("Abbrechen")}</button>
        <button class="btn primary" disabled=${busy}><${Icon} name="check" />${t("Speichern")}</button>
      </div>
    </form>
  </div>`
}

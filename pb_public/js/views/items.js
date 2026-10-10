import { html, useEffect, useMemo, useState } from "../../vendor/preact-htm.mjs"
import {
  pb, state, useStore, save, remove, go, toast, confirmDialog, errMsg, isAdmin,
  CONDITIONS, condLabel, fieldLabel, org, typeOf, locOf, modeOf, modesOf, userName, isDmx,
  fmtAddr, fmtRange, pad3, fmtDate, fmtDateTime, ageDays, fileUrl, suggestions,
} from "../store.js"
import { t, tn, lang, chName } from "../i18n.js"
import { Icon, Plate, Cond, Thumb, Field, Empty, Head, FileDrop, useForm } from "../ui.js"

// suggestions for the free-text category field, in the UI language
export const BASE_CATEGORIES = lang === "de"
  ? ["Licht", "Ton", "Kabel", "Strom", "Stative & Traversen", "Effekte", "Bühne & Deko", "Video", "Cases", "Werkzeug"]
  : ["Lighting", "Sound", "Cables", "Power", "Stands & truss", "Effects", "Stage & set", "Video", "Cases", "Tools"]
const typeLabel = (ty) => (ty ? `${ty.manufacturer} ${ty.model}` : "")

// survives navigating to an item and back
const listState = { q: "", category: "", location: "", condition: "", type: "", dmx: false, sort: "inv_no", sel: new Set() }
export function setListFilter(patch) { Object.assign(listState, { q: "", category: "", location: "", condition: "", type: "", dmx: false }, patch) }

function haystack(item) {
  const ty = typeOf(item)
  const l = locOf(item)
  return [item.inv_no, item.name, item.category, item.serial, item.sublocation, item.notes, ty?.manufacturer, ty?.model, l?.name, item.dmx_mode]
    .join(" ").toLowerCase()
}

const SORTERS = {
  inv_no: (a, b) => a.inv_no.localeCompare(b.inv_no),
  name: (a, b) => a.name.localeCompare(b.name, lang),
  category: (a, b) => (a.category || "~").localeCompare(b.category || "~", lang) || a.inv_no.localeCompare(b.inv_no),
  location: (a, b) => (locOf(a)?.name || "~").localeCompare(locOf(b)?.name || "~", lang) || (a.sublocation || "").localeCompare(b.sublocation || "", lang),
  dmx: (a, b) => (a.dmx_universe || 1e9) - (b.dmx_universe || 1e9) || (a.dmx_address || 1e9) - (b.dmx_address || 1e9),
}

export function DmxCell({ item }) {
  if (!(item.dmx_address > 0)) return isDmx(item) ? html`<span class="faint">—</span>` : null
  const mode = modeOf(item)
  return html`<span class="dmx">${fmtRange(item, mode)}${mode ? html` <span class="faint">${mode.name}</span>` : null}</span>`
}

export function ItemList() {
  const s = useStore()
  const [f, setF] = useState({ ...listState })
  const set = (patch) => { Object.assign(listState, patch); setF({ ...listState }) }

  const rows = useMemo(() => {
    const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean)
    return s.items.filter((i) => {
      if (f.category && (i.category || "") !== (f.category === "-" ? "" : f.category)) return false
      if (f.location && (i.location || "") !== (f.location === "-" ? "" : f.location)) return false
      if (f.condition && i.condition !== f.condition) return false
      if (f.type && (i.type || "") !== (f.type === "-" ? "" : f.type)) return false
      if (f.dmx && !isDmx(i)) return false
      if (terms.length) { const h = haystack(i); return terms.every((w) => h.includes(w)) }
      return true
    }).sort(SORTERS[f.sort])
  }, [s.items, s.types, s.locations, f])

  const cats = suggestions(s.items, "category")
  const filtered = f.q || f.category || f.location || f.condition || f.type || f.dmx
  const total = s.items.reduce((n, i) => n + (i.quantity || 1), 0)
  const toggle = (id) => { const sel = new Set(f.sel); sel.has(id) ? sel.delete(id) : sel.add(id); set({ sel }) }
  const allSel = rows.length > 0 && rows.every((r) => f.sel.has(r.id))
  const SortTh = ({ k, children, cls }) => html`
    <th class=${cls} aria-sort=${f.sort === k ? "ascending" : undefined}>
      <button onClick=${() => set({ sort: k })}>${children}${f.sort === k ? " ↓" : ""}</button></th>`

  if (!s.items.length) {
    const p = org().prefix
    return html`<div class="wrap">
      <${Head} title=${html`<h1>${t("Inventar")}</h1>`} />
      <${Empty} title=${t("Noch nichts erfasst")}
        action=${html`<a class="btn primary" href="#/neu"><${Icon} name="plus" />${t("Erstes Teil anlegen")}</a>`}>
        ${t("Leg Scheinwerfer, Kabel, Stative und alles andere als einzelne Teile an. Jedes Teil bekommt automatisch eine Inventarnummer ({a}, {b}, …) und einen QR-Code für das Etikett.", { a: `${p}-0001`, b: `${p}-0002` })}
        ${" "}${t("Für DMX-Geräte lohnt es sich, zuerst den Gerätetyp mit GDTF-Datei anzulegen.")} <a href="#/typen">${t("Gerätetypen")}</a>
      <//>
    </div>`
  }

  return html`<div class="wrap">
    <${Head}
      title=${html`<h1>${t("Inventar")}</h1>`}
      sub=${`${tn(s.items.length, "{n} Eintrag", "{n} Einträge")} · ${t("{n} Stück", { n: total })}`}
      actions=${html`<a class="btn primary" href="#/neu"><${Icon} name="plus" />${t("Neues Teil")}</a>`} />

    <div class="toolbar">
      <div class="search">
        <${Icon} name="search" />
        <input id="q" type="search" placeholder=${t("Suchen: Nummer, Name, Typ, Lagerort, Seriennr. …")} value=${f.q}
          onInput=${(e) => set({ q: e.target.value })} aria-label=${t("Inventar durchsuchen")} />
      </div>
      <div class="filters">
        <select id="f-cat" class=${f.category ? "on" : ""} value=${f.category} onChange=${(e) => set({ category: e.target.value })} aria-label=${t("Kategorie")}>
          <option value="">${t("Alle Kategorien")}</option>
          ${cats.map((c) => html`<option value=${c}>${c}</option>`)}
          <option value="-">${t("Ohne Kategorie")}</option>
        </select>
        <select id="f-loc" class=${f.location ? "on" : ""} value=${f.location} onChange=${(e) => set({ location: e.target.value })} aria-label=${t("Lagerort")}>
          <option value="">${t("Alle Lagerorte")}</option>
          ${s.locations.map((l) => html`<option value=${l.id}>${l.name}</option>`)}
          <option value="-">${t("Ohne Lagerort")}</option>
        </select>
        <select id="f-type" class=${f.type ? "on" : ""} value=${f.type} onChange=${(e) => set({ type: e.target.value })} aria-label=${t("Gerätetyp")}>
          <option value="">${t("Alle Typen")}</option>
          ${s.types.map((ty) => html`<option value=${ty.id}>${typeLabel(ty)}</option>`)}
          <option value="-">${t("Ohne Typ")}</option>
        </select>
        <select id="f-cond" class=${f.condition ? "on" : ""} value=${f.condition} onChange=${(e) => set({ condition: e.target.value })} aria-label=${t("Zustand")}>
          <option value="">${t("Jeder Zustand")}</option>
          ${Object.keys(CONDITIONS).map((k) => html`<option value=${k}>${condLabel(k)}</option>`)}
        </select>
        <label class="check"><input id="f-dmx" type="checkbox" checked=${f.dmx} onChange=${(e) => set({ dmx: e.target.checked })} />${t("Nur DMX")}</label>
        ${filtered ? html`<button class="btn ghost" onClick=${() => set({ q: "", category: "", location: "", condition: "", type: "", dmx: false })}>${t("Zurücksetzen")}</button>` : null}
      </div>
    </div>

    ${!rows.length ? html`<${Empty} title=${t("Nichts gefunden")}>${t("Keine Teile passen zu Suche und Filtern.")}<//>` : html`
      <div class="tablewrap items">
        <table class="t">
          <thead><tr>
            <th class="cb"><input type="checkbox" class="check" aria-label=${t("Alle auswählen")} checked=${allSel}
              onChange=${() => set({ sel: allSel ? new Set() : new Set(rows.map((r) => r.id)) })} /></th>
            <${SortTh} k="inv_no">${t("Nr.")}<//>
            <${SortTh} k="name">${t("Gerät")}<//>
            <${SortTh} k="category">${t("Kategorie")}<//>
            <${SortTh} k="location">${t("Lagerort")}<//>
            <${SortTh} k="dmx">${t("DMX zuletzt")}<//>
            <th>${t("Zustand")}</th>
          </tr></thead>
          <tbody>
            ${rows.map((i) => {
              const ty = typeOf(i)
              const l = locOf(i)
              return html`<tr key=${i.id} class=${f.sel.has(i.id) ? "sel" : ""} onClick=${() => go(`/i/${i.id}`)}>
                <td class="cb" onClick=${(e) => e.stopPropagation()}>
                  <input type="checkbox" aria-label=${t("{n} auswählen", { n: i.inv_no })} checked=${f.sel.has(i.id)} onChange=${() => toggle(i.id)} /></td>
                <td><${Plate} no=${i.inv_no} /></td>
                <td><a href=${`#/i/${i.id}`} style="text-decoration:none;font-weight:600" onClick=${(e) => e.stopPropagation()}>${i.name}</a>
                  ${i.quantity > 1 ? html` <span class="muted mono">×${i.quantity}</span>` : null}
                  ${ty ? html`<span class="sub">${typeLabel(ty)}</span>` : null}</td>
                <td>${i.category || html`<span class="faint">—</span>`}</td>
                <td>${l ? l.name : html`<span class="faint">—</span>`}${i.sublocation ? html`<span class="sub">${i.sublocation}</span>` : null}</td>
                <td><${DmxCell} item=${i} /></td>
                <td><${Cond} c=${i.condition} /></td>
              </tr>`
            })}
          </tbody>
        </table>
      </div>
      <div class="cards">
        ${rows.map((i) => {
          const ty = typeOf(i)
          const l = locOf(i)
          const meta = [ty && typeLabel(ty), l && [l.name, i.sublocation].filter(Boolean).join(" · ")].filter(Boolean).join(" — ")
          return html`<a key=${i.id} class="icard" href=${`#/i/${i.id}`}>
            <${Thumb} item=${i} />
            <div class="top"><${Plate} no=${i.inv_no} />${i.condition !== "ok" ? html`<${Cond} c=${i.condition} />` : null}</div>
            <span></span>
            <div class="n" style="grid-column:2/4">${i.name}${i.quantity > 1 ? html` <span class="muted mono">×${i.quantity}</span>` : null}</div>
            <div class="m">${meta}${i.dmx_address > 0 ? html` · <span class="mono">${fmtRange(i)}</span>` : null}</div>
          </a>`
        })}
      </div>`}

    ${f.sel.size ? html`<div class="selbar">
      ${t("{n} ausgewählt", { n: f.sel.size })}
      <a class="btn primary sm" href=${`#/etiketten?ids=${[...f.sel].join(",")}`}><${Icon} name="tag" />${t("Etiketten")}</a>
      <button class="btn ghost sm icon" aria-label=${t("Auswahl aufheben")} onClick=${() => set({ sel: new Set() })}><${Icon} name="x" /></button>
    </div>` : null}
  </div>`
}

// ---------------------------------------------------------------- detail

export function ChannelList({ mode, start }) {
  if (!mode?.channels?.length) return html`<p class="muted">${t("Für diesen Mode sind keine Kanäle hinterlegt.")}</p>`
  return html`<div class=${`chlist${start > 0 ? "" : " noaddr"}`}>
    ${mode.channels.map((c) => html`<div class="chrow">
      <span class="c">${c.brk ? `B${c.brk}·` : ""}${c.ch}</span>
      <span class="a">${start > 0 && !c.brk ? pad3(start + c.ch - 1) : ""}</span>
      ${c.fns?.length ? html`<details><summary>${chName(c)}</summary>
        <div class="fns">${c.fns.map((fn) => html`
          <div><span class="r">${fn.from}–${fn.to}</span><span>${fn.name}</span></div>
          ${(fn.sets || []).map((st) => html`<div class="set"><span class="r">${st.from}–${st.to}</span><span>${st.name}</span></div>`)}`)}
        </div></details>` : html`<span>${chName(c)}</span>`}
    </div>`)}
  </div>`
}

function DmxPanel({ item }) {
  const type = typeOf(item)
  const modes = modesOf(type)
  const mode = modeOf(item, type)
  const [edit, setEdit] = useState(false)
  const [v, setV, bind] = useForm({})
  const [busy, setBusy] = useState(false)
  const [showCh, setShowCh] = useState(false)

  const open = () => {
    setV({ dmx_universe: item.dmx_universe || 1, dmx_address: item.dmx_address || "", dmx_mode: item.dmx_mode || (modes.length === 1 ? modes[0].name : "") })
    setEdit(true)
  }
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await save("items", item.id, { dmx_universe: Number(v.dmx_address) ? Number(v.dmx_universe) || 1 : 0, dmx_address: Number(v.dmx_address) || 0, dmx_mode: v.dmx_mode })
      setEdit(false)
      toast(t("DMX-Daten gespeichert"))
    } catch (err) { toast(errMsg(err), true) } finally { setBusy(false) }
  }

  const fp = (modes.find((m) => m.name === v.dmx_mode) || mode)?.footprint || 1
  const overflow = edit && v.dmx_address && Number(v.dmx_address) + fp - 1 > 512
  const stale = ageDays(item.dmx_set_at) > 180

  return html`<section class="panel">
    <div class="panel-head">
      <h2>${t("DMX · zuletzt bekannt")}</h2>
      ${!edit ? html`<button class="btn sm" onClick=${open}><${Icon} name="edit" />${t("Ändern")}</button>` : null}
    </div>
    ${edit ? html`<form class="stack" onSubmit=${submit}>
      <div class="grid3">
        <${Field} label=${t("Universe")}><input id="d-u" type="number" min="1" max="999" inputmode="numeric" ...${bind("dmx_universe", { number: true })} /><//>
        <${Field} label=${t("Startadresse")}><input id="d-a" type="number" min="1" max="512" inputmode="numeric" placeholder=${t("leer = unbekannt")} ...${bind("dmx_address", { number: true })} /><//>
        <${Field} label=${t("Mode")}>
          <select id="d-m" ...${bind("dmx_mode")}>
            <option value="">—</option>
            ${modes.map((m) => html`<option value=${m.name}>${m.name} (${t("{n} Kan.", { n: m.footprint })})</option>`)}
            ${v.dmx_mode && !modes.some((m) => m.name === v.dmx_mode) ? html`<option value=${v.dmx_mode}>${v.dmx_mode}</option>` : null}
          </select>
        <//>
      </div>
      ${overflow ? html`<p class="err">${t("Adresse {a} + {n} Kanäle passt nicht mehr in das Universe (max. 512).", { a: v.dmx_address, n: fp })}</p>` : null}
      <div class="row">
        <button class="btn primary" disabled=${busy}><${Icon} name="check" />${t("Speichern")}</button>
        <button type="button" class="btn ghost" onClick=${() => setEdit(false)}>${t("Abbrechen")}</button>
      </div>
    </form>` : item.dmx_address > 0 ? html`
      <div class="addr">
        <span class="addr-big">${fmtAddr(item.dmx_universe, item.dmx_address)}${(mode?.footprint || 1) > 1 ? html`<span class="dim">–${pad3(item.dmx_address + mode.footprint - 1)}</span>` : null}</span>
        <a class="btn sm ghost" href=${`#/patch?u=${item.dmx_universe}&fokus=${item.id}`}><${Icon} name="grid" />${t("Im Patch")}</a>
      </div>
      <div class="addr-meta">
        <span>${t("Mode")} <b>${item.dmx_mode || t("unbekannt")}</b></span>
        ${mode ? html`<span>${tn(mode.footprint, "{n} Kanal", "{n} Kanäle")}</span>` : null}
      </div>
      ${item.dmx_set_at ? html`<p class=${`stamp${stale ? " stale" : ""}`}>
        ${item.dmx_set_by ? t("Gesetzt am {date} von {name}", { date: fmtDate(item.dmx_set_at), name: userName(item.dmx_set_by) }) : t("Gesetzt am {date}", { date: fmtDate(item.dmx_set_at) })}
        ${stale ? ` · ${t("älter als ein halbes Jahr, vor dem Einsatz prüfen")}` : ""}</p>` : null}
    ` : html`<p class="muted">${t("Keine Adresse bekannt.")} ${modes.length ? t("Trag die Adresse ein, sobald das Gerät gepatcht ist.") : ""}</p>`}

    ${mode && !edit ? html`
      <button class="btn sm ghost" style="justify-self:start" onClick=${() => setShowCh(!showCh)} aria-expanded=${showCh}>
        ${showCh ? t("Kanalbelegung ausblenden") : t("Kanalbelegung {mode} zeigen", { mode: mode.name })}</button>
      ${showCh ? html`<${ChannelList} mode=${mode} start=${item.dmx_address} />` : null}` : null}
  </section>`
}

function fmtVal(field, v) {
  if (v === null || v === undefined || v === "" || (v === "0" && field.startsWith("dmx_"))) return "—"
  if (field === "type") { const ty = state.types.find((x) => x.id === v); return ty ? typeLabel(ty) : t("(gelöschter Typ)") }
  if (field === "location") return state.locations.find((x) => x.id === v)?.name || t("(gelöschter Ort)")
  if (field === "condition") return condLabel(v)
  if (field === "photos") return tn(v.split(", ").filter(Boolean).length, "{n} Foto", "{n} Fotos")
  if (field === "notes") return v.length > 40 ? `${v.slice(0, 40)}…` : v
  return v
}

function History({ item }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    pb.collection("changes").getList(1, 30, { filter: pb.filter("item = {:id}", { id: item.id }), sort: "-created" })
      .then((r) => setRows(r.items)).catch(() => setRows([]))
  }, [item.id, item.updated])
  if (!rows) return null
  return html`<section class="panel">
    <h2>${t("Verlauf")}</h2>
    ${!rows.length ? html`<p class="muted">${t("Noch keine Änderungen.")}</p>` : html`<div class="history">
      ${rows.map((r) => html`<div class="hrow">
        <time datetime=${r.created}>${fmtDateTime(r.created)}</time>
        <div><b>${r.user ? userName(r.user) : t("System")}</b>${r.via ? html` <span class="muted">${t("über API-Schlüssel „{name}“", { name: r.via })}</span>` : null}
          ${" "}${r.action === "create" ? t("hat das Teil angelegt") : t("hat geändert:")}
          ${r.action === "update" ? html`<ul>${Object.entries(r.diff || {}).map(([k, [a, b]]) => html`
            <li>${fieldLabel(k)}: ${fmtVal(k, a)} → <b>${fmtVal(k, b)}</b></li>`)}</ul>` : null}
        </div>
      </div>`)}
    </div>`}
  </section>`
}

export function ItemDetail({ id }) {
  const s = useStore()
  const item = s.items.find((i) => i.id === id)
  if (!item) return html`<div class="wrap"><${Empty} title=${t("Teil nicht gefunden")} action=${html`<a class="btn" href="#/">${t("Zum Inventar")}</a>`}>${t("Es wurde gelöscht oder der Link ist falsch.")}<//></div>`
  const type = typeOf(item)
  const loc = locOf(item)

  const del = async () => {
    if (!(await confirmDialog(t("{no} „{name}“ endgültig löschen? Der Verlauf wird mitgelöscht.", { no: item.inv_no, name: item.name })))) return
    try { await remove("items", item.id); toast(t("{no} gelöscht", { no: item.inv_no })); go("/") } catch (err) { toast(errMsg(err), true) }
  }

  return html`<div class="wrap">
    <${Head}
      crumb=${["#/", t("Inventar")]}
      title=${html`<div class="row"><${Plate} no=${item.inv_no} lg /><${Cond} c=${item.condition} /></div><h1>${item.name}</h1>`}
      sub=${[type && typeLabel(type), item.category].filter(Boolean).join(" · ")}
      actions=${html`
        <a class="btn primary" href=${`#/i/${item.id}/bearbeiten`}><${Icon} name="edit" />${t("Bearbeiten")}</a>
        <a class="btn" href=${`#/etiketten?ids=${item.id}`}><${Icon} name="tag" />${t("Etikett")}</a>
        <a class="btn" href=${`#/neu?kopie=${item.id}`}><${Icon} name="copy" />${t("Duplizieren")}</a>
        ${isAdmin() ? html`<button class="btn danger icon" aria-label=${t("Löschen")} title=${t("Löschen")} onClick=${del}><${Icon} name="trash" /></button>` : null}`} />

    <div class="detail">
      <div class="col">
        <section class="panel">
          <dl class="facts">
            <div><dt>${t("Lagerort")}</dt><dd>${loc ? html`<a href=${`#/ort/${loc.id}`}>${loc.name}</a>` : "—"}${item.sublocation ? html`<br /><span class="muted">${item.sublocation}</span>` : null}</dd></div>
            <div><dt>${t("Gerätetyp")}</dt><dd>${type ? html`<a href=${`#/typ/${type.id}`}>${typeLabel(type)}</a>` : "—"}</dd></div>
            <div><dt>${t("Kategorie")}</dt><dd>${item.category || "—"}</dd></div>
            <div><dt>${t("Anzahl")}</dt><dd class="mono">${item.quantity || 1}</dd></div>
            <div><dt>${t("Seriennummer")}</dt><dd class="mono">${item.serial || "—"}</dd></div>
            <div><dt>${t("Erfasst")}</dt><dd>${fmtDate(item.created)}</dd></div>
          </dl>
          ${item.notes ? html`<div class="stack"><h2>${t("Notizen")}</h2><p class="notes">${item.notes}</p></div>` : null}
        </section>
        ${isDmx(item) ? html`<${DmxPanel} item=${item} />` : null}
        <${History} item=${item} />
      </div>

      <div class="col">
        ${item.photos?.length ? html`<div class="gallery">
          ${item.photos.map((p, n) => html`<a class=${n === 0 ? "lead" : ""} href=${fileUrl(item, p)} target="_blank" rel="noopener">
            <img src=${fileUrl(item, p, n === 0 ? "480x360" : "160x160")} alt=${t("Foto {n}", { n: n + 1 })} loading="lazy" /></a>`)}
        </div>` : html`<${Empty} title=${t("Keine Fotos")}>${t("Ein Foto hilft, das Teil im Lager wiederzufinden.")} <a href=${`#/i/${item.id}/bearbeiten`}>${t("Foto hinzufügen")}</a><//>`}

        ${type && (type.gdtf || type.manual?.length) ? html`<section class="panel">
          <h2>${t("Unterlagen")} · ${typeLabel(type)}</h2>
          <div class="files">
            ${type.gdtf ? html`<a class="file" href=${fileUrl(type, type.gdtf) + "?download=1"}><${Icon} name="download" /><span>${type.gdtf}</span><small>GDTF</small></a>` : null}
            ${(type.manual || []).map((m) => html`<a class="file" href=${fileUrl(type, m)} target="_blank" rel="noopener"><${Icon} name="file" /><span>${m}</span><small>${t("Anleitung")}</small></a>`)}
          </div>
        </section>` : null}
      </div>
    </div>
  </div>`
}

// ---------------------------------------------------------------- edit

// "PAR 3" → "PAR 4", "Kabel" → "Kabel"
const bumpName = (n) => n.replace(/(\d+)(\D*)$/, (_, d, rest) => String(Number(d) + 1).padStart(d.length, "0") + rest)

function blank(preset = {}) {
  return {
    name: "", category: "", type: "", quantity: 1, location: "", sublocation: "", condition: "ok", serial: "", notes: "",
    dmx_universe: 1, dmx_address: "", dmx_mode: "", ...preset,
  }
}

function fromItem(i) {
  return {
    name: i.name, category: i.category, type: i.type, quantity: i.quantity || 1, location: i.location, sublocation: i.sublocation,
    condition: i.condition || "ok", serial: i.serial, notes: i.notes,
    dmx_universe: i.dmx_universe || 1, dmx_address: i.dmx_address || "", dmx_mode: i.dmx_mode,
  }
}

function InlineCreate({ fields, onCreate, onCancel, before }) {
  const [v, , bind] = useForm({})
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try { await onCreate(v) } catch (err) { toast(errMsg(err), true) } finally { setBusy(false) }
  }
  return html`<div class="mode-ed">
    ${before}
    <div class="grid2">${fields.map(([k, label]) => html`<${Field} label=${label}><input id=${`ic-${k}`} ...${bind(k)} onKeyDown=${(e) => e.key === "Enter" && (e.preventDefault(), submit())} /><//>`)}</div>
    <div class="row"><button type="button" class="btn sm primary" disabled=${busy} onClick=${submit}>${t("Anlegen")}</button>
      <button type="button" class="btn sm ghost" onClick=${onCancel}>${t("Abbrechen")}</button></div>
  </div>`
}

export function ItemEdit({ id, copy, presetType, presetLoc }) {
  const s = useStore()
  const item = id ? s.items.find((i) => i.id === id) : null
  const src = copy ? s.items.find((i) => i.id === copy) : null
  const [v, setV, bind] = useForm(() =>
    item ? fromItem(item) : src ? { ...fromItem(src), name: bumpName(src.name), serial: "", dmx_address: "" } : blank({ type: presetType || "", location: presetLoc || "" }))
  const [newPhotos, setNewPhotos] = useState([])
  const [dropPhotos, setDropPhotos] = useState([])
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(null) // "type" | "location"
  const [readingGdtf, setReadingGdtf] = useState(false)

  if (id && !item) return html`<div class="wrap"><${Empty} title=${t("Teil nicht gefunden")} /></div>`

  const type = s.types.find((ty) => ty.id === v.type)
  const modes = modesOf(type)
  const fp = modes.find((m) => m.name === v.dmx_mode)?.footprint || (modes.length === 1 ? modes[0].footprint : 1)
  const showDmx = modes.length > 0 || v.dmx_mode || v.dmx_address
  const cats = [...new Set([...BASE_CATEGORIES, ...suggestions(s.items, "category")])].sort((a, b) => a.localeCompare(b, lang))
  const places = suggestions(s.items.filter((i) => !v.location || i.location === v.location), "sublocation")

  const pickType = (tid) => {
    const ty = s.types.find((x) => x.id === tid)
    const m = modesOf(ty)
    setV((x) => ({
      ...x, type: tid,
      dmx_mode: m.length === 1 ? m[0].name : m.some((mm) => mm.name === x.dmx_mode) ? x.dmx_mode : "",
      name: x.name || (ty ? ty.model : ""),
      category: x.category || (m.length ? BASE_CATEGORIES[0] : ""),
    }))
  }

  // a GDTF alone is enough: the server fills manufacturer, model, modes and image
  const typeFromGdtf = async ([file]) => {
    setReadingGdtf(true)
    try {
      const ty = await save("fixture_types", null, { gdtf: file })
      pickType(ty.id)
      setCreating(null)
      toast(t("Gerätetyp „{name}“ aus GDTF angelegt ({modes})", { name: typeLabel(ty), modes: tn(modesOf(ty).length, "{n} Mode", "{n} Modes") }))
    } catch (err) { toast(errMsg(err), true) } finally { setReadingGdtf(false) }
  }

  const submit = async (e, next = false) => {
    e?.preventDefault()
    if (!v.name.trim()) { toast(t("Bitte einen Namen eingeben."), true); return }
    setBusy(true)
    const data = {
      ...v, name: v.name.trim(), quantity: Number(v.quantity) || 1,
      dmx_universe: Number(v.dmx_address) ? Number(v.dmx_universe) || 1 : 0, dmx_address: Number(v.dmx_address) || 0,
    }
    if (newPhotos.length) data["photos+"] = newPhotos
    if (dropPhotos.length) data["photos-"] = dropPhotos
    try {
      const rec = await save("items", item?.id, data)
      if (next) {
        toast(t("{no} angelegt", { no: rec.inv_no }))
        setV((x) => ({ ...x, name: bumpName(x.name), serial: "", notes: "", dmx_address: x.dmx_address ? Math.min(512, Number(x.dmx_address) + fp) : "" }))
        setNewPhotos([])
        document.getElementById("e-name")?.focus()
      } else {
        toast(item ? t("Gespeichert") : t("{no} angelegt", { no: rec.inv_no }))
        go(`/i/${rec.id}`)
      }
    } catch (err) { toast(errMsg(err), true) } finally { setBusy(false) }
  }

  const cancel = () => (item ? go(`/i/${item.id}`) : history.length > 1 ? history.back() : go("/"))

  return html`<div class="wrap narrow">
    <${Head}
      crumb=${item ? [`#/i/${item.id}`, item.inv_no] : ["#/", t("Inventar")]}
      title=${html`<h1>${item ? t("Teil bearbeiten") : src ? t("Teil duplizieren") : t("Neues Teil")}</h1>`}
      sub=${item ? null : t("Die Inventarnummer wird beim Speichern automatisch vergeben.")} />

    <form class="form" onSubmit=${submit}>
      <section class="section">
        <h2>${t("Allgemein")}</h2>
        <div class="grid2">
          <${Field} label=${t("Gerätetyp")} hint=${modes.length ? tn(modes.length, "{n} DMX-Mode hinterlegt", "{n} DMX-Modes hinterlegt") : t("Optional. Für DMX-Geräte mit Modes und Kanälen.")}>
            <select id="e-type" value=${v.type} onChange=${(e) => (e.target.value === "+" ? setCreating("type") : pickType(e.target.value))}>
              <option value="">${t("Kein Typ")}</option>
              ${s.types.map((ty) => html`<option value=${ty.id}>${typeLabel(ty)}</option>`)}
              <option value="+">＋ ${t("Neuer Gerätetyp…")}</option>
            </select>
          <//>
          <${Field} label=${`${t("Name")} *`}><input id="e-name" required ...${bind("name")} placeholder=${t("z. B. PAR Bühne links")} /><//>
        </div>
        ${creating === "type" ? html`<${InlineCreate} fields=${[["manufacturer", t("Hersteller")], ["model", t("Modell")]]}
          before=${html`
            <${FileDrop} accept=".gdtf" onFiles=${typeFromGdtf}>
              <strong>${readingGdtf ? t("GDTF wird gelesen…") : t("GDTF-Datei wählen oder hierher ziehen")}</strong>
              <span>${t("Legt den Typ mit allen Modes und Kanälen an")}</span>
            <//>
            <span class="label">${t("Oder ohne GDTF, nur mit Namen:")}</span>`}
          onCancel=${() => setCreating(null)}
          onCreate=${async (d) => { const ty = await save("fixture_types", null, d); pickType(ty.id); setCreating(null); toast(t("Typ angelegt. GDTF und Modes kannst du später unter Gerätetypen ergänzen.")) }} />` : null}
        <div class="grid3">
          <${Field} label=${t("Kategorie")}><input id="e-cat" list="dl-cat" ...${bind("category")} /><//>
          <${Field} label=${t("Anzahl")} hint=${t("Für Kleinteile wie Kabel")}><input id="e-qty" type="number" min="1" inputmode="numeric" ...${bind("quantity", { number: true })} /><//>
          <${Field} label=${t("Seriennummer")}><input id="e-serial" ...${bind("serial")} /><//>
        </div>
        <datalist id="dl-cat">${cats.map((c) => html`<option value=${c} />`)}</datalist>
        <div class="field"><span>${t("Zustand")}</span>
          <div class="cond-pick" role="radiogroup" aria-label=${t("Zustand")}>
            ${Object.keys(CONDITIONS).map((k) => html`<label class=${`cp ${k}${v.condition === k ? " on" : ""}`}>
              <input type="radio" name="cond" value=${k} checked=${v.condition === k} onChange=${() => setV((x) => ({ ...x, condition: k }))} />
              <span class="cp-dot" aria-hidden="true"></span>${condLabel(k)}</label>`)}
          </div>
        </div>
      </section>

      <section class="section">
        <h2>${t("Lager")}</h2>
        <div class="grid2">
          <${Field} label=${t("Lagerort")}>
            <select id="e-loc" value=${v.location} onChange=${(e) => (e.target.value === "+" ? setCreating("location") : setV((x) => ({ ...x, location: e.target.value })))}>
              <option value="">${t("Kein Lagerort")}</option>
              ${s.locations.map((l) => html`<option value=${l.id}>${l.name}</option>`)}
              <option value="+">＋ ${t("Neuer Lagerort…")}</option>
            </select>
          <//>
          <${Field} label=${t("Platz")} hint=${t("Kiste, Regal, Case …")}><input id="e-place" list="dl-place" ...${bind("sublocation")} /><//>
          <datalist id="dl-place">${places.map((c) => html`<option value=${c} />`)}</datalist>
        </div>
        ${creating === "location" ? html`<${InlineCreate} fields=${[["name", t("Name, z. B. Keller Schmidt")], ["address", t("Adresse (optional)")]]}
          onCancel=${() => setCreating(null)}
          onCreate=${async (d) => { const l = await save("locations", null, d); setV((x) => ({ ...x, location: l.id })); setCreating(null) }} />` : null}
      </section>

      ${showDmx ? html`<section class="section">
        <h2>${t("DMX · zuletzt bekannt")}</h2>
        <div class="grid3">
          <${Field} label=${t("Universe")}><input id="e-u" type="number" min="1" max="999" inputmode="numeric" ...${bind("dmx_universe", { number: true })} /><//>
          <${Field} label=${t("Startadresse")} hint=${v.dmx_address ? t("belegt {a}–{b}", { a: pad3(v.dmx_address), b: pad3(Number(v.dmx_address) + fp - 1) }) : t("leer = unbekannt")}>
            <input id="e-a" type="number" min="1" max="512" inputmode="numeric" ...${bind("dmx_address", { number: true })} /><//>
          <${Field} label=${t("Mode")}>
            <select id="e-m" ...${bind("dmx_mode")}>
              <option value="">—</option>
              ${modes.map((m) => html`<option value=${m.name}>${m.name} (${t("{n} Kan.", { n: m.footprint })})</option>`)}
              ${v.dmx_mode && !modes.some((m) => m.name === v.dmx_mode) ? html`<option value=${v.dmx_mode}>${v.dmx_mode}</option>` : null}
            </select>
          <//>
        </div>
      </section>` : null}

      <section class="section">
        <h2>${t("Fotos")}</h2>
        ${item?.photos?.length ? html`<div class="gallery">
          ${item.photos.map((p) => {
            const gone = dropPhotos.includes(p)
            return html`<div style="position:relative">
              <img src=${fileUrl(item, p, "160x160")} alt="" style=${`aspect-ratio:1;object-fit:cover;border-radius:4px;${gone ? "opacity:.3" : ""}`} />
              <button type="button" class="btn sm icon" style="position:absolute;top:4px;right:4px" aria-label=${gone ? t("Behalten") : t("Entfernen")}
                onClick=${() => setDropPhotos(gone ? dropPhotos.filter((x) => x !== p) : [...dropPhotos, p])}><${Icon} name=${gone ? "back" : "x"} /></button>
            </div>`
          })}
        </div>` : null}
        ${newPhotos.length ? html`<div class="gallery">${newPhotos.map((file, n) => html`<div style="position:relative">
          <img src=${URL.createObjectURL(file)} alt="" style="aspect-ratio:1;object-fit:cover;border-radius:4px" />
          <button type="button" class="btn sm icon" style="position:absolute;top:4px;right:4px" aria-label=${t("Entfernen")}
            onClick=${() => setNewPhotos(newPhotos.filter((_, i) => i !== n))}><${Icon} name="x" /></button></div>`)}</div>` : null}
        <${FileDrop} accept="image/*" multiple onFiles=${(files) => setNewPhotos([...newPhotos, ...files])}>
          <strong>${t("Fotos hinzufügen")}</strong><span>${t("Antippen für Kamera oder Galerie, oder Dateien hierher ziehen")}</span>
        <//>
      </section>

      <section class="section">
        <${Field} label=${t("Notizen")}><textarea id="e-notes" ...${bind("notes")} placeholder=${t("Macken, Zubehör, Besonderheiten …")}></textarea><//>
      </section>

      <div class="form-foot">
        <button type="button" class="btn ghost" onClick=${cancel}>${t("Abbrechen")}</button>
        ${!item ? html`<button type="button" class="btn" disabled=${busy} onClick=${(e) => submit(e, true)} title=${t("Speichern und gleich das nächste gleiche Teil anlegen")}>${t("Speichern + nächstes")}</button>` : null}
        <button class="btn primary" disabled=${busy}><${Icon} name="check" />${t("Speichern")}</button>
      </div>
    </form>
  </div>`
}

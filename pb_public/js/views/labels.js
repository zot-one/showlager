import { html, useEffect, useLayoutEffect, useMemo, useRef, useState } from "../../vendor/preact-htm.mjs"
import { useStore, save, toast, errMsg, typeOf, locOf, go } from "../store.js"
import { Icon, Plate, Head } from "../ui.js"
import { t, tn } from "../i18n.js"
import {
  A4_W, A4_H, MM, FIELDS, fieldKey, SIZE_PRESETS, sheetHTML, fitText, elStyle, printItems, layoutSlots, paginate, pageHTML,
  currentTemplate, currentLogo, defaultTemplate, newElement, cloneElement, resizeTemplate,
} from "../labels.js"

const r2 = (v) => Math.round(v * 100) / 100
const fmt = (v) => String(r2(v)).replace(".", t(","))
// the server returns JSON objects with sorted keys, so compare independent of key order
const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x))

// scale an object of w×h mm into the container width (and optionally a max height in px)
function useFit(ref, w, h, maxH = Infinity) {
  const [cw, setCw] = useState(600)
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setCw(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return Math.min(cw / (w * MM), maxH / (h * MM))
}

function sheetInfo(tpl) {
  const { slots, cols, rows, areas } = layoutSlots(tpl)
  if (!slots.length) return { n: 0, text: t("Passt nicht auf den Bogen. Etikett verkleinern, Rand verringern oder A5-Trennung ausschalten.") }
  return { n: slots.length, text: t(areas > 1 ? "{n} pro A4-Bogen ({c} × {r} je A5-Hälfte)" : "{n} pro A4-Bogen ({c} × {r})", { n: slots.length, c: cols, r: rows }) }
}

// ------------------------------------------------------------------ print tab

function PrintTab({ ids }) {
  const s = useStore()
  // id → number of labels for that item; selected = has an entry
  const [counts, setCounts] = useState(() => Object.fromEntries(ids.filter((id) => s.items.some((i) => i.id === id)).map((id) => [id, 1])))
  const [q, setQ] = useState("")
  const [bulk, setBulk] = useState(2)
  const [start, setStart] = useState(0)
  const [cut, setCut] = useState(true)
  const [page, setPage] = useState(0)
  const box = useRef()
  const host = useRef()

  const tpl = currentTemplate()
  const logoUrl = currentLogo()
  const chosen = s.items.filter((i) => counts[i.id])
  const jobs = chosen.flatMap((i) => Array(counts[i.id]).fill(i))
  const qq = q.toLowerCase()
  const listed = useMemo(() => (qq
    ? s.items.filter((i) => `${i.inv_no} ${i.name} ${i.category} ${typeOf(i)?.model || ""} ${locOf(i)?.name || ""}`.toLowerCase().includes(qq))
    : s.items), [s.items, qq])
  const { pages, slots } = paginate(jobs, tpl, { start })
  const shown = pages.length ? pages : [Array(Math.min(start, Math.max(0, slots.length - 1))).fill(null)]
  const pg = Math.min(page, shown.length - 1)
  const scale = useFit(box, A4_W, A4_H, 900)
  const markup = pageHTML(shown[pg], slots, tpl, { cut, logoUrl, preview: true })
  useLayoutEffect(() => { fitText(host.current) }, [markup, scale])
  const info = sheetInfo(tpl)
  const total = jobs.length
  const clamp = (v) => Math.max(1, Math.min(99, Math.round(Number(v)) || 1))
  const toggle = (id) => setCounts((prev) => { const n = { ...prev }; if (n[id]) delete n[id]; else n[id] = 1; return n })
  const setCount = (id, v) => setCounts((prev) => ({ ...prev, [id]: clamp(v) }))
  const setAll = (fn) => setCounts((prev) => Object.fromEntries(Object.keys(prev).map((id) => [id, clamp(fn(id))])))
  const selectMany = (list) => setCounts((prev) => ({ ...Object.fromEntries(list.map((i) => [i.id, 1])), ...prev }))

  const onSlot = (e) => {
    if (pg !== 0) return
    const el = e.target.closest("[data-slot]")
    if (el) setStart(Number(el.dataset.slot))
  }

  return html`<div class="labels">
    <div class="col">
      <section class="stack">
        <div class="spread"><h2>${t("Teile · {n} ausgewählt", { n: chosen.length })}${total !== chosen.length ? ` · ${t("{n} Etiketten", { n: total })}` : ""}</h2>
          ${chosen.length ? html`<button class="btn sm ghost" onClick=${() => setCounts({})}>${t("Alle abwählen")}</button>` : null}</div>
        <input class="input" type="search" placeholder=${t("Teile suchen…")} value=${q} onInput=${(e) => setQ(e.target.value)} aria-label=${t("Teile suchen")} />
        <div class="picklist">
          ${listed.map((i) => html`<div key=${i.id} class=${`pick-row${counts[i.id] ? " on" : ""}`}>
            <label>
              <input type="checkbox" checked=${!!counts[i.id]} onChange=${() => toggle(i.id)} />
              <${Plate} no=${i.inv_no} /><span class="n">${i.name}${i.quantity > 1 ? html` <span class="faint mono">(${t("{n} Stück", { n: i.quantity })})</span>` : null}</span>
            </label>
            ${counts[i.id] ? html`<div class="stepper" title=${t("Anzahl Etiketten")}>
              <button type="button" aria-label=${t("Ein Etikett weniger für {no}", { no: i.inv_no })} disabled=${counts[i.id] <= 1} onClick=${() => setCount(i.id, counts[i.id] - 1)}>−</button>
              <input type="number" min="1" max="99" value=${counts[i.id]} aria-label=${t("Anzahl Etiketten für {no}", { no: i.inv_no })}
                onInput=${(e) => e.target.value !== "" && setCount(i.id, e.target.value)} onFocus=${(e) => e.target.select()} />
              <button type="button" aria-label=${t("Ein Etikett mehr für {no}", { no: i.inv_no })} onClick=${() => setCount(i.id, counts[i.id] + 1)}>+</button>
            </div>` : null}
          </div>`)}
          ${!listed.length ? html`<p class="muted" style="padding:12px">${t("Keine Treffer.")}</p>` : null}
        </div>
        ${qq && listed.length ? html`<button class="btn sm" style="justify-self:start" onClick=${() => selectMany(listed)}>${t("Alle {n} Treffer auswählen", { n: listed.length })}</button>` : null}
        ${chosen.length ? html`<div class="row" style="font-size:14px">
          <span class="muted">${t("Anzahl für alle:")}</span>
          <div class="stepper">
            <button type="button" aria-label=${t("Weniger")} disabled=${bulk <= 1} onClick=${() => setBulk(clamp(bulk - 1))}>−</button>
            <input type="number" min="1" max="99" value=${bulk} aria-label=${t("Anzahl für alle")} onInput=${(e) => e.target.value !== "" && setBulk(clamp(e.target.value))} onFocus=${(e) => e.target.select()} />
            <button type="button" aria-label=${t("Mehr")} onClick=${() => setBulk(clamp(bulk + 1))}>+</button>
          </div>
          <button class="btn sm" onClick=${() => setAll(() => bulk)}>${t("Übernehmen")}</button>
          ${chosen.some((i) => i.quantity > 1) ? html`<button class="btn sm ghost" title=${t("Für jedes Stück ein Etikett, z. B. 12 Kabel = 12 Etiketten")}
            onClick=${() => setAll((id) => s.items.find((i) => i.id === id)?.quantity || 1)}>${t("Stückzahl aus Inventar")}</button>` : null}
        </div>` : null}
      </section>

      <section class="panel">
        <h2>${t("Druck")}</h2>
        <p style="font-size:14px">${t("Etikett")} ${fmt(tpl.w)} × ${fmt(tpl.h)} mm · ${info.text}</p>
        <label class="field" style="max-width:220px"><span>${t("Start bei Position")}</span>
          <input type="number" min="1" max=${slots.length || 1} value=${start + 1} onInput=${(e) => setStart(Math.max(0, Math.min((slots.length || 1) - 1, (Number(e.target.value) || 1) - 1)))} /></label>
        <p class="muted" style="font-size:13px">${t("Angebrochener Bogen? In der Vorschau auf die erste freie Stelle klicken.")}</p>
        <label class="check"><input type="checkbox" checked=${cut} onChange=${(e) => setCut(e.target.checked)} />${t("Schnittlinien drucken")}</label>
        <button class="btn primary" disabled=${!total || !slots.length} onClick=${() => printItems(jobs, { start, cut })}>
          <${Icon} name="printer" />${total ? `${tn(total, "{n} Etikett drucken", "{n} Etiketten drucken")} (${tn(pages.length, "{n} Bogen", "{n} Bögen")})` : t("Teile auswählen")}</button>
        <p class="muted" style="font-size:13px">${t("Im Druckdialog Skalierung 100 % bzw. „Tatsächliche Größe“ und Ränder „Keine“ wählen.")}</p>
      </section>
    </div>

    <section class="stack">
      <div class="spread">
        <h2>${t("A4-Bogen")}${shown.length > 1 ? ` ${t("{a} von {b}", { a: pg + 1, b: shown.length })}` : ""}</h2>
        <div class="row">
          ${shown.length > 1 ? html`
            <button class="btn sm icon" aria-label=${t("Vorheriger Bogen")} disabled=${pg === 0} onClick=${() => setPage(pg - 1)}><${Icon} name="back" /></button>
            <button class="btn sm icon" aria-label=${t("Nächster Bogen")} style="transform:scaleX(-1)" disabled=${pg === shown.length - 1} onClick=${() => setPage(pg + 1)}><${Icon} name="back" /></button>` : null}
          <a class="btn sm" href="#/etiketten/vorlage"><${Icon} name="edit" />${t("Etikett gestalten")}</a>
        </div>
      </div>
      <div ref=${box} style="width:100%">
        <div class="lscale" style=${`width:${A4_W * MM * scale}px;height:${A4_H * MM * scale}px;margin:0 auto;cursor:${pg === 0 ? "pointer" : "default"}`} onClick=${onSlot}>
          <div class="lhost" ref=${host} style=${`transform:scale(${scale});width:${A4_W}mm;height:${A4_H}mm`} dangerouslySetInnerHTML=${{ __html: markup }}></div>
        </div>
      </div>
      <p class="muted" style="font-size:13px">${t("Schraffiert: schon verbrauchte Stellen. Die graue Linie in der Mitte ist die Trennung der beiden A5-Sticker.")}</p>
    </section>
  </div>`
}

// ------------------------------------------------------------------ designer

let draft = null // unsaved template survives switching tabs

const TYPE_LABEL = { text: "Text", qr: "QR-Code", line: "Linie", box: "Rahmen", image: "Logo" } // German source, shown via t()
const TYPE_ICON = { text: "text", qr: "grid", line: "line", box: "rect", image: "image" }
const HANDLES = { nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], sw: [0, 100], w: [0, 50] }
const snapStep = (v) => Math.round(v * 4) / 4

function Seg({ value, options, onChange, label }) {
  return html`<div class="seg" role="radiogroup" aria-label=${label}>
    ${options.map(([v, l]) => html`<label><input type="radio" checked=${value === v} onChange=${() => onChange(v)} /><span>${l}</span></label>`)}
  </div>`
}

function Num({ label, value, onChange, step = 0.25, min }) {
  return html`<label>${label}<input type="number" step=${step} min=${min} value=${r2(value)} onInput=${(e) => e.target.value !== "" && onChange(Number(e.target.value))} /></label>`
}

function Designer() {
  const s = useStore()
  const saved = currentTemplate()
  const [tpl, setTpl] = useState(() => draft || structuredClone(saved))
  const [selId, setSelId] = useState(null)
  const [sampleId, setSampleId] = useState(s.items[0]?.id || "")
  const [grid, setGrid] = useState(true)
  const [live, setLive] = useState(null)
  const [inline, setInline] = useState(null)
  const [scaleContent, setScaleContent] = useState(true)
  const [busy, setBusy] = useState(false)
  const hist = useRef({ past: [], future: [], key: null, at: 0 })
  const tplRef = useRef(tpl)
  const selIdRef = useRef(selId)
  const box = useRef()
  const host = useRef()
  const contentRef = useRef()
  const textRef = useRef()
  tplRef.current = tpl
  selIdRef.current = selId
  draft = tpl

  const W = tpl.w, H = tpl.h
  const scale = useFit(box, W, H, Math.max(320, innerHeight * 0.6))
  const sample = s.items.find((i) => i.id === sampleId) || null
  const logoUrl = currentLogo()
  const markup = sheetHTML(tpl, sample, { logoUrl, editing: true })
  const selEl = tpl.elements.find((e) => e.id === selId) || null
  const dirty = stable(tpl) !== stable(saved)
  const info = sheetInfo(tpl)

  useLayoutEffect(() => { fitText(contentRef.current) }, [markup, scale])
  useEffect(() => {
    const warn = (e) => { if (draft && stable(draft) !== stable(currentTemplate())) { e.preventDefault(); e.returnValue = "" } }
    addEventListener("beforeunload", warn)
    return () => removeEventListener("beforeunload", warn)
  }, [])

  // ---------- history; the ref is updated synchronously so several updates in one tick build on each other
  const apply = (next) => { tplRef.current = next; setTpl(next) }
  const commit = (next, key) => {
    const h = hist.current
    const now = Date.now()
    if (!(key && h.key === key && now - h.at < 1200)) { h.past.push(tplRef.current); if (h.past.length > 100) h.past.shift() }
    h.future = []
    h.key = key
    h.at = now
    apply(next)
  }
  const undo = () => { const h = hist.current; if (!h.past.length) return; h.future.push(tplRef.current); h.key = null; apply(h.past.pop()) }
  const redo = () => { const h = hist.current; if (!h.future.length) return; h.past.push(tplRef.current); h.key = null; apply(h.future.pop()) }

  const updateEl = (id, patch, key) => commit({ ...tplRef.current, elements: tplRef.current.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }, key ?? `${id}:${Object.keys(patch).join()}`)
  const addEl = (el) => { commit({ ...tplRef.current, elements: [...tplRef.current.elements, el] }); setSelId(el.id) }
  const removeEl = (id) => { commit({ ...tplRef.current, elements: tplRef.current.elements.filter((e) => e.id !== id) }); setSelId(null) }
  const reorder = (id, dir) => {
    const els = [...tplRef.current.elements]
    const i = els.findIndex((e) => e.id === id)
    const j = dir > 0 ? Math.min(els.length - 1, i + 1) : Math.max(0, i - 1)
    if (i === j) return
    els.splice(j, 0, els.splice(i, 1)[0])
    commit({ ...tplRef.current, elements: els })
  }
  const setSheet = (patch, key) => commit({ ...tplRef.current, ...patch }, key)
  const setSize = (w, h) => {
    if (!(w >= 10 && h >= 8 && w <= 200 && h <= 287)) return
    commit(resizeTemplate(tplRef.current, w, h, scaleContent), "size")
  }

  // ---------- pointer: move + resize with snapping
  const toMM = (cx, cy) => {
    const r = host.current.getBoundingClientRect()
    return [((cx - r.left) / r.width) * tplRef.current.w, ((cy - r.top) / r.height) * tplRef.current.h]
  }
  const snapLines = (exclude) => {
    const { w, h } = tplRef.current
    const xs = [0, w, w / 2, 2, w - 2]
    const ys = [0, h, h / 2, 2, h - 2]
    for (const e of tplRef.current.elements) {
      if (e.id === exclude) continue
      xs.push(e.x, e.x + e.w / 2, e.x + e.w)
      ys.push(e.y, e.y + e.h / 2, e.y + e.h)
    }
    return { xs, ys }
  }
  const nearest = (edges, cands, th) => {
    let best = null
    for (const v of edges) for (const c of cands) {
      const d = c - v
      if (Math.abs(d) <= th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: c }
    }
    return best
  }

  const startDrag = (e, el, handle) => {
    e.preventDefault()
    e.stopPropagation()
    setSelId(el.id)
    setInline(null)
    const [mx0, my0] = toMM(e.clientX, e.clientY)
    const orig = { ...el }
    const th = 6 / (MM * scale)
    const lines = snapLines(el.id)
    const h = hist.current
    let moved = false

    const move = (ev) => {
      const [mx, my] = toMM(ev.clientX, ev.clientY)
      const dx = mx - mx0, dy = my - my0
      if (!moved && Math.hypot(dx, dy) * MM * scale < 3) return
      if (!moved) { moved = true; h.past.push(tplRef.current); h.future = []; h.key = null }
      const free = ev.altKey
      const st = (v) => (free ? v : snapStep(v))
      const guides = []
      let { x, y, w, h: hh } = orig

      if (!handle) {
        x = st(orig.x + dx)
        y = st(orig.y + dy)
        if (!free) {
          const sx = nearest([x, x + w / 2, x + w], lines.xs, th)
          if (sx) { x += sx.d; guides.push({ v: sx.at }) }
          const sy = nearest([y, y + hh / 2, y + hh], lines.ys, th)
          if (sy) { y += sy.d; guides.push({ h: sy.at }) }
        }
      } else {
        const thin = orig.type === "line"
        const minW = thin && orig.w < orig.h ? 0.1 : 1
        const minH = thin && orig.h <= orig.w ? 0.1 : 1
        if (handle.includes("e")) {
          let r = st(orig.x + orig.w + dx)
          const sx = !free && nearest([r], lines.xs, th); if (sx) { r += sx.d; guides.push({ v: sx.at }) }
          w = Math.max(minW, r - x)
        }
        if (handle.includes("w")) {
          let l = st(orig.x + dx)
          const sx = !free && nearest([l], lines.xs, th); if (sx) { l += sx.d; guides.push({ v: sx.at }) }
          l = Math.min(l, orig.x + orig.w - minW)
          x = l; w = orig.x + orig.w - l
        }
        if (handle.includes("s")) {
          let b = st(orig.y + orig.h + dy)
          const sy = !free && nearest([b], lines.ys, th); if (sy) { b += sy.d; guides.push({ h: sy.at }) }
          hh = Math.max(minH, b - y)
        }
        if (handle.includes("n")) {
          let t = st(orig.y + dy)
          const sy = !free && nearest([t], lines.ys, th); if (sy) { t += sy.d; guides.push({ h: sy.at }) }
          t = Math.min(t, orig.y + orig.h - minH)
          y = t; hh = orig.y + orig.h - t
        }
        if (orig.type === "qr") {
          const side = handle.length === 1 ? (handle === "e" || handle === "w" ? w : hh) : Math.max(w, hh)
          if (handle.includes("w")) x = orig.x + orig.w - side
          if (handle.includes("n")) y = orig.y + orig.h - side
          w = hh = side
        }
      }
      const patch = { x: r2(x), y: r2(y), w: r2(w), h: r2(hh) }
      apply({ ...tplRef.current, elements: tplRef.current.elements.map((it) => (it.id === el.id ? { ...it, ...patch } : it)) })
      setLive({ guides, info: handle ? `${fmt(patch.w)} × ${fmt(patch.h)} mm` : `${fmt(patch.x)} / ${fmt(patch.y)} mm` })
    }
    const up = () => {
      removeEventListener("pointermove", move)
      removeEventListener("pointerup", up)
      setLive(null)
    }
    addEventListener("pointermove", move)
    addEventListener("pointerup", up)
  }

  const onSheetDown = (e) => {
    const target = e.target.closest("[data-id]")
    if (!target) { setSelId(null); setInline(null); return }
    const el = tplRef.current.elements.find((x) => x.id === target.dataset.id)
    if (el) startDrag(e, el, null)
  }
  const onSheetDbl = (e) => {
    const target = e.target.closest("[data-id]")
    const el = target && tplRef.current.elements.find((x) => x.id === target.dataset.id)
    if (el?.type === "text") { setSelId(el.id); setInline(el.id) }
  }

  // ---------- keyboard
  useEffect(() => {
    const key = (e) => {
      const t = e.target
      if (t.closest && t.closest("input, textarea, select, [contenteditable]")) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return }
      const el = tplRef.current.elements.find((x) => x.id === selIdRef.current)
      if (!el) return
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); addEl(cloneElement(el)); return }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeEl(el.id); return }
      if (e.key === "Escape") { setSelId(null); return }
      if (e.key === "Enter" && el.type === "text") { e.preventDefault(); setInline(el.id); return }
      const step = e.shiftKey ? 2 : 0.25
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
      if (d) { e.preventDefault(); updateEl(el.id, { x: r2(el.x + d[0]), y: r2(el.y + d[1]) }, `${el.id}:nudge`) }
    }
    addEventListener("keydown", key)
    return () => removeEventListener("keydown", key)
  }, [])

  // ---------- actions
  const doSave = async () => {
    if (!s.settings) { toast(t("Einstellungen fehlen auf dem Server."), true); return }
    if (!info.n) { toast(info.text, true); return }
    setBusy(true)
    try { await save("settings", s.settings.id, { label_template: tpl }); toast(t("Vorlage gespeichert")) } catch (err) { toast(errMsg(err), true) } finally { setBusy(false) }
  }
  const discard = () => { hist.current = { past: [], future: [], key: null, at: 0 }; apply(structuredClone(saved)); setSelId(null) }
  const uploadLogo = async (file) => {
    if (!file || !s.settings) return
    try {
      await save("settings", s.settings.id, { label_logo: file })
      if (!tplRef.current.elements.some((e) => e.type === "image")) addEl(newElement("image", tplRef.current))
      toast(t("Logo hochgeladen"))
    } catch (err) { toast(errMsg(err), true) }
  }
  const insertField = (key) => {
    if (!selEl || selEl.type !== "text") return
    const ta = textRef.current
    const a = ta ? ta.selectionStart : selEl.text.length
    const b = ta ? ta.selectionEnd : a
    updateEl(selEl.id, { text: selEl.text.slice(0, a) + `{${key}}` + selEl.text.slice(b) }, null)
    requestAnimationFrame(() => { if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = a + key.length + 2 } })
  }
  const add = (kind, key) => addEl(newElement(kind, tplRef.current, key))

  const inlineEl = inline && tpl.elements.find((e) => e.id === inline)
  const handlesFor = (el) => (el.type === "line" ? (el.w >= el.h ? ["w", "e"] : ["n", "s"]) : Object.keys(HANDLES))
  const preset = SIZE_PRESETS.find(([, pw, ph]) => pw === W && ph === H)

  return html`<div class="stack" style="gap:14px">
    <div class="ld-tools" role="toolbar" aria-label=${t("Werkzeuge")}>
      <button class="btn sm" onClick=${() => add("text")}><${Icon} name="text" />${t("Text")}</button>
      <select aria-label=${t("Feld hinzufügen")} style="max-width:130px" value="" onChange=${(e) => { if (e.target.value) add("field", e.target.value); e.target.value = "" }}>
        <option value="">+ ${t("Feld…")}</option>
        ${FIELDS.map((f) => html`<option value=${fieldKey(f)}>${t(f[2])}</option>`)}
      </select>
      <button class="btn sm" onClick=${() => add("qr")}><${Icon} name="grid" />QR</button>
      <button class="btn sm" onClick=${() => add("line")}><${Icon} name="line" />${t("Linie")}</button>
      <button class="btn sm" onClick=${() => add("box")}><${Icon} name="rect" />${t("Rahmen")}</button>
      <label class="btn sm"><${Icon} name="image" />Logo<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange=${(e) => { uploadLogo(e.target.files[0]); e.target.value = "" }} /></label>
      <span class="sep"></span>
      <button class="btn sm icon" title=${t("Rückgängig (⌘Z)")} aria-label=${t("Rückgängig")} disabled=${!hist.current.past.length} onClick=${undo}><${Icon} name="undo" /></button>
      <button class="btn sm icon" title=${t("Wiederholen (⇧⌘Z)")} aria-label=${t("Wiederholen")} disabled=${!hist.current.future.length} onClick=${redo}><${Icon} name="redo" /></button>
      <div class="row" style="margin-left:auto;gap:4px">
        <button class="btn sm ghost" onClick=${() => { commit(defaultTemplate()); setSelId(null) }}>${t("Standardvorlage")}</button>
        ${dirty ? html`<button class="btn sm ghost" onClick=${discard}>${t("Verwerfen")}</button>` : null}
        <button class="btn sm primary" disabled=${busy || !dirty} onClick=${doSave}><${Icon} name="check" />${dirty ? t("Speichern") : t("Gespeichert")}</button>
      </div>
    </div>

    <div class="ld">
      <div class="ld-board">
        <div class="spread" style="margin:-12px 0 14px">
          <label class="row" style="gap:8px;font-size:13px;color:var(--muted)">${t("Vorschau mit")}
            <select class="input" style="min-height:30px;width:auto;max-width:260px;font-size:13px;padding:2px 8px" value=${sampleId} onChange=${(e) => setSampleId(e.target.value)}>
              <option value="">${t("Beispieldaten")}</option>
              ${s.items.map((i) => html`<option value=${i.id}>${i.inv_no} · ${i.name}</option>`)}
            </select></label>
          <span class="row" style="gap:12px;font-size:13px;color:var(--muted)">
            <span class="mono">${fmt(W)} × ${fmt(H)} mm · ${Math.round(scale * 100)} %</span>
            <label class="check" style="font-size:13px;color:var(--muted)"><input type="checkbox" checked=${grid} onChange=${(e) => setGrid(e.target.checked)} />${t("Raster")}</label>
          </span>
        </div>
        <div ref=${box} style="width:100%">
          <div class="lscale ld-canvas" style=${`width:${W * MM * scale}px;height:${H * MM * scale}px;margin:0 auto`}>
            <div class="lhost" ref=${host} style=${`transform:scale(${scale});width:${W}mm;height:${H}mm;--s:${scale}`}
              onPointerDown=${onSheetDown} onDblClick=${onSheetDbl}>
              <div ref=${contentRef} dangerouslySetInnerHTML=${{ __html: markup }}></div>
              ${grid ? html`<div class="ld-grid" style=${`background-size:${W <= 100 ? 1 : 5}mm ${W <= 100 ? 1 : 5}mm`}></div><div class="ld-margin"></div>` : null}
              ${(live?.guides || []).map((g) => (g.v != null
                ? html`<div class="ld-guide v" style=${`left:${g.v}mm`}></div>`
                : html`<div class="ld-guide h" style=${`top:${g.h}mm`}></div>`))}
              ${selEl && !inlineEl ? html`<div class="ld-sel" style=${`left:${selEl.x}mm;top:${selEl.y}mm;width:${selEl.w}mm;height:${selEl.h}mm`}>
                ${handlesFor(selEl).map((k) => html`<i style=${`left:${HANDLES[k][0]}%;top:${HANDLES[k][1]}%;cursor:${k}-resize`}
                  onPointerDown=${(e) => startDrag(e, selEl, k)}></i>`)}
              </div>` : null}
              ${live && selEl ? html`<div class="ld-size" style=${`left:${selEl.x}mm;top:${selEl.y + selEl.h}mm`}>${live.info}</div>` : null}
              ${inlineEl ? html`<textarea class="ld-inline" ref=${(n) => n && document.activeElement !== n && (n.focus(), n.select())}
                style=${`${elStyle(inlineEl)}white-space:pre-wrap;line-height:1.15;`}
                value=${inlineEl.text} onPointerDown=${(e) => e.stopPropagation()}
                onInput=${(e) => updateEl(inlineEl.id, { text: e.target.value }, `${inlineEl.id}:text`)}
                onKeyDown=${(e) => { if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) { e.preventDefault(); setInline(null) } }}
                onBlur=${() => setInline(null)}></textarea>` : null}
            </div>
          </div>
        </div>
      </div>

      <aside class="ld-panel">
        ${selEl ? html`<${Props} el=${selEl} update=${(p, k) => updateEl(selEl.id, p, k)} textRef=${textRef} insertField=${insertField}
            onDup=${() => addEl(cloneElement(selEl))} onDel=${() => removeEl(selEl.id)} onUp=${() => reorder(selEl.id, 1)} onDown=${() => reorder(selEl.id, -1)}
            logoUrl=${logoUrl} uploadLogo=${uploadLogo} onDone=${() => setSelId(null)} />`
          : html`<section class="panel">
            <h3>${t("Etikett")}</h3>
            <label class="field"><span>${t("Größe")}</span>
              <select value=${preset ? `${W}x${H}` : ""} onChange=${(e) => { const [pw, ph] = e.target.value.split("x").map(Number); if (pw) setSize(pw, ph) }}>
                ${!preset ? html`<option value="">${t("Eigene Größe")}</option>` : null}
                ${SIZE_PRESETS.map(([n, pw, ph]) => html`<option value=${`${pw}x${ph}`}>${t(n)} · ${pw} × ${ph} mm</option>`)}
              </select></label>
            <div class="ld-xywh" style="grid-template-columns:1fr 1fr">
              <${Num} label=${t("Breite (mm)")} value=${W} step="1" min="10" onChange=${(v) => setSize(v, H)} />
              <${Num} label=${t("Höhe (mm)")} value=${H} step="1" min="8" onChange=${(v) => setSize(W, v)} />
            </div>
            <label class="check"><input type="checkbox" checked=${scaleContent} onChange=${(e) => setScaleContent(e.target.checked)} />${t("Inhalt beim Ändern der Größe mitskalieren")}</label>
          </section>
          <section class="panel">
            <h3>${t("Bogen")}</h3>
            <div class="ld-xywh" style="grid-template-columns:1fr 1fr">
              <${Num} label=${t("Abstand (mm)")} value=${tpl.gap ?? 3} step="0.5" min="0" onChange=${(v) => setSheet({ gap: Math.max(0, v) }, "gap")} />
              <${Num} label=${t("Rand (mm)")} value=${tpl.margin ?? 5} step="0.5" min="0" onChange=${(v) => setSheet({ margin: Math.max(0, v) }, "margin")} />
            </div>
            <label class="check"><input type="checkbox" checked=${tpl.splitA5 !== false} onChange=${(e) => setSheet({ splitA5: e.target.checked })} />${t("Nicht über die Trennung der A5-Sticker drucken")}</label>
            <p class=${info.n ? "hint" : "err"}>${info.text}</p>
          </section>
          <section class="panel">
            <p class="muted" style="font-size:13px">${t("Element anklicken zum Bearbeiten, ziehen zum Verschieben, an den Griffen ziehen für die Größe. Doppelklick auf Text bearbeitet ihn direkt.")}</p>
            <div class="stack" style="font-size:13px;color:var(--muted);gap:4px">
              <span><span class="kbd">←↑→↓</span> ${t("0,25 mm, mit")} <span class="kbd">⇧</span> 2 mm</span>
              <span><span class="kbd">⌘D</span> ${t("duplizieren")} · <span class="kbd">⌫</span> ${t("löschen")} · <span class="kbd">⌘Z</span> ${t("rückgängig")}</span>
              <span><span class="kbd">⌥</span> ${t("beim Ziehen: ohne Einrasten")}</span>
            </div>
          </section>`}
        <section class="panel">
          <h2>${t("Ebenen")}</h2>
          <div class="ld-layers">
            ${[...tpl.elements].reverse().map((el) => html`<button aria-current=${el.id === selId} onClick=${() => setSelId(el.id)}>
              <${Icon} name=${TYPE_ICON[el.type]} />${el.type === "text" ? el.text.split("\n")[0] || t("Text") : t(TYPE_LABEL[el.type])}</button>`)}
          </div>
        </section>
      </aside>
    </div>
  </div>`
}

function Props({ el, update, textRef, insertField, onDup, onDel, onUp, onDown, logoUrl, uploadLogo, onDone }) {
  const thin = el.type === "line"
  return html`<section class="panel">
    <div class="spread"><h3>${t(TYPE_LABEL[el.type])}</h3>
      <div class="row" style="gap:4px">
        <button class="btn sm icon" title=${t("Nach hinten")} aria-label=${t("Nach hinten")} onClick=${onDown}>↓</button>
        <button class="btn sm icon" title=${t("Nach vorne")} aria-label=${t("Nach vorne")} onClick=${onUp}>↑</button>
        <button class="btn sm icon" title=${t("Duplizieren (⌘D)")} aria-label=${t("Duplizieren")} onClick=${onDup}><${Icon} name="copy" /></button>
        <button class="btn sm icon danger" title=${t("Löschen")} aria-label=${t("Löschen")} onClick=${onDel}><${Icon} name="trash" /></button>
      </div>
    </div>
    <div class="ld-xywh">
      <${Num} label="X" value=${el.x} onChange=${(v) => update({ x: v })} />
      <${Num} label="Y" value=${el.y} onChange=${(v) => update({ y: v })} />
      <${Num} label=${t("Breite")} value=${el.w} min="0.1" onChange=${(v) => update(el.type === "qr" ? { w: v, h: v } : { w: v })} />
      <${Num} label=${t("Höhe")} value=${el.h} min="0.1" step=${thin ? 0.05 : 0.25} onChange=${(v) => update(el.type === "qr" ? { w: v, h: v } : { h: v })} />
    </div>

    ${el.type === "text" ? html`
      <label class="field"><span>${t("Inhalt")}</span>
        <textarea ref=${textRef} rows="2" value=${el.text} onInput=${(e) => update({ text: e.target.value }, `${el.id}:text`)}></textarea>
        <small>${t("Felder in geschweiften Klammern werden pro Teil ersetzt. Ist kein Feld befüllt, entfällt der Text.")}</small>
      </label>
      <div class="ld-fields">${FIELDS.map((f) => html`<button type="button" title=${t(f[2])} onClick=${() => insertField(fieldKey(f))}>${fieldKey(f)}</button>`)}</div>
      <div class="field"><span>${t("Schrift")}</span>
        <div class="row">
          <${Seg} label=${t("Schriftart")} value=${el.font} onChange=${(v) => update({ font: v })} options=${[["sans", "Sans"], ["mono", "Mono"]]} />
          <label class="row" style="gap:6px;font-size:13px;color:var(--muted)">
            <input class="input" type="number" min="3" max="200" step="0.5" style="width:76px;min-height:34px" value=${el.size}
              onInput=${(e) => e.target.value && update({ size: Number(e.target.value) })} />pt</label>
        </div>
      </div>
      <div class="field"><span>${t("Stärke")}</span>
        <${Seg} label=${t("Stärke")} value=${el.weight} onChange=${(v) => update({ weight: v })} options=${[[400, t("Normal")], [500, t("Mittel")], [600, t("Halbfett")], [700, t("Fett")]]} /></div>
      <div class="field"><span>${t("Ausrichtung")}</span>
        <div class="row">
          <${Seg} label=${t("Horizontal")} value=${el.align} onChange=${(v) => update({ align: v })} options=${[["left", t("Links")], ["center", t("Mitte")], ["right", t("Rechts")]]} />
          <${Seg} label=${t("Vertikal")} value=${el.valign || "top"} onChange=${(v) => update({ valign: v })} options=${[["top", t("Oben")], ["middle", t("Mitte")], ["bottom", t("Unten")]]} />
        </div>
      </div>
      <div class="field"><span>${t("Farbe")}</span>
        <${Seg} label=${t("Farbe")} value=${el.color || "#000000"} onChange=${(v) => update({ color: v })} options=${[["#000000", t("Schwarz")], ["#444444", t("Dunkelgrau")], ["#777777", t("Grau")]]} /></div>
      <div class="stack" style="gap:6px">
        <label class="check"><input type="checkbox" checked=${!!el.upper} onChange=${(e) => update({ upper: e.target.checked })} />${t("Großbuchstaben")}</label>
        <label class="check"><input type="checkbox" checked=${!!el.single} onChange=${(e) => update({ single: e.target.checked })} />${t("Einzeilig")}</label>
        <label class="check"><input type="checkbox" checked=${!!el.fit} onChange=${(e) => update({ fit: e.target.checked })} />${t("Bei langem Text automatisch verkleinern")}</label>
      </div>` : null}

    ${el.type === "line" || el.type === "box" ? html`
      ${el.type === "box" ? html`<div class="ld-xywh" style="grid-template-columns:1fr 1fr">
        <${Num} label=${t("Strichstärke (mm)")} value=${el.stroke ?? 0.3} step="0.05" min="0.05" onChange=${(v) => update({ stroke: v })} />
        <${Num} label=${t("Eckenradius (mm)")} value=${el.radius || 0} step="0.5" min="0" onChange=${(v) => update({ radius: v })} />
      </div>` : html`<p class="muted" style="font-size:13px">${t("Die kürzere Seite ist die Strichstärke.")}</p>`}
      <div class="field"><span>${t("Farbe")}</span>
        <${Seg} label=${t("Farbe")} value=${el.color || "#000000"} onChange=${(v) => update({ color: v })} options=${[["#000000", t("Schwarz")], ["#777777", t("Grau")], ["#bbbbbb", t("Hellgrau")]]} /></div>` : null}

    ${el.type === "qr" ? html`<p class=${el.w < 12 ? "err" : "muted"} style="font-size:13px">${t("Enthält den Link zum jeweiligen Teil.")}${el.w < 12 ? ` ${t("Unter etwa 12 mm wird das Scannen mit dem Handy unzuverlässig.")}` : ""}</p>` : null}

    ${el.type === "image" ? html`
      <p class="muted" style="font-size:13px">${logoUrl ? t("Das Logo gilt für alle Etiketten.") : t("Noch kein Logo hochgeladen.")}</p>
      <label class="btn sm" style="justify-self:start">${logoUrl ? t("Logo ersetzen") : t("Logo hochladen")}
        <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange=${(e) => { uploadLogo(e.target.files[0]); e.target.value = "" }} /></label>` : null}
    <button class="btn sm ghost" style="justify-self:start" onClick=${onDone}>${t("Fertig")}</button>
  </section>`
}

// ------------------------------------------------------------------ page

export function Labels({ ids, tab }) {
  return html`<div class=${`wrap${tab === "design" ? " wide" : ""}`}>
    <${Head} title=${html`<h1>${t("Etiketten")}</h1>`} sub=${t("Kleine Etiketten mit QR-Code, gekachelt auf A4-Sticker-Bögen zum Ausschneiden.")} />
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected=${tab !== "design"} onClick=${() => go(`/etiketten${ids.length ? `?ids=${ids.join(",")}` : ""}`)}>${t("Drucken")}</button>
      <button role="tab" aria-selected=${tab === "design"} onClick=${() => go("/etiketten/vorlage")}>${t("Etikett gestalten")}</button>
    </div>
    ${tab === "design" ? html`<${Designer} />` : html`<${PrintTab} ids=${ids} />`}
  </div>`
}

import { renderSVG } from "../vendor/uqr.mjs"
import { state, CONDITIONS, typeOf, locOf, modesOf, userName, pad3, fmtDate, fileUrl, org } from "./store.js"

// Small labels, tiled onto A4 sticker sheets (two A5 stickers per sheet) and cut out by hand.
// Geometry in mm, font sizes in pt.
export const A4_W = 210
export const A4_H = 297
export const MM = 96 / 25.4 // CSS px per mm

// Shared by app, designer, preview and print document.
export const LABEL_CSS = `
.lsheet { position: relative; overflow: hidden; background: #fff; color: #000; font-family: 'IBM Plex Sans', sans-serif; }
.lsheet .el { position: absolute; box-sizing: border-box; }
.lsheet .el-text { display: flex; flex-direction: column; overflow: hidden; line-height: 1.15; white-space: pre-wrap; overflow-wrap: anywhere; }
.lsheet .el-text > span { display: block; }
.lsheet .el-text.single { white-space: pre; overflow-wrap: normal; }
.lsheet .el-qr svg, .lsheet .el-image img { display: block; width: 100%; height: 100%; object-fit: contain; }
.a4 { position: relative; width: ${A4_W}mm; height: ${A4_H}mm; overflow: hidden; background: #fff; }
.a4 .slot { position: absolute; }
.a4 .slot.cut { outline: 0.15mm dashed #9a9a9a; }`

export const SIZE_PRESETS = [
  ["Kabel", 40, 15], ["Klein", 50, 25], ["Standard", 64, 32], ["Mittel", 80, 40], ["Groß", 100, 60], ["Case (A6)", 148, 105],
]

export const FIELDS = [
  ["Nr", "Inventarnummer"], ["Name", "Name"], ["Typ", "Hersteller + Modell"], ["Hersteller", "Hersteller"],
  ["Modell", "Modell"], ["Kategorie", "Kategorie"], ["Seriennummer", "Seriennummer"], ["Anzahl", "Anzahl"],
  ["Zustand", "Zustand"], ["Lagerort", "Lagerort"], ["Platz", "Platz"], ["Zuständig", "Zuständige Person"],
  ["Modes", "DMX-Modes"], ["DMX", "Letzte DMX-Adresse"], ["Leistung", "Leistung"], ["Gewicht", "Gewicht"],
  ["Notizen", "Notizen"], ["Verein", "Vereinsname"], ["Datum", "Druckdatum"], ["Link", "Link zum Teil"],
]

const SAMPLE = {
  Name: "Beispielteil", Typ: "Hersteller Modell", Hersteller: "Hersteller", Modell: "Modell",
  Kategorie: "Licht", Seriennummer: "SN-12345", Anzahl: "1", Zustand: "In Ordnung", Lagerort: "Keller", Platz: "Kiste 1",
  Zuständig: "", Modes: "8ch · 16ch", DMX: "1.001 · 8ch", Leistung: "", Gewicht: "", Notizen: "",
}

const id = () => Math.random().toString(36).slice(2, 9)
const T = (o) => ({ id: id(), type: "text", font: "sans", size: 8, weight: 400, align: "left", valign: "top", color: "#000000", ...o })

const DEFAULT_TEMPLATE = {
  v: 2, w: 64, h: 32, gap: 3, margin: 5, splitA5: true,
  elements: [
    T({ x: 3, y: 2.5, w: 39, h: 7, text: "{Nr}", size: 16, weight: 700, single: true, fit: true }),
    T({ x: 3, y: 10, w: 39, h: 8, text: "{Name}", size: 8.5, weight: 600, fit: true }),
    T({ x: 3, y: 18.5, w: 39, h: 3.5, text: "{Typ}", size: 6.5, color: "#444444", single: true, fit: true }),
    T({ x: 3, y: 22, w: 39, h: 3.5, text: "DMX {Modes}", size: 6, single: true, fit: true }),
    { id: id(), type: "qr", x: 44, y: 2.5, w: 17.5, h: 17.5 },
    { id: id(), type: "line", x: 3, y: 26.3, w: 58, h: 0.2, color: "#000000" },
    T({ x: 3, y: 27, w: 58, h: 3, text: "{Verein}", size: 5, weight: 500, upper: true, color: "#555555", single: true, fit: true }),
  ],
}
export const defaultTemplate = () => structuredClone(DEFAULT_TEMPLATE)

// new elements are sized relative to the label
export function newElement(kind, tpl, key) {
  const W = tpl.w, H = tpl.h
  const size = Math.max(5, Math.round(H * 0.25))
  const center = (w, h) => ({ x: r2((W - w) / 2), y: r2((H - h) / 2) })
  switch (kind) {
    case "text": case "field": {
      const w = r2(W * 0.5), h = r2(Math.max(3, size * 0.5))
      return T({ ...center(w, h), w, h, size, text: kind === "field" ? `{${key}}` : "Text", fit: true })
    }
    case "qr": { const s = r2(Math.min(H * 0.6, W * 0.4)); return { id: id(), type: "qr", ...center(s, s), w: s, h: s } }
    case "line": { const w = r2(W * 0.8); return { id: id(), type: "line", ...center(w, 0.25), w, h: 0.25, color: "#000000" } }
    case "box": { const w = r2(W * 0.6), h = r2(H * 0.6); return { id: id(), type: "box", ...center(w, h), w, h, stroke: 0.3, radius: 0, color: "#000000" } }
    case "image": { const w = r2(W * 0.3), h = r2(H * 0.25); return { id: id(), type: "image", ...center(w, h), w, h } }
  }
}
export const cloneElement = (el) => ({ ...el, id: id(), x: r2(el.x + 1), y: r2(el.y + 1) })
const r2 = (v) => Math.round(v * 100) / 100

// resize the label; optionally scale the content with it
export function resizeTemplate(tpl, w, h, scaleContent) {
  if (!scaleContent) return { ...tpl, w, h }
  const fx = w / tpl.w, fy = h / tpl.h, f = Math.min(fx, fy)
  return {
    ...tpl, w, h,
    elements: tpl.elements.map((e) => {
      const n = { ...e, x: r2(e.x * fx), y: r2(e.y * fy), w: r2(e.w * fx), h: r2(e.h * fy) }
      if (e.type === "text") n.size = Math.max(3, Math.round(e.size * f * 2) / 2)
      if (e.type === "qr") { const s = r2(Math.min(n.w, n.h)); n.w = n.h = s }
      if (e.type === "line") { if (e.w >= e.h) n.h = e.h; else n.w = e.w }
      return n
    }),
  }
}

export const itemUrl = (item) => `${location.origin}/#/i/${item?.id || "beispiel"}`

export function fieldValues(item) {
  if (!item) return { ...SAMPLE, Nr: `${org().prefix}-0000`, Verein: org().name, Datum: fmtDate(new Date().toISOString()), Link: itemUrl(null) }
  const t = typeOf(item)
  const l = locOf(item)
  return {
    Nr: item.inv_no, Name: item.name, Typ: t ? `${t.manufacturer} ${t.model}` : "",
    Hersteller: t?.manufacturer || "", Modell: t?.model || "", Kategorie: item.category || "",
    Seriennummer: item.serial || "", Anzahl: String(item.quantity || 1), Zustand: CONDITIONS[item.condition] || "",
    Lagerort: l?.name || "", Platz: item.sublocation || "", Zuständig: l?.keeper ? userName(l.keeper) : "",
    Modes: modesOf(t).map((m) => (String(m.name).includes(String(m.footprint)) ? m.name : `${m.name} (${m.footprint} Kan.)`)).join(" · "),
    DMX: item.dmx_address > 0 ? `${item.dmx_universe}.${pad3(item.dmx_address)}${item.dmx_mode ? ` · ${item.dmx_mode}` : ""}` : "",
    Leistung: t?.power_w ? `${t.power_w} W` : "", Gewicht: t?.weight_kg ? `${String(t.weight_kg).replace(".", ",")} kg` : "",
    Notizen: item.notes || "", Verein: org().name, Datum: fmtDate(new Date().toISOString()), Link: itemUrl(item),
  }
}

// Replaces {Feld}. Returns null when the text uses fields and all of them are empty ("DMX {Modes}" on a cable).
export function fillText(text, vals) {
  let fields = 0, filled = 0
  const out = String(text ?? "").replace(/\{([^{}\n]+)\}/g, (m, k) => {
    if (!(k in vals)) return m
    fields++
    if (vals[k]) filled++
    return vals[k] || ""
  })
  return fields > 0 && filled === 0 ? null : out
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const qrCache = new Map()
function qrSvg(url) {
  if (!qrCache.has(url)) qrCache.set(url, renderSVG(url, { border: 0, ecc: "M" }).replace("<svg ", '<svg shape-rendering="crispEdges" '))
  return qrCache.get(url)
}

export function elStyle(el) {
  let s = `left:${el.x}mm;top:${el.y}mm;width:${el.w}mm;height:${el.h}mm;`
  if (el.type === "text") {
    s += `font-family:${el.font === "mono" ? "'IBM Plex Mono',monospace" : "'IBM Plex Sans',sans-serif"};font-size:${el.size}pt;font-weight:${el.weight};`
    s += `text-align:${el.align};color:${el.color || "#000"};justify-content:${{ top: "flex-start", middle: "center", bottom: "flex-end" }[el.valign || "top"]};`
    if (el.upper) s += "text-transform:uppercase;letter-spacing:0.06em;"
  } else if (el.type === "line") {
    s += `background:${el.color || "#000"};`
  } else if (el.type === "box") {
    s += `border:${el.stroke ?? 0.3}mm solid ${el.color || "#000"};border-radius:${el.radius || 0}mm;`
  }
  return s
}

function elHTML(el, vals, item, logoUrl, editing) {
  const attrs = `data-id="${el.id}" style="${elStyle(el)}"`
  switch (el.type) {
    case "text": {
      const t = fillText(el.text, vals)
      if (t === null && !editing) return ""
      const cls = `el el-text${el.single ? " single" : ""}`
      const fit = el.fit ? ` data-fit data-size="${el.size}"` : ""
      return `<div class="${cls}"${fit} ${attrs}><span${t === null ? ' style="opacity:.3"' : ""}>${esc(t ?? el.text)}</span></div>`
    }
    case "qr": return `<div class="el el-qr" ${attrs}>${qrSvg(itemUrl(item))}</div>`
    case "line": return `<div class="el el-line" ${attrs}></div>`
    case "box": return `<div class="el el-box" ${attrs}></div>`
    case "image": return logoUrl
      ? `<div class="el el-image" ${attrs}><img src="${esc(logoUrl)}" alt=""></div>`
      : `<div class="el el-image" ${attrs}>${editing ? '<div style="width:100%;height:100%;border:0.2mm dashed #999;display:grid;place-items:center;font:5pt sans-serif;color:#777">Logo</div>' : ""}</div>`
    default: return ""
  }
}

export function sheetHTML(tpl, item, { logoUrl = currentLogo(), editing = false } = {}) {
  const vals = fieldValues(item)
  return `<div class="lsheet" style="width:${tpl.w}mm;height:${tpl.h}mm">${(tpl.elements || []).map((el) => elHTML(el, vals, item, logoUrl, editing)).join("")}</div>`
}

// shrink "fit" text until it fits its box
export function fitText(root) {
  root.querySelectorAll(".el-text[data-fit]").forEach((el) => {
    let s = parseFloat(el.dataset.size)
    el.style.fontSize = `${s}pt`
    let guard = 200
    while (guard-- > 0 && s > 3 && (el.scrollHeight > el.clientHeight + 0.5 || el.scrollWidth > el.clientWidth + 0.5)) {
      s -= 0.25
      el.style.fontSize = `${s}pt`
    }
  })
}

// Positions of all labels on one A4 sheet. With splitA5 no label crosses the cut between the two A5 stickers.
export function layoutSlots(tpl) {
  const { w, h } = tpl
  const gap = tpl.gap ?? 3
  const margin = tpl.margin ?? 5
  const areas = tpl.splitA5 !== false ? [[0, 0, A4_W, A4_H / 2], [0, A4_H / 2, A4_W, A4_H / 2]] : [[0, 0, A4_W, A4_H]]
  const slots = []
  let cols = 0, rows = 0
  for (const [ax, ay, aw, ah] of areas) {
    cols = Math.max(0, Math.floor((aw - 2 * margin + gap) / (w + gap)))
    rows = Math.max(0, Math.floor((ah - 2 * margin + gap) / (h + gap)))
    const gw = cols * w + (cols - 1) * gap
    const gh = rows * h + (rows - 1) * gap
    const ox = ax + (aw - gw) / 2
    const oy = ay + (ah - gh) / 2
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) slots.push({ x: r2(ox + c * (w + gap)), y: r2(oy + r * (h + gap)) })
  }
  return { slots, cols, rows, areas: areas.length }
}

// Print jobs → pages. `start` skips already used positions on the first sheet.
export function paginate(items, tpl, { copies = 1, start = 0 } = {}) {
  const { slots } = layoutSlots(tpl)
  if (!slots.length) return { pages: [], slots }
  const jobs = []
  for (let i = 0; i < Math.min(start, slots.length - 1); i++) jobs.push(null)
  for (const it of items) for (let c = 0; c < copies; c++) jobs.push(it)
  const pages = []
  for (let i = 0; i < jobs.length; i += slots.length) pages.push(jobs.slice(i, i + slots.length))
  return { pages, slots }
}

export function pageHTML(jobs, slots, tpl, { cut = true, logoUrl = currentLogo(), preview = false } = {}) {
  let out = `<div class="a4">`
  if (preview && tpl.splitA5 !== false) out += `<div style="position:absolute;left:0;right:0;top:${A4_H / 2}mm;border-top:0.4mm solid #c7cbd2"></div>`
  slots.forEach((s, i) => {
    const it = jobs[i]
    const style = `left:${s.x}mm;top:${s.y}mm;width:${tpl.w}mm;height:${tpl.h}mm`
    if (it) out += `<div class="slot${cut ? " cut" : ""}" data-slot="${i}" style="${style}">${sheetHTML(tpl, it, { logoUrl })}</div>`
    else if (preview) out += `<div class="slot free" data-slot="${i}" style="${style};outline:0.2mm dashed #c7cbd2${i < jobs.length ? ";background:repeating-linear-gradient(-45deg,#f1f2f4 0 1.5mm,#e3e5e9 1.5mm 3mm)" : ""}"></div>`
  })
  return out + `</div>`
}

export function currentTemplate() {
  const t = state.settings?.label_template
  return t && Array.isArray(t.elements) && t.w > 0 && t.h > 0 ? t : defaultTemplate()
}
export function currentLogo() {
  const s = state.settings
  return s?.label_logo ? fileUrl(s, s.label_logo) : ""
}

function fontFaces() {
  const o = location.origin
  return `
@font-face { font-family: 'IBM Plex Sans'; src: url(${o}/fonts/plex-sans.woff2) format('woff2'); font-weight: 100 700; }
@font-face { font-family: 'IBM Plex Mono'; src: url(${o}/fonts/plex-mono-400.woff2) format('woff2'); font-weight: 400; }
@font-face { font-family: 'IBM Plex Mono'; src: url(${o}/fonts/plex-mono-500.woff2) format('woff2'); font-weight: 500; }
@font-face { font-family: 'IBM Plex Mono'; src: url(${o}/fonts/plex-mono-600.woff2) format('woff2'); font-weight: 600; }`
}

export function printDoc(items, opts = {}, tpl = currentTemplate(), logoUrl = currentLogo()) {
  const { pages, slots } = paginate(items, tpl, opts)
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Etiketten</title><style>${fontFaces()}
@page { size: A4 portrait; margin: 0; }
html, body { margin: 0; padding: 0; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.a4 { break-after: page; }
.a4:last-child { break-after: auto; }
@media screen { body { background: #777; } .a4 { margin: 8mm auto; } }
${LABEL_CSS}</style></head><body>
${pages.map((jobs) => pageHTML(jobs, slots, tpl, { cut: opts.cut !== false, logoUrl })).join("\n")}
</body></html>`
}

export function printItems(items, opts, tpl, logoUrl) {
  const frame = document.createElement("iframe")
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"
  frame.srcdoc = printDoc(items, opts, tpl, logoUrl)
  frame.onload = async () => {
    const w = frame.contentWindow
    try { await w.document.fonts.ready } catch {}
    await Promise.all([...w.document.images].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r }))))
    fitText(w.document)
    w.focus()
    w.print()
    setTimeout(() => frame.remove(), 60000)
  }
  document.body.appendChild(frame)
}

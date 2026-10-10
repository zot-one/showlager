import { html, useEffect, useMemo, useRef, useState } from "../../vendor/preact-htm.mjs"
import { state, emit, useStore, save, toast, errMsg, typeOf, modeOf, modesOf, isDmx, tapeOf, pad3 } from "../store.js"
import { Icon, Plate, Swatch, Head } from "../ui.js"
import { t, tn } from "../i18n.js"

const fpOf = (item) => modeOf(item)?.footprint || 1

function useCols() {
  const mq = useMemo(() => matchMedia("(max-width: 860px)"), [])
  const [cols, setCols] = useState(mq.matches ? 16 : 32)
  useEffect(() => {
    const f = () => setCols(mq.matches ? 16 : 32)
    mq.addEventListener("change", f)
    return () => mq.removeEventListener("change", f)
  }, [])
  return cols
}

// Fixtures sharing start + footprint are a deliberate group (e.g. two PARs on one address), not a conflict.
function buildGroups(items) {
  const map = new Map()
  for (const it of items) {
    const fp = fpOf(it)
    const key = `${it.dmx_address}:${fp}`
    if (!map.has(key)) map.set(key, { key, start: it.dmx_address, fp, items: [] })
    map.get(key).items.push(it)
  }
  const groups = [...map.values()].sort((a, b) => a.start - b.start)
  const occ = new Array(514).fill(0)
  groups.forEach((g) => { for (let c = g.start; c <= Math.min(512, g.start + g.fp - 1); c++) occ[c]++ })
  groups.forEach((g) => {
    g.end = Math.min(512, g.start + g.fp - 1)
    g.conflict = g.start + g.fp - 1 > 512 || occ.slice(g.start, g.end + 1).some((n) => n > 1)
  })
  // channel runs used by more than one group: drawn as hatched overlay
  const overlaps = []
  for (let c = 1; c <= 512; c++) {
    if (occ[c] < 2) continue
    const last = overlaps[overlaps.length - 1]
    if (last && last.end === c - 1) last.end = c
    else overlaps.push({ start: c, end: c })
  }
  // which groups collide, for the list next to the grid
  const pairs = []
  for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
    const a = groups[i], b = groups[j]
    const from = Math.max(a.start, b.start), to = Math.min(a.end, b.end)
    if (from <= to) pairs.push({ a, b, from, to })
  }
  return { groups, occ, overlaps, pairs }
}

function segments(g, cols) {
  const out = []
  let ch = g.start
  while (ch <= g.end) {
    const row = Math.floor((ch - 1) / cols)
    const rowEnd = Math.min(g.end, (row + 1) * cols)
    out.push({ row: row + 1, col: ((ch - 1) % cols) + 1, span: rowEnd - ch + 1, first: ch === g.start, last: rowEnd === g.end })
    ch = rowEnd + 1
  }
  return out
}

async function patchItems(ids, data, msg) {
  const before = state.items.filter((i) => ids.includes(i.id)).map((i) => ({ ...i }))
  state.items = state.items.map((i) => (ids.includes(i.id) ? { ...i, ...data } : i)) // optimistic
  emit()
  try {
    await Promise.all(ids.map((id) => save("items", id, data)))
    if (msg) toast(msg)
  } catch (err) {
    state.items = state.items.map((i) => before.find((b) => b.id === i.id) || i)
    emit()
    toast(errMsg(err), true)
  }
}

function Pop({ pop, universe, onClose }) {
  const ref = useRef()
  const items = pop.ids.map((id) => state.items.find((i) => i.id === id)).filter(Boolean)
  const [addr, setAddr] = useState(items[0]?.dmx_address || "")

  useEffect(() => {
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    const esc = (e) => e.key === "Escape" && onClose()
    setTimeout(() => addEventListener("pointerdown", away), 0)
    addEventListener("keydown", esc)
    ref.current?.querySelector("input,select,button")?.focus()
    return () => { removeEventListener("pointerdown", away); removeEventListener("keydown", esc) }
  }, [])

  if (!items.length) return null
  const w = Math.min(320, innerWidth - 32)
  const left = Math.max(16, Math.min(pop.x - w / 2, innerWidth - w - 16))
  const top = pop.y + 300 > innerHeight ? Math.max(16, pop.y - 310) : pop.y + 14
  const ids = items.map((i) => i.id)

  const move = (e) => {
    e.preventDefault()
    const a = Number(addr)
    if (!(a >= 1 && a <= 512)) { toast(t("Adresse muss zwischen 1 und 512 liegen."), true); return }
    patchItems(ids, { dmx_universe: universe, dmx_address: a }, `Auf ${universe}.${pad3(a)} gesetzt`)
    onClose()
  }

  return html`<div class="pop" ref=${ref} style=${`left:${left}px;top:${top}px`} role="dialog" aria-label=${t("Gerät im Patch")}>
    ${items.map((it) => {
      const modes = modesOf(typeOf(it))
      return html`<div class="member">
        <div class="spread"><${Plate} no=${it.inv_no} /><a class="btn sm ghost" href=${`#/i/${it.id}`}>${t("Öffnen")}</a></div>
        <div><b>${it.name}</b>${typeOf(it) ? html`<div class="muted" style="font-size:13px">${typeOf(it).manufacturer} ${typeOf(it).model}</div>` : null}</div>
        ${modes.length ? html`<label class="field"><span>${t("Mode")}</span>
          <select value=${it.dmx_mode} onChange=${(e) => patchItems([it.id], { dmx_mode: e.target.value }, t("Mode gespeichert"))}>
            ${!modes.some((m) => m.name === it.dmx_mode) ? html`<option value=${it.dmx_mode}>${it.dmx_mode || t("— wählen —")}</option>` : null}
            ${modes.map((m) => html`<option value=${m.name}>${m.name} (${t("{n} Kan.", { n: m.footprint })})</option>`)}
          </select></label>` : html`<p class="muted" style="font-size:13px">${t("Kein Gerätetyp mit Modes, belegt 1 Kanal.")}</p>`}
        ${items.length > 1 ? html`<button class="btn sm" onClick=${() => { patchItems([it.id], { dmx_address: 0, dmx_universe: 0 }, t("{no} entpatcht", { no: it.inv_no })); onClose() }}>${t("Nur dieses entpatchen")}</button>` : null}
      </div>`
    })}
    <form class="row" onSubmit=${move} style="border-top:1px solid var(--line);padding-top:12px">
      <label class="field" style="flex:1"><span>${t("Startadresse in Universe {u}", { u: universe })}</span>
        <input type="number" min="1" max="512" inputmode="numeric" value=${addr} onInput=${(e) => setAddr(e.target.value)} /></label>
      <button class="btn primary" style="align-self:end">${t("Setzen")}</button>
    </form>
    <button class="btn danger" onClick=${() => { patchItems(ids, { dmx_address: 0, dmx_universe: 0 }, t("Entpatcht")); onClose() }}>
      ${items.length > 1 ? t("Alle {n} entpatchen", { n: items.length }) : t("Entpatchen")}</button>
  </div>`
}

export function Patch({ universe: uParam, focus }) {
  const s = useStore()
  const cols = useCols()
  const gridRef = useRef()
  const poolRef = useRef()
  const used = [...new Set(s.items.filter((i) => i.dmx_address > 0).map((i) => i.dmx_universe || 1))].sort((a, b) => a - b)
  const [extra, setExtra] = useState([])
  const [u, setU] = useState(uParam || used[0] || 1)
  const universes = [...new Set([1, ...used, ...extra, u])].sort((a, b) => a - b)
  const [armed, setArmed] = useState(null)
  const [hover, setHover] = useState(null)
  const [pop, setPop] = useState(null)
  const [drag, setDrag] = useState(null)
  const [selected, setSelected] = useState(focus || null)
  const [q, setQ] = useState("")

  const here = s.items.filter((i) => i.dmx_address > 0 && (i.dmx_universe || 1) === u)
  // while dragging, the fixture itself moves through the grid: placed where it would land, gone when over the pool
  const view = useMemo(() => {
    if (!drag) return here
    const moving = new Set(drag.ids)
    const rest = here.filter((i) => !moving.has(i.id))
    if (drag.overPool) return rest
    if (drag.start >= 1 && drag.start <= 512) {
      return [...rest, ...s.items.filter((i) => moving.has(i.id)).map((i) => ({ ...i, dmx_universe: u, dmx_address: drag.start }))]
    }
    return drag.from === "grid" ? here : rest
  }, [s.items, s.types, u, drag?.ids, drag?.start, drag?.overPool])
  const { groups, occ, overlaps, pairs } = useMemo(() => buildGroups(view), [view])
  const pool = s.items.filter((i) => isDmx(i) && !(i.dmx_address > 0))
  const qq = q.toLowerCase()
  const poolShown = qq ? pool.filter((i) => `${i.inv_no} ${i.name} ${typeOf(i)?.model || ""}`.toLowerCase().includes(qq)) : pool
  const usedCh = occ.slice(1, 513).filter((n) => n > 0).length
  // overlapping pairs plus fixtures running past channel 512, same as the list next to the grid
  const conflicts = pairs.length + groups.filter((g) => g.start + g.fp - 1 > 512).length

  useEffect(() => {
    if (focus) document.querySelector(`[data-ids*="${focus}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [])

  const chAt = (x, y) => {
    const r = gridRef.current?.getBoundingClientRect()
    if (!r || x < r.left || x > r.right || y < r.top || y > r.bottom) return null
    const rows = 512 / cols
    const col = Math.min(cols - 1, Math.max(0, Math.floor(((x - r.left) / r.width) * cols)))
    const row = Math.min(rows - 1, Math.max(0, Math.floor(((y - r.top) / r.height) * rows)))
    return row * cols + col + 1
  }
  const inPool = (x, y) => {
    const r = poolRef.current?.getBoundingClientRect()
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
  }
  const fits = (start, fp, ids) => {
    if (start < 1 || start + fp - 1 > 512) return { valid: false, clash: false }
    const others = here.filter((i) => !ids.includes(i.id))
    const clash = others.some((o) => {
      const ofp = fpOf(o)
      const same = o.dmx_address === start && ofp === fp
      return !same && o.dmx_address <= start + fp - 1 && o.dmx_address + ofp - 1 >= start
    })
    return { valid: true, clash }
  }

  // pointer-driven drag: works for mouse, pen and touch alike
  const startDrag = (e, d) => {
    if (e.button > 0) return
    e.preventDefault()
    const x0 = e.clientX, y0 = e.clientY
    let cur = null
    let scrollV = 0
    const timer = setInterval(() => scrollV && scrollBy(0, scrollV), 16)
    const moveH = (ev) => {
      if (!cur && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return
      const ch = chAt(ev.clientX, ev.clientY)
      const start = ch ? ch - d.grab : null
      const f = start ? fits(start, d.fp, d.ids) : { valid: false, clash: false }
      cur = { ...d, x: ev.clientX, y: ev.clientY, start, ...f, overPool: d.from === "grid" && inPool(ev.clientX, ev.clientY) }
      scrollV = ev.clientY < 70 ? -14 : ev.clientY > innerHeight - 90 ? 14 : 0
      setDrag(cur)
    }
    const end = (ev, cancelled) => {
      removeEventListener("pointermove", moveH)
      removeEventListener("pointerup", upH)
      removeEventListener("pointercancel", cancelH)
      clearInterval(timer)
      setDrag(null)
      if (cancelled) return
      if (!cur) { d.onClick?.(ev); return }
      if (cur.overPool) patchItems(d.ids, { dmx_address: 0, dmx_universe: 0 }, t("Entpatcht"))
      else if (cur.start && cur.valid) place(d.ids, cur.start)
    }
    const upH = (ev) => end(ev, false)
    const cancelH = (ev) => end(ev, true)
    addEventListener("pointermove", moveH)
    addEventListener("pointerup", upH)
    addEventListener("pointercancel", cancelH)
  }

  const place = (ids, start) => {
    const items = ids.map((id) => state.items.find((i) => i.id === id))
    patchItems(ids, { dmx_universe: u, dmx_address: start }, `${items.length > 1 ? t("{n} Geräte", { n: items.length }) : items[0].inv_no} → ${u}.${pad3(start)}`)
    setArmed(null)
    setSelected(ids[0])
    // pick a mode right away when the type has several and none is set
    const unclear = items.find((i) => !modeOf(i) && modesOf(typeOf(i)).length > 1)
    if (unclear) {
      const r = gridRef.current.getBoundingClientRect()
      const row = Math.floor((start - 1) / cols), col = (start - 1) % cols
      setPop({ ids: [unclear.id], x: r.left + ((col + 0.5) * r.width) / cols, y: r.top + ((row + 1) * r.height) / (512 / cols) })
    }
  }

  const armedItem = armed && s.items.find((i) => i.id === armed)
  let hl = null
  if (armedItem && hover && !drag) {
    const fp = fpOf(armedItem)
    const f = fits(hover, fp, [armed])
    hl = { from: hover, to: hover + fp - 1, bad: !f.valid || f.clash }
  }
  const movingIds = drag && !drag.overPool && drag.start >= 1 && drag.start <= 512 ? drag.ids : []

  const cells = []
  for (let ch = 1; ch <= 512; ch++) {
    const cls = `pcell${ch % 8 === 1 ? " dec" : ""}${hl && ch >= hl.from && ch <= hl.to ? ` hl${hl.bad ? " bad" : ""}` : ""}`
    cells.push(html`<div class=${cls} style=${`grid-row:${Math.floor((ch - 1) / cols) + 1};grid-column:${((ch - 1) % cols) + 1}`}
      onClick=${armedItem ? () => { const f = fits(ch, fpOf(armedItem), [armed]); if (f.valid) place([armed], ch); else toast(t("Passt dort nicht mehr ins Universe."), true) } : undefined}><span>${ch}</span></div>`)
  }

  const legendTypes = [...new Map(here.map((i) => [i.type || "-", typeOf(i)])).entries()]

  return html`<div class="wrap" style="max-width:none">
    <${Head}
      title=${html`<h1>${t("Patch")}</h1>`}
      sub=${t("Zuletzt bekannte DMX-Adressen. Geräte ziehen zum Umpatchen. Jede Änderung wird sofort gespeichert und im Verlauf des Geräts protokolliert.")} />

    <div class="spread">
      <div class="universes" role="group" aria-label=${t("Universe")}>
        ${universes.map((n) => {
          const cnt = s.items.filter((i) => i.dmx_address > 0 && (i.dmx_universe || 1) === n).length
          return html`<button aria-pressed=${n === u} onClick=${() => { setU(n); setPop(null) }}>${t("Universe {n}", { n })} <span class="mono">${cnt}</span></button>`
        })}
        <button onClick=${() => { const n = Math.max(...universes) + 1; setExtra([...extra, n]); setU(n) }} aria-label=${t("Universe hinzufügen")}><${Icon} name="plus" /></button>
      </div>
      <div class="row">
        <span class="chip plain mono">${t("{n} / 512 belegt", { n: usedCh })}</span>
        ${conflicts ? html`<span class="chip defekt">${tn(conflicts, "{n} Überschneidung", "{n} Überschneidungen")}</span>` : html`<span class="chip ok">${t("Keine Überschneidungen")}</span>`}
      </div>
    </div>

    ${armedItem ? html`<p class="hint">${t("Tippe auf den Startkanal für")} <b>${armedItem.inv_no} ${armedItem.name}</b> (${tn(fpOf(armedItem), "{n} Kanal", "{n} Kanäle")}).
      <button class="btn sm ghost" onClick=${() => setArmed(null)}>${t("Abbrechen")}</button></p>` : null}

    <div class="patch">
      <div class="pgrid-wrap">
        <div class=${`pgrid${armedItem ? " armed" : ""}`} ref=${gridRef} style=${`--cols:${cols}`}
          onPointerMove=${armedItem && !drag ? (e) => setHover(chAt(e.clientX, e.clientY)) : undefined}
          onPointerLeave=${() => setHover(null)}>
          ${cells}
          ${groups.map((g) => {
            const first = g.items[0]
            const ids = g.items.map((i) => i.id)
            const names = g.items.map((i) => `${i.inv_no} ${i.name}`).join(", ")
            const mode = modeOf(first)
            return segments(g, cols).map((seg) => html`<div
              class=${`pfx${seg.span < 2 ? " tiny" : ""}${seg.first ? "" : " cont"}${seg.last ? "" : " more"}${g.conflict ? " conflict" : ""}${ids.some((id) => movingIds.includes(id)) ? " moving" : ""}${ids.includes(selected) ? " selected" : ""}`}
              style=${`grid-row:${seg.row};grid-column:${seg.col} / span ${seg.span};--tape:${tapeOf(typeOf(first))}`}
              data-ids=${ids.join(",")}
              tabindex=${seg.first ? 0 : -1} role="button"
              title=${`${names} · ${u}.${pad3(g.start)}–${pad3(g.end)}${mode ? ` · ${mode.name}` : ` · ${t("Mode unbekannt")}`}`}
              onKeyDown=${(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setPop({ ids, x: r.left + r.width / 2, y: r.bottom }) } }}
              onPointerDown=${(e) => {
                const ch = chAt(e.clientX, e.clientY) || g.start
                startDrag(e, { ids, fp: g.fp, grab: Math.max(0, ch - g.start), from: "grid", label: names,
                  onClick: (ev) => { setSelected(first.id); setPop({ ids, x: ev.clientX, y: ev.clientY }) } })
              }}>
              ${seg.first ? html`
                <span class="t1">${g.conflict ? html`<span class="warn" title=${t("Überschneidung")}>!</span>` : null}${pad3(g.start)}${!mode ? html`<span title=${t("Mode unbekannt")}>?</span>` : null}${g.items.length > 1 ? html`<span class="grp">×${g.items.length}</span>` : null}</span>
                ${seg.span > 1 ? html`<span class="t2">${g.items.length > 1 ? g.items.map((i) => i.name).join(" + ") : first.name}</span>` : null}` : null}
            </div>`)
          })}
          ${overlaps.flatMap((o) => segments(o, cols).map((seg) => html`<div class="poverlap" aria-hidden="true"
            style=${`grid-row:${seg.row};grid-column:${seg.col} / span ${seg.span}`}></div>`))}
        </div>
      </div>

      <aside class="pside">
        ${pairs.length ? html`<section class="stack">
          <h2 style="color:var(--bad)">${t("Überschneidungen")} · ${pairs.length}</h2>
          <div class="clashes">
            ${pairs.map(({ a, b, from, to }) => html`<button type="button" onClick=${(e) => { const ids = [...a.items, ...b.items].map((i) => i.id); setSelected(a.items[0].id); setPop({ ids, x: e.clientX, y: e.clientY }) }}>
              <span class="mono">${pad3(from)}${to > from ? `–${pad3(to)}` : ""}</span>
              <span class="n">${a.items.map((i) => i.inv_no).join(", ")} ↔ ${b.items.map((i) => i.inv_no).join(", ")}</span>
            </button>`)}
          </div>
        </section>` : null}
        <section class="stack">
          <h2>${t("Nicht gepatcht")} · ${pool.length}</h2>
          ${pool.length > 8 ? html`<input class="input" type="search" placeholder=${t("Filtern…")} value=${q} onInput=${(e) => setQ(e.target.value)} aria-label=${t("Ungepatchte Geräte filtern")} />` : null}
          <div class=${`pool${drag?.overPool ? " over" : ""}`} ref=${poolRef}>
            ${drag?.from === "grid" ? html`<p class="muted" style="font-size:13px">${t("Hier loslassen, um zu entpatchen")}</p>` : null}
            ${poolShown.map((i) => html`<div key=${i.id} class=${`pchip${armed === i.id ? " armed" : ""}`} style=${`--tape:${tapeOf(typeOf(i))}`}
              role="button" tabindex="0" title=${t("Ziehen oder antippen und dann Startkanal wählen")}
              onKeyDown=${(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setArmed(armed === i.id ? null : i.id))}
              onPointerDown=${(e) => startDrag(e, { ids: [i.id], fp: fpOf(i), grab: 0, from: "pool", label: `${i.inv_no} ${i.name}`,
                onClick: () => setArmed(armed === i.id ? null : i.id) })}>
              <${Swatch} type=${typeOf(i)} />
              <span class="n"><span class="mono" style="font-size:12px">${i.inv_no}</span> ${i.name}</span>
              <span class="mono">${modeOf(i) ? `${fpOf(i)} ch` : "? ch"}</span>
            </div>`)}
            ${!pool.length && drag?.from !== "grid" ? html`<p class="muted" style="font-size:13px">${t("Alle DMX-Geräte haben eine Adresse. Geräte ohne Adresse erscheinen hier, sobald ihr Typ DMX-Modes hat.")}</p>` : null}
          </div>
        </section>
        ${legendTypes.length ? html`<section class="stack">
          <h2>${t("Typen in Universe {u}", { u })}</h2>
          <div class="legend">${legendTypes.map(([id, ty]) => html`<div><${Swatch} type=${ty} /><span class="mono faint">${here.filter((i) => (i.type || "-") === id).length}×</span>
            <span>${ty ? `${ty.manufacturer} ${ty.model}` : t("Ohne Typ")}</span></div>`)}</div>
        </section>` : null}
      </aside>
    </div>

    ${pop ? html`<${Pop} key=${pop.ids.join()} pop=${pop} universe=${u} onClose=${() => setPop(null)} />` : null}
  </div>`
}

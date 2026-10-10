import { html, useEffect, useRef, useState } from "../vendor/preact-htm.mjs"
import { state, useStore, condLabel, typeOf, fileUrl, tapeOf } from "./store.js"
import { t } from "./i18n.js"

const PATHS = {
  box: () => html`<path d="M3 7.5l9-4.5 9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/>`,
  pin: () => html`<path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>`,
  grid: () => html`<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>`,
  spot: () => html`<circle cx="12" cy="10" r="6.5"/><circle cx="12" cy="10" r="2.5"/><path d="M7.5 21h9M12 16.5V21"/>`,
  tag: () => html`<path d="M3 12V4a1 1 0 011-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>`,
  users: () => html`<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6"/>`,
  user: () => html`<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>`,
  plus: () => html`<path d="M12 5v14M5 12h14"/>`,
  search: () => html`<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>`,
  x: () => html`<path d="M6 6l12 12M18 6L6 18"/>`,
  back: () => html`<path d="M15 18l-6-6 6-6"/>`,
  edit: () => html`<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>`,
  trash: () => html`<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>`,
  download: () => html`<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>`,
  upload: () => html`<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>`,
  printer: () => html`<path d="M7 8V3h10v5"/><rect x="3" y="8" width="18" height="9" rx="1"/><path d="M7 14h10v7H7z"/>`,
  file: () => html`<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>`,
  copy: () => html`<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V4H4v12h4"/>`,
  more: () => html`<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>`,
  logout: () => html`<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>`,
  camera: () => html`<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>`,
  check: () => html`<path d="M5 12l5 5 9-10"/>`,
  key: () => html`<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3M16 7l3 3M14 9l2 2"/>`,
  undo: () => html`<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>`,
  redo: () => html`<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>`,
  text: () => html`<path d="M5 7V5h14v2M12 5v14M9 19h6"/>`,
  line: () => html`<path d="M4 12h16"/>`,
  rect: () => html`<rect x="4" y="6" width="16" height="12" rx="1"/>`,
  image: () => html`<rect x="3" y="5" width="18" height="14" rx="1"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-9 8"/>`,
  sliders: () => html`<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>`,
}

export const Icon = ({ name }) => html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]?.()}</svg>`

export const Plate = ({ no, lg, ghost }) => html`<span class=${`plate${lg ? " lg" : ""}${ghost ? " ghost" : ""}`}>${no}</span>`

export const Cond = ({ c }) => c ? html`<span class=${`chip ${c}`}>${condLabel(c)}</span>` : null

export const Swatch = ({ type }) => html`<span class="swatch" style=${`--tape:${tapeOf(type)}`}></span>`

export function Thumb({ item, size = "160x160", cls = "thumb" }) {
  if (item.photos?.length) return html`<img class=${cls} src=${fileUrl(item, item.photos[0], size)} alt="" loading="lazy" />`
  const t = typeOf(item)
  if (t?.image) return html`<img class=${cls} style="object-fit:contain;padding:6px" src=${fileUrl(t, t.image, "160x160")} alt="" loading="lazy" />`
  return html`<span class=${`${cls} none`}><${Icon} name="box" /></span>`
}

export const Field = ({ label, hint, children }) => html`
  <label class="field"><span>${label}</span>${children}${hint ? html`<small>${hint}</small>` : null}</label>`

export function Empty({ title, children, action }) {
  return html`<div class="empty"><h3>${title}</h3>${children ? html`<p>${children}</p>` : null}${action}</div>`
}

export function Head({ crumb, title, sub, actions }) {
  return html`
    <header class="head">
      <div class="head-title">
        ${crumb ? html`<a class="crumb" href=${crumb[0]}><${Icon} name="back" />${crumb[1]}</a>` : null}
        ${title}
        ${sub ? html`<div class="muted">${sub}</div>` : null}
      </div>
      ${actions ? html`<div class="head-actions">${actions}</div>` : null}
    </header>`
}

export function FileDrop({ accept, multiple, onFiles, children }) {
  const [over, setOver] = useState(false)
  const input = useRef()
  const take = (list) => { const files = [...list]; if (files.length) onFiles(multiple ? files : [files[0]]) }
  return html`
    <div class=${`drop${over ? " over" : ""}`} role="button" tabindex="0"
      onClick=${() => input.current.click()}
      onKeyDown=${(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current.click())}
      onDragOver=${(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave=${() => setOver(false)}
      onDrop=${(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files) }}>
      <${Icon} name="upload" />
      ${children}
      <input ref=${input} type="file" hidden accept=${accept} multiple=${multiple}
        onChange=${(e) => { take(e.target.files); e.target.value = "" }} />
    </div>`
}

// Toast and ConfirmHost sit outside the routed views, so they subscribe to the store themselves
export function Toast() {
  useStore()
  const t = state.toast
  return t ? html`<div class=${`toast${t.bad ? " bad" : ""}`} role="status">${t.msg}</div>` : null
}

export function ConfirmHost() {
  useStore()
  const c = state.confirm
  const okRef = useRef()
  useEffect(() => { if (c) okRef.current?.focus() }, [c])
  if (!c) return null
  return html`
    <div class="modal-back" onClick=${(e) => e.target === e.currentTarget && c.resolve(false)}
      onKeyDown=${(e) => e.key === "Escape" && c.resolve(false)}>
      <div class="modal" role="alertdialog" aria-modal="true">
        <p>${c.message}</p>
        <div class="row" style="justify-content:flex-end">
          <button class="btn ghost" onClick=${() => c.resolve(false)}>${t("Abbrechen")}</button>
          <button ref=${okRef} class=${`btn ${c.danger ? "danger" : "primary"}`} onClick=${() => c.resolve(true)}>${c.ok}</button>
        </div>
      </div>
    </div>`
}

// simple controlled-form state
export function useForm(initial) {
  const [v, setV] = useState(initial)
  const bind = (k, opts = {}) => ({
    value: v[k] ?? "",
    onInput: (e) => {
      const raw = e.target.value
      setV((s) => ({ ...s, [k]: opts.number ? (raw === "" ? "" : Number(raw)) : raw }))
    },
  })
  return [v, setV, bind]
}

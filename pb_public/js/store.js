import PocketBase from "../vendor/pocketbase.mjs"
import { useEffect, useReducer, useState } from "../vendor/preact-htm.mjs"

export const pb = new PocketBase("/")
pb.autoCancellation(false)

// Whole inventory lives in memory: a club owns hundreds of things, not millions.
export const state = {
  items: [], types: [], locations: [], users: [], settings: null,
  ready: false, toast: null, confirm: null,
}

const subs = new Set()
export function emit() { subs.forEach((f) => f()) }
export function useStore() {
  const [, force] = useReducer((x) => x + 1, 0)
  useEffect(() => { subs.add(force); return () => subs.delete(force) }, [])
  return state
}

const KEYS = { items: "items", fixture_types: "types", locations: "locations", users: "users" }
const SORTS = {
  items: (a, b) => a.inv_no.localeCompare(b.inv_no),
  types: (a, b) => (a.manufacturer + a.model).localeCompare(b.manufacturer + b.model, "de"),
  locations: (a, b) => a.name.localeCompare(b.name, "de"),
  users: (a, b) => (a.name || a.email).localeCompare(b.name || b.email, "de"),
}

export async function loadAll() {
  const [items, types, locations, users, settings] = await Promise.all([
    pb.collection("items").getFullList({ sort: "inv_no", batch: 500 }),
    pb.collection("fixture_types").getFullList({ sort: "manufacturer,model" }),
    pb.collection("locations").getFullList({ sort: "name" }),
    pb.collection("users").getFullList({ sort: "name" }),
    pb.collection("settings").getFirstListItem("").catch(() => null),
  ])
  Object.assign(state, { items, types, locations, users, settings, ready: true })
  emit()
}

function upsert(key, rec) {
  const list = state[key].filter((r) => r.id !== rec.id)
  list.push(rec)
  list.sort(SORTS[key])
  state[key] = list
}

export async function save(collection, id, data) {
  const c = pb.collection(collection)
  const rec = id ? await c.update(id, data) : await c.create(data)
  if (KEYS[collection]) upsert(KEYS[collection], rec)
  if (collection === "settings") state.settings = rec
  emit()
  return rec
}

export async function remove(collection, id) {
  await pb.collection(collection).delete(id)
  const key = KEYS[collection]
  state[key] = state[key].filter((r) => r.id !== id)
  emit()
}

// ---------- auth ----------
export const me = () => pb.authStore.record
export const isAdmin = () => pb.authStore.record?.role === "admin"
export function useAuth() {
  const [rec, setRec] = useState(pb.authStore.isValid ? pb.authStore.record : null)
  useEffect(() => pb.authStore.onChange(() => setRec(pb.authStore.isValid ? pb.authStore.record : null)), [])
  return rec
}

// ---------- router ----------
export function parseHash(h = location.hash) {
  const [path, qs] = h.replace(/^#\/?/, "").split("?")
  return { parts: path.split("/").filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(qs || "") }
}
export function useRoute() {
  const [h, setH] = useState(location.hash)
  useEffect(() => {
    const f = () => { setH(location.hash); window.scrollTo(0, 0) }
    addEventListener("hashchange", f)
    setH(location.hash) // catch a change between first render and subscribing
    return () => removeEventListener("hashchange", f)
  }, [])
  return parseHash(h)
}
export const go = (path) => { location.hash = path }

// ---------- feedback ----------
let toastTimer
export function toast(msg, bad = false) {
  state.toast = { msg, bad }
  emit()
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { state.toast = null; emit() }, bad ? 6000 : 2600)
}
export function confirmDialog(message, { ok = "Löschen", danger = true } = {}) {
  return new Promise((resolve) => {
    state.confirm = { message, ok, danger, resolve: (v) => { state.confirm = null; emit(); resolve(v) } }
    emit()
  })
}
export function errMsg(err) {
  const data = err?.response?.data
  if (data && Object.keys(data).length) {
    return Object.entries(data).map(([k, v]) => `${FIELD_LABELS[k] || k}: ${v.message}`).join(" · ")
  }
  if (err?.status === 0) return "Keine Verbindung zum Server."
  return err?.response?.message || err?.message || String(err)
}

// ---------- club settings (set by admins under Einstellungen) ----------
export function org() {
  const s = state.settings || {}
  return {
    name: (s.org_name || "").trim(),
    short: (s.org_short || "").trim(),
    prefix: (s.inv_prefix || "").trim().toUpperCase() || "INV",
  }
}

// ---------- domain helpers ----------
export const CONDITIONS = {
  ok: "In Ordnung", defekt: "Defekt", reparatur: "In Reparatur", verschollen: "Verschollen",
}
export const FIELD_LABELS = {
  name: "Name", category: "Kategorie", type: "Typ", quantity: "Anzahl", location: "Lagerort",
  sublocation: "Platz", condition: "Zustand", serial: "Seriennummer", photos: "Fotos", notes: "Notizen",
  dmx_universe: "Universe", dmx_address: "DMX-Adresse", dmx_mode: "DMX-Mode",
  manufacturer: "Hersteller", model: "Modell", email: "E-Mail", password: "Passwort",
  passwordConfirm: "Passwort-Wiederholung", oldPassword: "Altes Passwort", keeper: "Zuständig",
}

// muted marker colours for fixture types in the patch grid; readable as tint + edge in both themes
export const TAPES = [
  ["#3d6fb6", "Blau"], ["#2e8b84", "Petrol"], ["#6f8f2e", "Oliv"], ["#b8861b", "Ocker"],
  ["#c0582f", "Rost"], ["#a63d63", "Beere"], ["#6e52b0", "Violett"], ["#56657a", "Schiefer"],
  ["#2b8cc4", "Himmel"],
]
export function tapeOf(type) {
  if (!type) return "#8b929d"
  if (type.color) return type.color
  let h = 0
  for (const ch of type.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TAPES[h % TAPES.length][0]
}

export const typeOf = (item) => state.types.find((t) => t.id === item?.type) || null
export const locOf = (item) => state.locations.find((l) => l.id === item?.location) || null
export const userOf = (id) => state.users.find((u) => u.id === id) || null
export const userName = (id) => { const u = userOf(id); return u ? u.name || u.email : "—" }
export const modesOf = (type) => (Array.isArray(type?.modes) ? type.modes : [])
export function modeOf(item, type = typeOf(item)) {
  const modes = modesOf(type)
  return modes.find((m) => m.name === item.dmx_mode) || (modes.length === 1 ? modes[0] : null)
}
export const isDmx = (item) => modesOf(typeOf(item)).length > 0 || !!item.dmx_mode || item.dmx_address > 0

export const pad3 = (n) => String(n).padStart(3, "0")
export const fmtAddr = (u, a) => `${u}.${pad3(a)}`
export function fmtRange(item, mode = modeOf(item)) {
  const fp = mode?.footprint || 1
  const end = item.dmx_address + fp - 1
  return fp > 1 ? `${fmtAddr(item.dmx_universe, item.dmx_address)}–${pad3(end)}` : fmtAddr(item.dmx_universe, item.dmx_address)
}

const dtf = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
const dtfLong = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
const parseDate = (s) => (s ? new Date(s.replace(" ", "T")) : null)
export const fmtDate = (s) => { const d = parseDate(s); return d ? dtf.format(d) : "" }
export const fmtDateTime = (s) => { const d = parseDate(s); return d ? dtfLong.format(d) : "" }
export function ageDays(s) { const d = parseDate(s); return d ? (Date.now() - d) / 864e5 : Infinity }

export const fileUrl = (rec, name, thumb) => (name ? pb.files.getURL(rec, name, thumb ? { thumb } : undefined) : "")

export function suggestions(list, field) {
  return [...new Set(list.map((r) => (r[field] || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"))
}

export const itemsAt = (locId) => state.items.filter((i) => i.location === locId)
export const itemsOfType = (typeId) => state.items.filter((i) => i.type === typeId)

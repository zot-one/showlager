import { html, render, useEffect, useState } from "../vendor/preact-htm.mjs"
import { pb, useStore, useAuth, useRoute, loadAll, isAdmin, me, errMsg, org } from "./store.js"
import { Icon, Toast, ConfirmHost } from "./ui.js"
import { ItemList, ItemDetail, ItemEdit } from "./views/items.js"
import { TypeList, TypeDetail, TypeEdit } from "./views/types.js"
import { LocationList, LocationDetail, LocationEdit } from "./views/locations.js"
import { Patch } from "./views/patch.js"
import { Labels } from "./views/labels.js"
import { Login, Account, Members, More, Settings } from "./views/admin.js"
import { LABEL_CSS } from "./labels.js"

const labelStyle = document.createElement("style")
labelStyle.textContent = LABEL_CSS
document.head.appendChild(labelStyle)

function resolve({ parts, query }) {
  const [a, b, c] = parts
  switch (a) {
    case undefined: return [ItemList, "items", {}]
    case "neu": return [ItemEdit, "items", { copy: query.get("kopie"), presetType: query.get("typ"), presetLoc: query.get("ort") }]
    case "i": return c === "bearbeiten" ? [ItemEdit, "items", { id: b }] : [ItemDetail, "items", { id: b }]
    case "typen": return [TypeList, "types", {}]
    case "typ":
      if (b === "neu") return [TypeEdit, "types", {}]
      return c === "bearbeiten" ? [TypeEdit, "types", { id: b }] : [TypeDetail, "types", { id: b }]
    case "orte": return [LocationList, "locations", {}]
    case "ort":
      if (b === "neu") return [LocationEdit, "locations", {}]
      return c === "bearbeiten" ? [LocationEdit, "locations", { id: b }] : [LocationDetail, "locations", { id: b }]
    case "patch": return [Patch, "patch", { universe: Number(query.get("u")) || 0, focus: query.get("fokus") }]
    case "etiketten": return [Labels, "labels", { ids: (query.get("ids") || "").split(",").filter(Boolean), tab: b === "vorlage" ? "design" : "print" }]
    case "mitglieder": return [isAdmin() ? Members : NotFound, "more", {}]
    case "einstellungen": return [isAdmin() ? Settings : NotFound, "more", {}]
    case "konto": return [Account, "more", {}]
    case "mehr": return [More, "more", {}]
    default: return [NotFound, "", {}]
  }
}

const NotFound = () => html`<div class="wrap"><h1>Nicht gefunden</h1><p><a href="#/">Zurück zum Inventar</a></p></div>`

const NAV = [
  ["items", "#/", "box", "Inventar"],
  ["locations", "#/orte", "pin", "Lagerorte"],
  ["patch", "#/patch", "grid", "Patch"],
  ["types", "#/typen", "spot", "Gerätetypen"],
  ["labels", "#/etiketten", "tag", "Etiketten"],
]

export function Brand() {
  const o = org()
  return html`<a class="brand" href="#/">
    <span class="brand-logo">${o.short || html`<${Icon} name="spot" />`}</span>
    <span class="brand-text"><b>Inventar</b><small>${o.name || "Showtechnik"}</small></span>
  </a>`
}

function Shell() {
  const s = useStore()
  const route = useRoute()
  const [View, section, props] = resolve(route)
  const user = me()
  const o = org()
  useEffect(() => { document.title = o.short ? `${o.short} Inventar` : "Showtechnik-Inventar" }, [o.short])
  const counts = { items: s.items.length, locations: s.locations.length, types: s.types.length }
  const cur = (k) => (k === section ? "page" : undefined)

  return html`
    <div class="shell">
      <aside class="rail">
        <${Brand} />
        <nav class="nav" aria-label="Hauptnavigation">
          ${NAV.map(([k, href, icon, label]) => html`
            <a href=${href} aria-current=${cur(k)}><${Icon} name=${icon} />${label}
              ${counts[k] != null ? html`<span class="count">${counts[k]}</span>` : null}</a>`)}
        </nav>
        <div class="rail-foot">
          <div class="who"><b>${user?.name || user?.email}</b>${user?.role === "admin" ? "Admin" : "Mitglied"}</div>
          <nav class="nav">
            ${isAdmin() ? html`<a href="#/mitglieder" aria-current=${route.parts[0] === "mitglieder" ? "page" : undefined}><${Icon} name="users" />Mitglieder</a>
              <a href="#/einstellungen" aria-current=${route.parts[0] === "einstellungen" ? "page" : undefined}><${Icon} name="sliders" />Einstellungen</a>` : null}
            <a href="#/konto" aria-current=${route.parts[0] === "konto" ? "page" : undefined}><${Icon} name="user" />Konto</a>
          </nav>
        </div>
      </aside>

      <header class="topbar">
        <${Brand} />
      </header>

      <main class="main" id="main">
        ${s.ready ? html`<${View} key=${route.parts.join("/")} ...${props} />` : html`<div class="loading">Lade Inventar…</div>`}
      </main>

      <nav class="tabbar" aria-label="Navigation">
        ${NAV.slice(0, 4).map(([k, href, icon, label]) => html`
          <a href=${href} aria-current=${cur(k)}><${Icon} name=${icon} />${label === "Gerätetypen" ? "Typen" : label === "Lagerorte" ? "Orte" : label}</a>`)}
        <a href="#/mehr" aria-current=${cur("more") || cur("labels")}><${Icon} name="more" />Mehr</a>
      </nav>
    </div>`
}

function App() {
  const user = useAuth()
  const [loadErr, setLoadErr] = useState(null)

  useEffect(() => {
    if (!user) return
    setLoadErr(null)
    pb.collection("users").authRefresh()
      .then(loadAll)
      .catch((e) => (e?.status === 401 ? pb.authStore.clear() : setLoadErr(errMsg(e))))
  }, [user?.id])

  if (!user) return html`<${Login} /><${Toast} />`
  if (loadErr) {
    return html`<div class="login"><div class="login-card"><h1>Laden fehlgeschlagen</h1><p class="err">${loadErr}</p>
      <button class="btn primary" onClick=${() => location.reload()}>Neu laden</button></div></div>`
  }
  return html`<${Shell} /><${Toast} /><${ConfirmHost} />`
}

render(html`<${App} />`, document.getElementById("app"))

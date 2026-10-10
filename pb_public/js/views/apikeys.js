import { html, useEffect, useState } from "../../vendor/preact-htm.mjs"
import { pb, toast, confirmDialog, errMsg, isAdmin, userName, fmtDate, fmtDateTime } from "../store.js"
import { t } from "../i18n.js"
import { Icon, Field, Head, Empty, useForm } from "../ui.js"

const DOCS = "https://github.com/zot-one/showlager/blob/main/docs/API.md"

function copy(text) {
  navigator.clipboard?.writeText(text).then(() => toast(t("Kopiert")), () => toast(t("Kopieren nicht möglich, bitte markieren."), true))
}

function Snippet({ label, text }) {
  return html`<div class="stack" style="gap:4px">
    <div class="spread"><span class="label">${label}</span>
      <button type="button" class="btn sm ghost" onClick=${() => copy(text)}><${Icon} name="copy" />${t("Kopieren")}</button></div>
    <pre class="snippet">${text}</pre>
  </div>`
}

// shown once right after creating a key
function NewKey({ created, onClose }) {
  const mcp = `${location.origin}/mcp`
  const auth = `Authorization: Bearer ${created.key}`
  return html`<section class="panel newkey">
    <div class="spread"><h3>${t("Neuer Schlüssel „{name}“", { name: created.name })}</h3>
      <button class="btn sm ghost" onClick=${onClose}>${t("Schließen")}</button></div>
    <p class="err" style="background:var(--fix-soft);color:var(--fix)">${t("Der Schlüssel wird nur jetzt angezeigt. Kopiere ihn an einen sicheren Ort.")}</p>
    <${Snippet} label=${t("Schlüssel")} text=${created.key} />
    <${Snippet} label=${t("Claude Code")} text=${`claude mcp add --transport http showlager ${mcp} --header "${auth}"`} />
    <${Snippet} label=${t("MCP-Konfiguration (JSON)")} text=${JSON.stringify({ mcpServers: { showlager: { type: "http", url: mcp, headers: { Authorization: `Bearer ${created.key}` } } } }, null, 2)} />
    <${Snippet} label=${t("REST-API (curl)")} text=${`curl -H "${auth}" ${location.origin}/api/collections/items/records`} />
  </section>`
}

export function ApiKeys() {
  const [keys, setKeys] = useState(null)
  const [created, setCreated] = useState(null)
  const [v, setV, bind] = useForm({ name: "", access: "read" })
  const [busy, setBusy] = useState(false)

  const load = () => pb.collection("api_keys").getFullList({ sort: "-created" }).then(setKeys).catch((err) => { setKeys([]); toast(errMsg(err), true) })
  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await pb.send("/api/keys", { method: "POST", body: { name: v.name.trim(), access: v.access } })
      setCreated(res)
      setV({ name: "", access: "read" })
      load()
    } catch (err) { toast(errMsg(err), true) } finally { setBusy(false) }
  }
  const revoke = async (k) => {
    if (!(await confirmDialog(t("Schlüssel „{name}“ widerrufen? Agenten und Skripte damit verlieren sofort den Zugriff.", { name: k.name }), { ok: t("Widerrufen") }))) return
    try { await pb.collection("api_keys").delete(k.id); toast(t("Schlüssel widerrufen")); load() } catch (err) { toast(errMsg(err), true) }
  }

  if (!isAdmin()) return html`<div class="wrap"><p>${t("Nur für Admins.")}</p></div>`
  return html`<div class="wrap narrow">
    <${Head} title=${html`<h1>${t("API-Schlüssel")}</h1>`}
      sub=${t("Für KI-Agenten (MCP) und Skripte (REST-API). Ein Schlüssel handelt in deinem Namen, kann aber nichts löschen und keine Konten oder Einstellungen ändern. Änderungen erscheinen im Verlauf mit dem Namen des Schlüssels.")}
      actions=${html`<a class="btn" href=${DOCS} target="_blank" rel="noopener"><${Icon} name="file" />${t("API-Dokumentation")}</a>`} />

    ${created ? html`<${NewKey} created=${created} onClose=${() => setCreated(null)} />` : null}

    <form class="panel" onSubmit=${create}>
      <h2>${t("Neuer Schlüssel")}</h2>
      <div class="grid2">
        <${Field} label=${t("Name")} hint=${t("Wofür? z. B. „Claude“ oder „Inventur-Skript“")}><input id="k-name" required maxlength="80" ...${bind("name")} /><//>
        <div class="field"><span>${t("Zugriff")}</span>
          <div class="seg" role="radiogroup" aria-label=${t("Zugriff")}>
            ${[["read", t("Nur lesen")], ["write", t("Lesen und schreiben")]].map(([k, l]) => html`<label>
              <input type="radio" name="access" checked=${v.access === k} onChange=${() => setV((x) => ({ ...x, access: k }))} /><span>${l}</span></label>`)}
          </div>
          <small>${v.access === "write" ? t("Darf Teile, Lagerorte und Gerätetypen anlegen und ändern sowie Fotos, GDTF und Anleitungen hochladen.") : t("Darf alles lesen, aber nichts ändern.")}</small>
        </div>
      </div>
      <div><button class="btn primary" disabled=${busy}><${Icon} name="plus" />${t("Schlüssel erstellen")}</button></div>
    </form>

    ${keys === null ? null : !keys.length ? html`<${Empty} title=${t("Noch keine Schlüssel")}>${t("Erstelle einen Schlüssel, um einen KI-Agenten oder ein Skript anzubinden.")}<//>` : html`
      <div class="tablewrap"><table class="t"><thead><tr>
        <th>${t("Name")}</th><th>${t("Zugriff")}</th><th>${t("Erstellt")}</th><th>${t("Zuletzt benutzt")}</th><th></th>
      </tr></thead><tbody>
        ${keys.map((k) => html`<tr style="cursor:default">
          <td><b>${k.name}</b><span class="sub mono">${k.hint}</span></td>
          <td><span class=${`chip ${k.access === "write" ? "reparatur" : "ok"}`}>${k.access === "write" ? t("Lesen und schreiben") : t("Nur lesen")}</span></td>
          <td class="muted">${fmtDate(k.created)}<span class="sub">${userName(k.owner)}</span></td>
          <td class="muted">${k.last_used ? fmtDateTime(k.last_used) : t("noch nie")}</td>
          <td><button class="btn sm danger" onClick=${() => revoke(k)}>${t("Widerrufen")}</button></td>
        </tr>`)}
      </tbody></table></div>`}
  </div>`
}

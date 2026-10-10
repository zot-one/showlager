import { html, useState } from "../../vendor/preact-htm.mjs"
import { useStore, save, remove, go, toast, confirmDialog, errMsg, isAdmin, typeOf, userName, itemsAt } from "../store.js"
import { t, lang } from "../i18n.js"
import { Icon, Plate, Cond, Field, Empty, Head, useForm } from "../ui.js"
import { DmxCell, setListFilter } from "./items.js"

function topCategories(items) {
  const n = {}
  items.forEach((i) => { if (i.category) n[i.category] = (n[i.category] || 0) + (i.quantity || 1) })
  return Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 4)
}

export function LocationList() {
  const s = useStore()
  const homeless = s.items.filter((i) => !i.location)
  return html`<div class="wrap">
    <${Head}
      title=${html`<h1>${t("Lagerorte")}</h1>`}
      sub=${t("Wo die Technik gerade liegt: Keller, Garagen, Dachböden der Mitglieder.")}
      actions=${html`<a class="btn primary" href="#/ort/neu"><${Icon} name="plus" />${t("Neuer Lagerort")}</a>`} />
    ${!s.locations.length ? html`<${Empty} title=${t("Noch keine Lagerorte")}
        action=${html`<a class="btn primary" href="#/ort/neu"><${Icon} name="plus" />${t("Ersten Lagerort anlegen")}</a>`}>
        ${t("Leg für jeden Ort, an dem Vereinstechnik liegt, einen Lagerort an, z. B. „Keller Schmidt“ oder „Garage Bürgerhaus“. Optional mit zuständiger Person und Adresse.")}<//>` : html`
      <div class="tiles">
        ${s.locations.map((l) => {
          const items = itemsAt(l.id)
          const qty = items.reduce((n, i) => n + (i.quantity || 1), 0)
          return html`<a class="tile" href=${`#/ort/${l.id}`} key=${l.id}>
            <div class="tile-top"><div>
              ${l.keeper ? html`<span class="k">${t("bei {name}", { name: userName(l.keeper) })}</span>` : null}
              <span class="big">${l.name}</span>
              ${l.address ? html`<span class="muted" style="font-size:14px">${l.address.split("\n")[0]}</span>` : null}
            </div></div>
            ${items.length ? html`<div class="tile-stats">${topCategories(items).map(([c, n]) => html`<span class="chip plain">${c} <span class="mono">${n}</span></span>`)}</div>` : null}
            <div class="tile-foot"><span><b>${items.length}</b> ${items.length === 1 ? t("Eintrag") : t("Einträge")}</span>${qty !== items.length ? html`<span>${t("{n} Stück", { n: qty })}</span>` : null}</div>
          </a>`
        })}
        ${homeless.length ? html`<a class="tile" href="#/" style="border-style:dashed" onClick=${(e) => {
          e.preventDefault()
          setListFilter({ location: "-" })
          go("/")
        }}>
          <div class="tile-top"><div><span class="k">${t("Ungeklärt")}</span><span class="big">${t("Ohne Lagerort")}</span></div></div>
          <div class="tile-foot"><span><b>${homeless.length}</b> ${homeless.length === 1 ? t("Eintrag") : t("Einträge")}</span><span>${t("anzeigen")}</span></div>
        </a>` : null}
      </div>`}
  </div>`
}

export function LocationDetail({ id }) {
  const s = useStore()
  const l = s.locations.find((x) => x.id === id)
  if (!l) return html`<div class="wrap"><${Empty} title=${t("Lagerort nicht gefunden")} action=${html`<a class="btn" href="#/orte">${t("Zu den Lagerorten")}</a>`} /></div>`
  const items = itemsAt(l.id)
  const groups = {}
  items.forEach((i) => { (groups[i.sublocation || ""] ||= []).push(i) })
  const keys = Object.keys(groups).sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, lang)))

  const del = async () => {
    const msg = items.length
      ? t("„{name}“ löschen? {n} Teile stehen danach ohne Lagerort da.", { name: l.name, n: items.length })
      : t("„{name}“ löschen?", { name: l.name })
    if (!(await confirmDialog(msg))) return
    try { await remove("locations", l.id); toast(t("Lagerort gelöscht")); go("/orte") } catch (err) { toast(errMsg(err), true) }
  }

  return html`<div class="wrap">
    <${Head}
      crumb=${["#/orte", t("Lagerorte")]}
      title=${html`${l.keeper ? html`<span class="label">${t("bei {name}", { name: userName(l.keeper) })}</span>` : null}<h1>${l.name}</h1>`}
      sub=${l.address ? html`<span class="notes">${l.address}</span>` : null}
      actions=${html`
        <a class="btn primary" href=${`#/ort/${l.id}/bearbeiten`}><${Icon} name="edit" />${t("Bearbeiten")}</a>
        <a class="btn" href=${`#/neu?ort=${l.id}`}><${Icon} name="plus" />${t("Teil hier anlegen")}</a>
        ${items.length ? html`<a class="btn" href=${`#/etiketten?ids=${items.map((i) => i.id).join(",")}`}><${Icon} name="tag" />${t("Etiketten")}</a>` : null}
        ${isAdmin() ? html`<button class="btn danger icon" aria-label=${t("Löschen")} title=${t("Löschen")} onClick=${del}><${Icon} name="trash" /></button>` : null}`} />
    ${l.notes ? html`<p class="notes muted">${l.notes}</p>` : null}

    ${!items.length ? html`<${Empty} title=${t("Hier liegt noch nichts")}>${t("Weise Teilen beim Bearbeiten diesen Lagerort zu.")}<//>` : keys.map((k) => html`
      <section class="stack">
        <h2>${k || t("Ohne Platzangabe")} · ${groups[k].length}</h2>
        <div class="tablewrap"><table class="t"><tbody>
          ${groups[k].map((i) => {
            const ty = typeOf(i)
            return html`<tr onClick=${() => go(`/i/${i.id}`)}>
              <td style="width:1%"><${Plate} no=${i.inv_no} /></td>
              <td><a href=${`#/i/${i.id}`} style="text-decoration:none;font-weight:600">${i.name}</a>${i.quantity > 1 ? html` <span class="muted mono">×${i.quantity}</span>` : null}
                ${ty ? html`<span class="sub">${ty.manufacturer} ${ty.model}</span>` : null}</td>
              <td>${i.category || ""}</td>
              <td><${DmxCell} item=${i} /></td>
              <td><${Cond} c=${i.condition} /></td>
            </tr>`
          })}
        </tbody></table></div>
      </section>`)}
  </div>`
}

export function LocationEdit({ id }) {
  const s = useStore()
  const l = id ? s.locations.find((x) => x.id === id) : null
  const [v, , bind] = useForm({ name: l?.name || "", keeper: l?.keeper || "", address: l?.address || "", notes: l?.notes || "" })
  const [busy, setBusy] = useState(false)
  if (id && !l) return html`<div class="wrap"><${Empty} title=${t("Lagerort nicht gefunden")} /></div>`

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const rec = await save("locations", l?.id, { ...v, name: v.name.trim() })
      toast(t("Lagerort gespeichert"))
      go(`/ort/${rec.id}`)
    } catch (err) { toast(errMsg(err), true) } finally { setBusy(false) }
  }

  return html`<div class="wrap narrow">
    <${Head} crumb=${l ? [`#/ort/${l.id}`, l.name] : ["#/orte", t("Lagerorte")]} title=${html`<h1>${l ? t("Lagerort bearbeiten") : t("Neuer Lagerort")}</h1>`} />
    <form class="form" onSubmit=${submit}>
      <section class="section">
        <div class="grid2">
          <${Field} label=${`${t("Name")} *`}><input id="l-name" required ...${bind("name")} placeholder=${t("z. B. Keller Schmidt")} /><//>
          <${Field} label=${t("Zuständig")}>
            <select id="l-keeper" ...${bind("keeper")}>
              <option value="">${t("Niemand bestimmtes")}</option>
              ${s.users.map((u) => html`<option value=${u.id}>${u.name || u.email}</option>`)}
            </select>
          <//>
        </div>
        <${Field} label=${t("Adresse")}><textarea id="l-addr" rows="3" ...${bind("address")}></textarea><//>
        <${Field} label=${t("Notizen")} hint=${t("Zugang, Schlüssel, Öffnungszeiten …")}><textarea id="l-notes" ...${bind("notes")}></textarea><//>
      </section>
      <div class="form-foot">
        <button type="button" class="btn ghost" onClick=${() => (l ? go(`/ort/${l.id}`) : go("/orte"))}>${t("Abbrechen")}</button>
        <button class="btn primary" disabled=${busy}><${Icon} name="check" />${t("Speichern")}</button>
      </div>
    </form>
  </div>`
}

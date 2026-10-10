import { html, useState } from "../../vendor/preact-htm.mjs"
import { pb, useStore, save, remove, toast, confirmDialog, errMsg, isAdmin, me, fmtDate, org } from "../store.js"
import { t, lang, setLang, serverMsg } from "../i18n.js"
import { Icon, Field, Head, useForm } from "../ui.js"

// small language switch for the pages before login
function LangSwitch() {
  return html`<div class="seg" role="radiogroup" aria-label="Language / Sprache" style="justify-self:start">
    ${[["de", "Deutsch"], ["en", "English"]].map(([k, l]) => html`<label>
      <input type="radio" name="lang" checked=${lang === k} onChange=${() => setLang(k)} /><span>${l}</span></label>`)}
  </div>`
}

export function Login() {
  const [v, , bind] = useForm({ email: "", password: "" })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await pb.collection("users").authWithPassword(v.email.trim(), v.password)
    } catch (e2) {
      setErr(e2?.status === 400 ? t("E-Mail oder Passwort stimmt nicht.") : errMsg(e2))
    } finally { setBusy(false) }
  }
  return html`<div class="login">
    <form class="login-card" onSubmit=${submit}>
      <div class="brand">
        <span class="brand-logo"><${Icon} name="spot" /></span>
        <span class="brand-text"><b>Showlager</b><small>${t("Inventar für Showtechnik")}</small></span>
      </div>
      <div class="stack" style="gap:14px">
        <${Field} label=${t("E-Mail")}><input id="login-email" type="email" autocomplete="username" required ...${bind("email")} /><//>
        <${Field} label=${t("Passwort")}><input id="login-pw" type="password" autocomplete="current-password" required ...${bind("password")} /><//>
        ${err ? html`<p class="err">${err}</p>` : null}
        <button class="btn primary" disabled=${busy}>${busy ? t("Anmelden…") : t("Anmelden")}</button>
      </div>
      <p class="muted" style="font-size:14px">${t("Noch keinen Zugang? Frag im Verein nach, ein Admin legt dir ein Konto an.")}</p>
      <${LangSwitch} />
    </form>
  </div>`
}

// first start: setup code from the server log + club settings + first admin account
const initials = (name) => name.split(/[\s-]+/).filter((w) => /^[A-Za-zÄÖÜ]/.test(w)).map((w) => w[0].toUpperCase()).join("").slice(0, 4)
const normCode = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "")

export function Setup({ onDone }) {
  const [v, setV, bind] = useForm({ code: "", org_name: "", org_short: "", inv_prefix: "", name: "", email: "", password: "", password2: "" })
  const [touched, setTouched] = useState({})
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const short = touched.org_short ? v.org_short : initials(v.org_name)
  const prefix = (touched.inv_prefix ? normCode(v.inv_prefix) : normCode(short)).slice(0, 6) || "INV"

  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    if (v.password !== v.password2) { setErr(t("Die beiden Passwörter stimmen nicht überein.")); return }
    setBusy(true)
    try {
      await pb.send("/api/setup", {
        method: "POST",
        body: { code: v.code, org_name: v.org_name, org_short: short, inv_prefix: prefix, name: v.name, email: v.email, password: v.password },
      })
      await pb.collection("users").authWithPassword(v.email.trim(), v.password)
      toast(t("Eingerichtet. Willkommen!"))
      onDone()
    } catch (e2) {
      setErr(e2?.response?.message ? serverMsg(e2.response.message) : errMsg(e2))
    } finally { setBusy(false) }
  }

  const own = (k) => ({
    // until edited, Kürzel follows the club name and Präfix follows the Kürzel
    value: k === "org_short" ? short : touched.inv_prefix ? v.inv_prefix : normCode(short).slice(0, 6),
    onInput: (e) => {
      const val = k === "inv_prefix" ? normCode(e.target.value).slice(0, 6) : e.target.value
      setTouched((x) => ({ ...x, [k]: true }))
      setV((x) => ({ ...x, [k]: val }))
    },
  })

  return html`<div class="login">
    <form class="login-card setup" onSubmit=${submit}>
      <div class="brand">
        <span class="brand-logo"><${Icon} name="spot" /></span>
        <span class="brand-text"><b>${t("Showlager einrichten")}</b><small>${t("Einmalig beim ersten Start")}</small></span>
      </div>
      <${LangSwitch} />

      <section class="section">
        <${Field} label=${t("Einrichtungscode")} hint=${t("Steht im Server-Log, z. B. mit docker compose logs pocketbase.")}>
          <input id="setup-code" class="mono" required autocomplete="off" spellcheck="false" placeholder="XXXX-XXXX" ...${bind("code")} /><//>
      </section>

      <section class="section">
        <h2>${t("Verein")}</h2>
        <${Field} label=${t("Name des Vereins")}><input id="setup-org" required maxlength="120" placeholder=${t("z. B. Theaterverein Musterstadt")} ...${bind("org_name")} /><//>
        <div class="grid2" style="grid-template-columns:1fr 1fr">
          <${Field} label=${t("Kürzel")} hint=${t("Für das Logo")}><input id="setup-short" maxlength="5" placeholder="TVM" ...${own("org_short")} /><//>
          <${Field} label=${t("Präfix Inventarnummer")} hint=${t("Erste Nummer: {no}", { no: `${prefix}-0001` })}><input id="setup-prefix" class="mono" maxlength="6" placeholder="INV" ...${own("inv_prefix")} /><//>
        </div>
      </section>

      <section class="section">
        <h2>${t("Dein Admin-Konto")}</h2>
        <${Field} label=${t("Name")}><input id="setup-name" required autocomplete="name" ...${bind("name")} /><//>
        <${Field} label=${t("E-Mail")}><input id="setup-email" type="email" required autocomplete="username" ...${bind("email")} /><//>
        <div class="grid2" style="grid-template-columns:1fr 1fr">
          <${Field} label=${t("Passwort")} hint=${t("Mindestens 8 Zeichen")}><input id="setup-pw" type="password" required minlength="8" autocomplete="new-password" ...${bind("password")} /><//>
          <${Field} label=${t("Wiederholen")}><input id="setup-pw2" type="password" required minlength="8" autocomplete="new-password" ...${bind("password2")} /><//>
        </div>
      </section>

      ${err ? html`<p class="err">${err}</p>` : null}
      <button class="btn primary" disabled=${busy}>${busy ? t("Wird eingerichtet…") : t("Einrichten und anmelden")}</button>
      <p class="muted" style="font-size:13px">${t("Name, Kürzel und Präfix lassen sich später unter Einstellungen ändern. Weitere Mitglieder legst du danach unter Mitglieder an.")}</p>
    </form>
  </div>`
}

function getTheme() { try { return localStorage.getItem("inventar-theme") || "system" } catch { return "system" } }
function setTheme(th) {
  try { th === "system" ? localStorage.removeItem("inventar-theme") : localStorage.setItem("inventar-theme", th) } catch {}
  if (th === "system") delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = th
}

export function Account() {
  const user = me()
  const [name, setName] = useState(user?.name || "")
  const [pw, setPw, bindPw] = useForm({ oldPassword: "", password: "", passwordConfirm: "" })
  const [theme, setThemeState] = useState(getTheme())
  const [busy, setBusy] = useState(false)

  const saveName = async (e) => {
    e.preventDefault()
    try { await save("users", user.id, { name: name.trim() }); await pb.collection("users").authRefresh(); toast(t("Name gespeichert")) } catch (err) { toast(errMsg(err), true) }
  }
  const savePw = async (e) => {
    e.preventDefault()
    if (pw.password !== pw.passwordConfirm) { toast(t("Die neuen Passwörter stimmen nicht überein."), true); return }
    setBusy(true)
    try {
      await pb.collection("users").update(user.id, pw)
      await pb.collection("users").authWithPassword(user.email, pw.password) // old tokens are invalid now
      setPw({ oldPassword: "", password: "", passwordConfirm: "" })
      toast(t("Passwort geändert"))
    } catch (err) { toast(errMsg(err), true) } finally { setBusy(false) }
  }

  return html`<div class="wrap narrow">
    <${Head} title=${html`<h1>${t("Konto")}</h1>`} sub=${`${user?.email} · ${user?.role === "admin" ? t("Admin") : t("Mitglied")}`}
      actions=${html`<button class="btn" onClick=${() => pb.authStore.clear()}><${Icon} name="logout" />${t("Abmelden")}</button>`} />

    <form class="section" onSubmit=${saveName}>
      <h2>${t("Name")}</h2>
      <div class="row"><input class="input" style="flex:1;min-width:200px" value=${name} onInput=${(e) => setName(e.target.value)} aria-label=${t("Name")} />
        <button class="btn">${t("Speichern")}</button></div>
    </form>

    <section class="section">
      <h2>${t("Sprache")}</h2>
      <${LangSwitch} />
    </section>

    <section class="section">
      <h2>${t("Darstellung")}</h2>
      <div class="seg" role="radiogroup" aria-label=${t("Farbschema")}>
        ${[["system", t("Wie Gerät")], ["light", t("Hell")], ["dark", t("Dunkel")]].map(([k, l]) => html`<label>
          <input type="radio" name="theme" checked=${theme === k} onChange=${() => { setTheme(k); setThemeState(k) }} /><span>${l}</span></label>`)}
      </div>
    </section>

    <form class="section" onSubmit=${savePw}>
      <h2>${t("Passwort ändern")}</h2>
      <div class="grid3">
        <${Field} label=${t("Aktuelles Passwort")}><input type="password" autocomplete="current-password" required ...${bindPw("oldPassword")} /><//>
        <${Field} label=${t("Neues Passwort")} hint=${t("Mindestens 8 Zeichen")}><input type="password" autocomplete="new-password" minlength="8" required ...${bindPw("password")} /><//>
        <${Field} label=${t("Wiederholen")}><input type="password" autocomplete="new-password" minlength="8" required ...${bindPw("passwordConfirm")} /><//>
      </div>
      <div><button class="btn" disabled=${busy}>${t("Passwort ändern")}</button></div>
    </form>
  </div>`
}

const genPassword = () => {
  const words = lang === "de"
    ? ["Scheinwerfer", "Nebel", "Bühne", "Vorhang", "Spot", "Kulisse", "Gobo", "Fader", "Traverse", "Kabel", "Strobe", "Zauber"]
    : ["Spotlight", "Haze", "Stage", "Curtain", "Spot", "Scenery", "Gobo", "Fader", "Truss", "Cable", "Strobe", "Cue"]
  const pick = () => words[crypto.getRandomValues(new Uint32Array(1))[0] % words.length]
  return `${pick()}-${pick()}-${crypto.getRandomValues(new Uint32Array(1))[0] % 900 + 100}`
}

export function Members() {
  const s = useStore()
  const [v, setV, bind] = useForm({ name: "", email: "", password: genPassword(), role: "member" })
  const [created, setCreated] = useState(null)
  const [busy, setBusy] = useState(false)

  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const rec = await save("users", null, { ...v, passwordConfirm: v.password, emailVisibility: true, verified: true })
      setCreated({ email: rec.email, password: v.password })
      setV({ name: "", email: "", password: genPassword(), role: "member" })
    } catch (err) { toast(errMsg(err), true) } finally { setBusy(false) }
  }
  const setRole = async (u, role) => {
    try {
      await save("users", u.id, { role })
      toast(t(role === "admin" ? "{name} ist jetzt Admin" : "{name} ist jetzt Mitglied", { name: u.name || u.email }))
    } catch (err) { toast(errMsg(err), true) }
  }
  const [pwFor, setPwFor] = useState(null) // { user, value }
  const setPassword = async (e) => {
    e.preventDefault()
    const { user, value } = pwFor
    if (value.length < 8) { toast(t("Das Passwort braucht mindestens 8 Zeichen."), true); return }
    setBusy(true)
    try {
      await save("users", user.id, { password: value, passwordConfirm: value })
      setPwFor(null)
      setCreated({ email: user.email, password: value })
      toast(t("Passwort für {name} geändert", { name: user.name || user.email }))
    } catch (err) { toast(errMsg(err), true) } finally { setBusy(false) }
  }
  const del = async (u) => {
    if (!(await confirmDialog(t("Konto von {name} löschen? Einträge im Verlauf bleiben ohne Namen erhalten.", { name: u.name || u.email })))) return
    try { await remove("users", u.id); toast(t("Konto gelöscht")) } catch (err) { toast(errMsg(err), true) }
  }

  if (!isAdmin()) return html`<div class="wrap"><p>${t("Nur für Admins.")}</p></div>`
  return html`<div class="wrap narrow">
    <${Head} title=${html`<h1>${t("Mitglieder")}</h1>`} sub=${t("Wer sich anmelden darf. Mitglieder können alles anlegen und bearbeiten, löschen dürfen nur Admins.")} />

    ${created ? html`<div class="hint stack">
      <b>${t("Zugangsdaten weitergeben:")}</b>
      <span class="mono" style="user-select:all">${location.origin} · ${created.email} · ${created.password}</span>
      <div class="row"><button class="btn sm" onClick=${() => navigator.clipboard?.writeText(`${location.origin}\n${t("E-Mail")}: ${created.email}\n${t("Passwort")}: ${created.password}`).then(() => toast(t("Kopiert")), () => toast(t("Kopieren nicht möglich, bitte markieren."), true))}>
        <${Icon} name="copy" />${t("Kopieren")}</button><button class="btn sm ghost" onClick=${() => setCreated(null)}>${t("Schließen")}</button></div>
    </div>` : null}

    <div class="tablewrap"><table class="t"><thead><tr><th>${t("Name")}</th><th>${t("Rolle")}</th><th>${t("Seit")}</th><th></th></tr></thead><tbody>
      ${s.users.map((u) => html`<tr style="cursor:default">
        <td><b>${u.name || "—"}</b><span class="sub">${u.email}</span></td>
        <td><select class="input" style="min-height:34px;width:auto" value=${u.role || "member"} disabled=${u.id === me()?.id}
          onChange=${(e) => setRole(u, e.target.value)} aria-label=${t("Rolle")}><option value="member">${t("Mitglied")}</option><option value="admin">${t("Admin")}</option></select></td>
        <td class="muted">${fmtDate(u.created)}</td>
        <td><div class="row" style="justify-content:flex-end">
          <button class="btn sm" onClick=${() => setPwFor({ user: u, value: genPassword() })}>${t("Passwort ändern")}</button>
          ${u.id !== me()?.id ? html`<button class="btn sm danger icon" aria-label=${t("Löschen")} onClick=${() => del(u)}><${Icon} name="trash" /></button>` : null}
        </div></td>
      </tr>`)}
    </tbody></table></div>

    <form class="panel" onSubmit=${add}>
      <h2>${t("Neues Mitglied")}</h2>
      <div class="grid2">
        <${Field} label=${t("Name")}><input id="m-name" required ...${bind("name")} /><//>
        <${Field} label=${t("E-Mail")}><input id="m-email" type="email" required ...${bind("email")} /><//>
        <${Field} label=${t("Startpasswort")} hint=${t("Kann das Mitglied später unter Konto ändern")}><input id="m-pw" class="mono" required minlength="8" ...${bind("password")} /><//>
        <${Field} label=${t("Rolle")}><select id="m-role" ...${bind("role")}><option value="member">${t("Mitglied")}</option><option value="admin">${t("Admin")}</option></select><//>
      </div>
      <div><button class="btn primary" disabled=${busy}><${Icon} name="plus" />${t("Konto anlegen")}</button></div>
    </form>

    ${pwFor ? html`<div class="modal-back" onClick=${(e) => e.target === e.currentTarget && setPwFor(null)}
      onKeyDown=${(e) => e.key === "Escape" && setPwFor(null)}>
      <form class="modal" role="dialog" aria-modal="true" aria-labelledby="pw-title" onSubmit=${setPassword}>
        <h3 id="pw-title">${t("Passwort für {name}", { name: pwFor.user.name || pwFor.user.email })}</h3>
        <label class="field"><span>${t("Neues Passwort")}</span>
          <div class="row" style="flex-wrap:nowrap">
            <input id="pw-new" class="mono" style="flex:1" minlength="8" required autocomplete="new-password" value=${pwFor.value}
              ref=${(n) => n && !n.dataset.f && (n.dataset.f = 1, n.focus(), n.select())}
              onInput=${(e) => setPwFor({ ...pwFor, value: e.target.value })} />
            <button type="button" class="btn" title=${t("Neues Zufallspasswort")} onClick=${() => setPwFor({ ...pwFor, value: genPassword() })}>${t("Zufällig")}</button>
          </div>
          <small>${t("Mindestens 8 Zeichen. Das alte Passwort gilt danach nicht mehr, das Mitglied wird auf allen Geräten abgemeldet.")}</small>
        </label>
        <div class="row" style="justify-content:flex-end">
          <button type="button" class="btn ghost" onClick=${() => setPwFor(null)}>${t("Abbrechen")}</button>
          <button class="btn primary" disabled=${busy}>${t("Passwort setzen")}</button>
        </div>
      </form>
    </div>` : null}
  </div>`
}

export function More() {
  return html`<div class="wrap narrow">
    <${Head} title=${html`<h1>${t("Mehr")}</h1>`} />
    <nav class="files">
      <a class="file" href="#/etiketten"><${Icon} name="tag" /><span>${t("Etiketten drucken")}</span></a>
      <a class="file" href="#/typen"><${Icon} name="spot" /><span>${t("Gerätetypen")}</span></a>
      ${isAdmin() ? html`<a class="file" href="#/mitglieder"><${Icon} name="users" /><span>${t("Mitglieder")}</span></a>
        <a class="file" href="#/api"><${Icon} name="key" /><span>${t("API-Schlüssel")}</span></a>
        <a class="file" href="#/einstellungen"><${Icon} name="sliders" /><span>${t("Einstellungen")}</span></a>` : null}
      <a class="file" href="#/konto"><${Icon} name="user" /><span>${t("Konto, Sprache & Darstellung")}</span></a>
      <button class="file btn" style="justify-content:flex-start;text-transform:none;font:inherit" onClick=${() => pb.authStore.clear()}><${Icon} name="logout" /><span>${t("Abmelden")}</span></button>
    </nav>
  </div>`
}

// club name, logo initials and inventory prefix live in the database, not in the code
export function Settings() {
  const s = useStore()
  const o = org()
  const [v, setV, bind] = useForm({ org_name: o.name, org_short: o.short, inv_prefix: s.settings?.inv_prefix || "" })
  const [busy, setBusy] = useState(false)
  const prefix = (v.inv_prefix || "").toUpperCase().replace(/[^A-Z0-9]/g, "") || "INV"
  const last = s.items.filter((i) => i.inv_no.startsWith(`${prefix}-`)).map((i) => parseInt(i.inv_no.slice(prefix.length + 1), 10) || 0)
  const next = `${prefix}-${String((last.length ? Math.max(...last) : 0) + 1).padStart(4, "0")}`

  const submit = async (e) => {
    e.preventDefault()
    if (!s.settings) { toast(t("Einstellungen fehlen auf dem Server."), true); return }
    setBusy(true)
    try {
      await save("settings", s.settings.id, {
        org_name: v.org_name.trim(),
        org_short: v.org_short.trim().slice(0, 5),
        inv_prefix: (v.inv_prefix || "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
      })
      toast(t("Einstellungen gespeichert"))
    } catch (err) { toast(errMsg(err), true) } finally { setBusy(false) }
  }

  if (!isAdmin()) return html`<div class="wrap"><p>${t("Nur für Admins.")}</p></div>`
  return html`<div class="wrap narrow">
    <${Head} title=${html`<h1>${t("Einstellungen")}</h1>`} sub=${t("Gilt für alle Mitglieder.")} />
    <form class="form" onSubmit=${submit}>
      <section class="section">
        <h2>${t("Verein")}</h2>
        <div class="grid2">
          <${Field} label=${t("Name des Vereins")} hint=${t("Erscheint in der Seitenleiste und als Feld {Verein} auf Etiketten.")}>
            <input id="s-name" maxlength="120" ...${bind("org_name")} placeholder=${t("z. B. Theaterverein Musterstadt")} /><//>
          <${Field} label=${t("Kürzel")} hint=${t("Bis zu 5 Zeichen, für das Logo oben links und den Browser-Tab.")}>
            <input id="s-short" maxlength="5" ...${bind("org_short")} placeholder=${t("z. B. TVM")} /><//>
        </div>
      </section>
      <section class="section">
        <h2>${t("Inventarnummern")}</h2>
        <div class="grid2">
          <${Field} label=${t("Präfix")} hint=${t("Nur A–Z und 0–9. Das nächste neue Teil bekommt {no}. Bestehende Nummern bleiben unverändert.", { no: next })}>
            <input id="s-prefix" class="mono" maxlength="6" ...${bind("inv_prefix")} placeholder="INV"
              onInput=${(e) => setV((x) => ({ ...x, inv_prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") }))} /><//>
        </div>
      </section>
      <div class="form-foot">
        <button class="btn primary" disabled=${busy}><${Icon} name="check" />${t("Speichern")}</button>
      </div>
    </form>
  </div>`
}

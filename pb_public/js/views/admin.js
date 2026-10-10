import { html, useState } from "../../vendor/preact-htm.mjs"
import { pb, useStore, save, remove, toast, confirmDialog, errMsg, isAdmin, me, fmtDate, org } from "../store.js"
import { Icon, Field, Head, useForm } from "../ui.js"

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
      setErr(e2?.status === 400 ? "E-Mail oder Passwort stimmt nicht." : errMsg(e2))
    } finally { setBusy(false) }
  }
  return html`<div class="login">
    <form class="login-card" onSubmit=${submit}>
      <div class="brand">
        <span class="brand-logo"><${Icon} name="spot" /></span>
        <span class="brand-text"><b>Showlager</b><small>Inventar für Showtechnik</small></span>
      </div>
      <div class="stack" style="gap:14px">
        <${Field} label="E-Mail"><input id="login-email" type="email" autocomplete="username" required ...${bind("email")} /><//>
        <${Field} label="Passwort"><input id="login-pw" type="password" autocomplete="current-password" required ...${bind("password")} /><//>
        ${err ? html`<p class="err">${err}</p>` : null}
        <button class="btn primary" disabled=${busy}>${busy ? "Anmelden…" : "Anmelden"}</button>
      </div>
      <p class="muted" style="font-size:14px">Noch keinen Zugang? Frag im Verein nach, ein Admin legt dir ein Konto an.</p>
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
    if (v.password !== v.password2) { setErr("Die beiden Passwörter stimmen nicht überein."); return }
    setBusy(true)
    try {
      await pb.send("/api/setup", {
        method: "POST",
        body: { code: v.code, org_name: v.org_name, org_short: short, inv_prefix: prefix, name: v.name, email: v.email, password: v.password },
      })
      await pb.collection("users").authWithPassword(v.email.trim(), v.password)
      toast("Eingerichtet. Willkommen!")
      onDone()
    } catch (e2) {
      setErr(e2?.response?.message || errMsg(e2))
    } finally { setBusy(false) }
  }

  const own = (k) => ({
    // until edited, Kürzel follows the club name and Präfix follows the Kürzel
    value: k === "org_short" ? short : touched.inv_prefix ? v.inv_prefix : normCode(short).slice(0, 6),
    onInput: (e) => {
      const val = k === "inv_prefix" ? normCode(e.target.value).slice(0, 6) : e.target.value
      setTouched((t) => ({ ...t, [k]: true }))
      setV((x) => ({ ...x, [k]: val }))
    },
  })

  return html`<div class="login">
    <form class="login-card setup" onSubmit=${submit}>
      <div class="brand">
        <span class="brand-logo"><${Icon} name="spot" /></span>
        <span class="brand-text"><b>Showlager einrichten</b><small>Einmalig beim ersten Start</small></span>
      </div>

      <section class="section">
        <${Field} label="Einrichtungscode" hint="Steht im Server-Log, z. B. mit docker compose logs pocketbase.">
          <input id="setup-code" class="mono" required autocomplete="off" spellcheck="false" placeholder="XXXX-XXXX" ...${bind("code")} /><//>
      </section>

      <section class="section">
        <h2>Verein</h2>
        <${Field} label="Name des Vereins"><input id="setup-org" required maxlength="120" placeholder="z. B. Theaterverein Musterstadt" ...${bind("org_name")} /><//>
        <div class="grid2" style="grid-template-columns:1fr 1fr">
          <${Field} label="Kürzel" hint="Für das Logo"><input id="setup-short" maxlength="5" placeholder="TVM" ...${own("org_short")} /><//>
          <${Field} label="Präfix Inventarnummer" hint=${`Erste Nummer: ${prefix}-0001`}><input id="setup-prefix" class="mono" maxlength="6" placeholder="INV" ...${own("inv_prefix")} /><//>
        </div>
      </section>

      <section class="section">
        <h2>Dein Admin-Konto</h2>
        <${Field} label="Name"><input id="setup-name" required autocomplete="name" ...${bind("name")} /><//>
        <${Field} label="E-Mail"><input id="setup-email" type="email" required autocomplete="username" ...${bind("email")} /><//>
        <div class="grid2" style="grid-template-columns:1fr 1fr">
          <${Field} label="Passwort" hint="Mindestens 8 Zeichen"><input id="setup-pw" type="password" required minlength="8" autocomplete="new-password" ...${bind("password")} /><//>
          <${Field} label="Wiederholen"><input id="setup-pw2" type="password" required minlength="8" autocomplete="new-password" ...${bind("password2")} /><//>
        </div>
      </section>

      ${err ? html`<p class="err">${err}</p>` : null}
      <button class="btn primary" disabled=${busy}>${busy ? "Wird eingerichtet…" : "Einrichten und anmelden"}</button>
      <p class="muted" style="font-size:13px">Name, Kürzel und Präfix lassen sich später unter Einstellungen ändern. Weitere Mitglieder legst du danach unter Mitglieder an.</p>
    </form>
  </div>`
}

function getTheme() { try { return localStorage.getItem("inventar-theme") || "system" } catch { return "system" } }
function setTheme(t) {
  try { t === "system" ? localStorage.removeItem("inventar-theme") : localStorage.setItem("inventar-theme", t) } catch {}
  if (t === "system") delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = t
}

export function Account() {
  const user = me()
  const [name, setName] = useState(user?.name || "")
  const [pw, setPw, bindPw] = useForm({ oldPassword: "", password: "", passwordConfirm: "" })
  const [theme, setThemeState] = useState(getTheme())
  const [busy, setBusy] = useState(false)

  const saveName = async (e) => {
    e.preventDefault()
    try { await save("users", user.id, { name: name.trim() }); await pb.collection("users").authRefresh(); toast("Name gespeichert") } catch (err) { toast(errMsg(err), true) }
  }
  const savePw = async (e) => {
    e.preventDefault()
    if (pw.password !== pw.passwordConfirm) { toast("Die neuen Passwörter stimmen nicht überein.", true); return }
    setBusy(true)
    try {
      await pb.collection("users").update(user.id, pw)
      await pb.collection("users").authWithPassword(user.email, pw.password) // old tokens are invalid now
      setPw({ oldPassword: "", password: "", passwordConfirm: "" })
      toast("Passwort geändert")
    } catch (err) { toast(errMsg(err), true) } finally { setBusy(false) }
  }

  return html`<div class="wrap narrow">
    <${Head} title=${html`<h1>Konto</h1>`} sub=${`${user?.email} · ${user?.role === "admin" ? "Admin" : "Mitglied"}`}
      actions=${html`<button class="btn" onClick=${() => pb.authStore.clear()}><${Icon} name="logout" />Abmelden</button>`} />

    <form class="section" onSubmit=${saveName}>
      <h2>Name</h2>
      <div class="row"><input class="input" style="flex:1;min-width:200px" value=${name} onInput=${(e) => setName(e.target.value)} aria-label="Name" />
        <button class="btn">Speichern</button></div>
    </form>

    <section class="section">
      <h2>Darstellung</h2>
      <div class="seg" role="radiogroup" aria-label="Farbschema">
        ${[["system", "Wie Gerät"], ["light", "Hell"], ["dark", "Dunkel"]].map(([k, l]) => html`<label>
          <input type="radio" name="theme" checked=${theme === k} onChange=${() => { setTheme(k); setThemeState(k) }} /><span>${l}</span></label>`)}
      </div>
    </section>

    <form class="section" onSubmit=${savePw}>
      <h2>Passwort ändern</h2>
      <div class="grid3">
        <${Field} label="Aktuelles Passwort"><input type="password" autocomplete="current-password" required ...${bindPw("oldPassword")} /><//>
        <${Field} label="Neues Passwort" hint="Mindestens 8 Zeichen"><input type="password" autocomplete="new-password" minlength="8" required ...${bindPw("password")} /><//>
        <${Field} label="Wiederholen"><input type="password" autocomplete="new-password" minlength="8" required ...${bindPw("passwordConfirm")} /><//>
      </div>
      <div><button class="btn" disabled=${busy}>Passwort ändern</button></div>
    </form>
  </div>`
}

const genPassword = () => {
  const words = ["Scheinwerfer", "Nebel", "Bühne", "Vorhang", "Spot", "Kulisse", "Gobo", "Fader", "Traverse", "Kabel", "Strobe", "Zauber"]
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
    try { await save("users", u.id, { role }); toast(`${u.name || u.email} ist jetzt ${role === "admin" ? "Admin" : "Mitglied"}`) } catch (err) { toast(errMsg(err), true) }
  }
  const [pwFor, setPwFor] = useState(null) // { user, value }
  const setPassword = async (e) => {
    e.preventDefault()
    const { user, value } = pwFor
    if (value.length < 8) { toast("Das Passwort braucht mindestens 8 Zeichen.", true); return }
    setBusy(true)
    try {
      await save("users", user.id, { password: value, passwordConfirm: value })
      setPwFor(null)
      setCreated({ email: user.email, password: value })
      toast(`Passwort für ${user.name || user.email} geändert`)
    } catch (err) { toast(errMsg(err), true) } finally { setBusy(false) }
  }
  const del = async (u) => {
    if (!(await confirmDialog(`Konto von ${u.name || u.email} löschen? Einträge im Verlauf bleiben ohne Namen erhalten.`))) return
    try { await remove("users", u.id); toast("Konto gelöscht") } catch (err) { toast(errMsg(err), true) }
  }

  if (!isAdmin()) return html`<div class="wrap"><p>Nur für Admins.</p></div>`
  return html`<div class="wrap narrow">
    <${Head} title=${html`<h1>Mitglieder</h1>`} sub="Wer sich anmelden darf. Mitglieder können alles anlegen und bearbeiten, löschen dürfen nur Admins." />

    ${created ? html`<div class="hint stack">
      <b>Zugangsdaten weitergeben:</b>
      <span class="mono" style="user-select:all">${location.origin} · ${created.email} · ${created.password}</span>
      <div class="row"><button class="btn sm" onClick=${() => navigator.clipboard?.writeText(`${location.origin}\nE-Mail: ${created.email}\nPasswort: ${created.password}`).then(() => toast("Kopiert"), () => toast("Kopieren nicht möglich, bitte markieren.", true))}>
        <${Icon} name="copy" />Kopieren</button><button class="btn sm ghost" onClick=${() => setCreated(null)}>Schließen</button></div>
    </div>` : null}

    <div class="tablewrap"><table class="t"><thead><tr><th>Name</th><th>Rolle</th><th>Seit</th><th></th></tr></thead><tbody>
      ${s.users.map((u) => html`<tr style="cursor:default">
        <td><b>${u.name || "—"}</b><span class="sub">${u.email}</span></td>
        <td><select class="input" style="min-height:34px;width:auto" value=${u.role || "member"} disabled=${u.id === me()?.id}
          onChange=${(e) => setRole(u, e.target.value)} aria-label="Rolle"><option value="member">Mitglied</option><option value="admin">Admin</option></select></td>
        <td class="muted">${fmtDate(u.created)}</td>
        <td><div class="row" style="justify-content:flex-end">
          <button class="btn sm" onClick=${() => setPwFor({ user: u, value: genPassword() })}>Passwort ändern</button>
          ${u.id !== me()?.id ? html`<button class="btn sm danger icon" aria-label="Löschen" onClick=${() => del(u)}><${Icon} name="trash" /></button>` : null}
        </div></td>
      </tr>`)}
    </tbody></table></div>

    <form class="panel" onSubmit=${add}>
      <h2>Neues Mitglied</h2>
      <div class="grid2">
        <${Field} label="Name"><input id="m-name" required ...${bind("name")} /><//>
        <${Field} label="E-Mail"><input id="m-email" type="email" required ...${bind("email")} /><//>
        <${Field} label="Startpasswort" hint="Kann das Mitglied später unter Konto ändern"><input id="m-pw" class="mono" required minlength="8" ...${bind("password")} /><//>
        <${Field} label="Rolle"><select id="m-role" ...${bind("role")}><option value="member">Mitglied</option><option value="admin">Admin</option></select><//>
      </div>
      <div><button class="btn primary" disabled=${busy}><${Icon} name="plus" />Konto anlegen</button></div>
    </form>

    ${pwFor ? html`<div class="modal-back" onClick=${(e) => e.target === e.currentTarget && setPwFor(null)}
      onKeyDown=${(e) => e.key === "Escape" && setPwFor(null)}>
      <form class="modal" role="dialog" aria-modal="true" aria-labelledby="pw-title" onSubmit=${setPassword}>
        <h3 id="pw-title">Passwort für ${pwFor.user.name || pwFor.user.email}</h3>
        <label class="field"><span>Neues Passwort</span>
          <div class="row" style="flex-wrap:nowrap">
            <input id="pw-new" class="mono" style="flex:1" minlength="8" required autocomplete="new-password" value=${pwFor.value}
              ref=${(n) => n && !n.dataset.f && (n.dataset.f = 1, n.focus(), n.select())}
              onInput=${(e) => setPwFor({ ...pwFor, value: e.target.value })} />
            <button type="button" class="btn" title="Neues Zufallspasswort" onClick=${() => setPwFor({ ...pwFor, value: genPassword() })}>Zufällig</button>
          </div>
          <small>Mindestens 8 Zeichen. Das alte Passwort gilt danach nicht mehr, das Mitglied wird auf allen Geräten abgemeldet.</small>
        </label>
        <div class="row" style="justify-content:flex-end">
          <button type="button" class="btn ghost" onClick=${() => setPwFor(null)}>Abbrechen</button>
          <button class="btn primary" disabled=${busy}>Passwort setzen</button>
        </div>
      </form>
    </div>` : null}
  </div>`
}

export function More() {
  return html`<div class="wrap narrow">
    <${Head} title=${html`<h1>Mehr</h1>`} />
    <nav class="files">
      <a class="file" href="#/etiketten"><${Icon} name="tag" /><span>Etiketten drucken</span></a>
      <a class="file" href="#/typen"><${Icon} name="spot" /><span>Gerätetypen</span></a>
      ${isAdmin() ? html`<a class="file" href="#/mitglieder"><${Icon} name="users" /><span>Mitglieder</span></a>
        <a class="file" href="#/einstellungen"><${Icon} name="sliders" /><span>Einstellungen</span></a>` : null}
      <a class="file" href="#/konto"><${Icon} name="user" /><span>Konto & Darstellung</span></a>
      <button class="file btn" style="justify-content:flex-start;text-transform:none;font:inherit" onClick=${() => pb.authStore.clear()}><${Icon} name="logout" /><span>Abmelden</span></button>
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
    if (!s.settings) { toast("Einstellungen fehlen auf dem Server.", true); return }
    setBusy(true)
    try {
      await save("settings", s.settings.id, {
        org_name: v.org_name.trim(),
        org_short: v.org_short.trim().slice(0, 5),
        inv_prefix: (v.inv_prefix || "").toUpperCase().replace(/[^A-Z0-9]/g, ""),
      })
      toast("Einstellungen gespeichert")
    } catch (err) { toast(errMsg(err), true) } finally { setBusy(false) }
  }

  if (!isAdmin()) return html`<div class="wrap"><p>Nur für Admins.</p></div>`
  return html`<div class="wrap narrow">
    <${Head} title=${html`<h1>Einstellungen</h1>`} sub="Gilt für alle Mitglieder." />
    <form class="form" onSubmit=${submit}>
      <section class="section">
        <h2>Verein</h2>
        <div class="grid2">
          <${Field} label="Name des Vereins" hint="Erscheint in der Seitenleiste und als Feld {Verein} auf Etiketten.">
            <input id="s-name" maxlength="120" ...${bind("org_name")} placeholder="z. B. Theaterverein Musterstadt" /><//>
          <${Field} label="Kürzel" hint="Bis zu 5 Zeichen, für das Logo oben links und den Browser-Tab.">
            <input id="s-short" maxlength="5" ...${bind("org_short")} placeholder="z. B. TVM" /><//>
        </div>
      </section>
      <section class="section">
        <h2>Inventarnummern</h2>
        <div class="grid2">
          <${Field} label="Präfix" hint=${`Nur A–Z und 0–9. Das nächste neue Teil bekommt ${next}. Bestehende Nummern bleiben unverändert.`}>
            <input id="s-prefix" class="mono" maxlength="6" ...${bind("inv_prefix")} placeholder="INV"
              onInput=${(e) => setV((x) => ({ ...x, inv_prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") }))} /><//>
        </div>
      </section>
      <div class="form-foot">
        <button class="btn primary" disabled=${busy}><${Icon} name="check" />Speichern</button>
      </div>
    </form>
  </div>`
}

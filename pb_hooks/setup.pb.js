/// <reference path="../pb_data/types.d.ts" />

// print the setup code when the server starts (not for CLI commands like `superuser upsert`)
onBootstrap((e) => {
  e.next()
  if ($os.args.indexOf("serve") < 0) return
  require(`${__hooks}/setup_lib.js`).ensureCode(e.app)
})

routerAdd("GET", "/api/setup", (e) => {
  const lib = require(`${__hooks}/setup_lib.js`)
  const needed = lib.needsSetup(e.app)
  if (needed) lib.ensureCode(e.app)
  return e.json(200, { needed })
})

routerAdd("POST", "/api/setup", (e) => {
  const lib = require(`${__hooks}/setup_lib.js`)
  if (!lib.needsSetup(e.app)) throw new ForbiddenError("Diese Instanz ist bereits eingerichtet.")

  const body = e.requestInfo().body
  if (!lib.norm(body.code) || lib.norm(body.code) !== lib.norm(lib.ensureCode(e.app))) {
    lib.registerFailure(e.app)
    throw new BadRequestError("Der Einrichtungscode stimmt nicht. Er steht im Server-Log.")
  }

  const name = String(body.name || "").trim()
  const email = String(body.email || "").trim()
  const password = String(body.password || "")
  if (!name) throw new BadRequestError("Bitte deinen Namen eingeben.")
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestError("Bitte eine gültige E-Mail-Adresse eingeben.")
  if (password.length < 8) throw new BadRequestError("Das Passwort braucht mindestens 8 Zeichen.")

  e.app.runInTransaction((tx) => {
    if (tx.countRecords("users") > 0) throw new ForbiddenError("Diese Instanz ist bereits eingerichtet.")

    const user = new Record(tx.findCollectionByNameOrId("users"))
    user.setEmail(email)
    user.setPassword(password)
    user.setVerified(true)
    user.set("name", name)
    user.set("role", "admin")
    tx.save(user)

    const rows = tx.findRecordsByFilter("settings", "", "", 1, 0)
    if (rows.length) {
      const s = rows[0]
      s.set("org_name", String(body.org_name || "").trim().slice(0, 120))
      s.set("org_short", String(body.org_short || "").trim().slice(0, 5))
      s.set("inv_prefix", lib.norm(body.inv_prefix).slice(0, 6))
      tx.save(s)
    }
  })

  lib.clear(e.app)
  return e.json(200, { ok: true })
})

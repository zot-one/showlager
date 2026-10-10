/// <reference path="../pb_data/types.d.ts" />

// First-run setup: while no app account exists, a one-time code is printed to the server log.
// Whoever can read the log can create the first admin in the app. Kept in the app store (memory only).

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O, 1/I
const KEY = "setupCode"
const FAILS = "setupFailures"
const MAX_FAILS = 10

function needsSetup(app) {
  try {
    return app.countRecords("users") === 0
  } catch (e) {
    return false
  }
}

function newCode(app, reason) {
  const raw = $security.randomStringWithAlphabet(8, ALPHABET)
  const code = raw.slice(0, 4) + "-" + raw.slice(4)
  app.store().set(KEY, code)
  app.store().set(FAILS, 0)
  const line = "──────────────────────────────────────────────────────"
  console.log([
    "",
    line,
    "  Showtechnik-Inventar ist noch nicht eingerichtet." + (reason ? " (" + reason + ")" : ""),
    "  Einrichtungscode: " + code,
    "  Öffne die App im Browser und gib den Code dort ein.",
    line,
    "",
  ].join("\n"))
  return code
}

function ensureCode(app) {
  if (!needsSetup(app)) return ""
  return app.store().get(KEY) || newCode(app)
}

// counts a wrong attempt; after MAX_FAILS the code is replaced and the new one logged
function registerFailure(app) {
  const fails = (app.store().get(FAILS) || 0) + 1
  app.store().set(FAILS, fails)
  if (fails >= MAX_FAILS) newCode(app, "neuer Code nach " + MAX_FAILS + " Fehlversuchen")
}

function clear(app) {
  app.store().remove(KEY)
  app.store().remove(FAILS)
}

const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "")

module.exports = { needsSetup, ensureCode, registerFailure, clear, norm }

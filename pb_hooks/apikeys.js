/// <reference path="../pb_data/types.d.ts" />

// API keys act as their owner (an admin) with restrictions: no deletes, inventory endpoints only,
// read-only keys may only read. Format: "sl_" + 40 random characters. Only the SHA-256 hash is stored.

const PREFIX = "sl_"
const KEY_RE = /^(?:Bearer\s+)?(sl_[A-Za-z0-9]{20,})$/

const READ = ["items", "fixture_types", "locations", "changes", "users", "settings"]
const WRITE = ["items", "fixture_types", "locations"]

function fromHeader(header) {
  const m = String(header || "").trim().match(KEY_RE)
  return m ? m[1] : ""
}

function generate() {
  return PREFIX + $security.randomString(40)
}

const hash = (key) => $security.sha256(key)

// → { id, name, access, owner } or null
function authenticate(app, key) {
  let rec
  try {
    rec = app.findFirstRecordByFilter("api_keys", "key_hash = {:h}", { h: hash(key) })
  } catch (e) {
    return null
  }
  let owner
  try {
    owner = app.findRecordById("users", rec.getString("owner"))
  } catch (e) {
    return null
  }
  // remember usage, at most every 5 minutes
  const last = rec.getDateTime("last_used")
  if (last.isZero() || Date.now() - last.unix() * 1000 > 5 * 60 * 1000) {
    rec.set("last_used", new DateTime())
    try { app.unsafeWithoutHooks().save(rec) } catch (e) { /* not critical */ }
  }
  return { id: rec.id, name: rec.getString("name"), access: rec.getString("access"), owner }
}

// → null if allowed, otherwise the reason
function guard(app, method, path, access) {
  const m = String(method).toUpperCase()
  const read = m === "GET" || m === "HEAD"
  if (m === "DELETE") return "API keys cannot delete anything. Ask a person to delete it in the app."
  if (path === "/mcp" || path === "/api/health") return null
  if (path === "/api/gdtf/parse" && m === "POST") return null
  if (path.indexOf("/api/upload/") === 0) return null
  if (path.indexOf("/api/files/") === 0 && read) return null

  const match = path.match(/^\/api\/collections\/([^/]+)\/records(?:\/[^/]+)?\/?$/)
  if (!match) return "This endpoint is not available for API keys."
  let name = match[1]
  try { name = app.findCollectionByNameOrId(match[1]).name } catch (e) { /* unknown collection, checked below */ }
  if (read) return READ.indexOf(name) >= 0 ? null : "API keys cannot read '" + name + "'."
  if (access !== "write") return "This API key is read-only."
  return WRITE.indexOf(name) >= 0 ? null : "API keys cannot modify '" + name + "'."
}

module.exports = { fromHeader, generate, hash, authenticate, guard }

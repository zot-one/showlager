/// <reference path="../pb_data/types.d.ts" />

// ---------- API keys: "Authorization: Bearer sl_…" acts as the key's owner, with restrictions.
// Runs after PocketBase's own token middleware, which ignores tokens it doesn't understand.
routerUse((e) => {
  const keys = require(`${__hooks}/apikeys.js`)
  const raw = keys.fromHeader(e.request.header.get("Authorization"))
  if (!raw) return e.next()

  const key = keys.authenticate(e.app, raw)
  if (!key) throw new UnauthorizedError("Invalid or revoked API key.")
  const denied = keys.guard(e.app, e.request.method, e.request.url.path, key.access)
  if (denied) throw new ForbiddenError(denied)

  e.auth = key.owner
  e.set("apiKey", { id: key.id, name: key.name, access: key.access })
  return e.next()
})

// admins create keys here; the plain key is returned exactly once
routerAdd("POST", "/api/keys", (e) => {
  if (e.get("apiKey")) throw new ForbiddenError("API keys cannot create API keys.")
  if (!e.auth || e.auth.collection().name !== "users" || e.auth.getString("role") !== "admin") {
    throw new ForbiddenError("Only admins can create API keys.")
  }
  const body = e.requestInfo().body || {}
  const name = String(body.name || "").trim()
  if (!name) throw new BadRequestError("Give the key a name, e.g. the agent or script that uses it.")
  const access = body.access === "write" ? "write" : "read"

  const keys = require(`${__hooks}/apikeys.js`)
  const plain = keys.generate()
  const rec = new Record(e.app.findCollectionByNameOrId("api_keys"))
  rec.set("name", name.slice(0, 80))
  rec.set("key_hash", keys.hash(plain))
  rec.set("hint", plain.slice(0, 7) + "…" + plain.slice(-4))
  rec.set("access", access)
  rec.set("owner", e.auth.id)
  e.app.save(rec)
  return e.json(200, { id: rec.id, name: rec.getString("name"), access, hint: rec.getString("hint"), key: plain })
}, $apis.requireAuth("users"))

// GDTF preview for the app (and agents): parse without saving
routerAdd("POST", "/api/gdtf/parse", (e) => {
  const files = e.findUploadedFiles("file")
  if (!files || !files.length) throw new BadRequestError("Send the GDTF file as multipart/form-data in the field 'file'.")
  const gdtf = require(`${__hooks}/gdtf.js`)
  let parsed
  try {
    parsed = gdtf.parse(gdtf.fileBytes(files[0]))
  } catch (err) {
    throw new BadRequestError(err && err.message ? err.message : String(err))
  }
  return e.json(200, {
    manufacturer: parsed.manufacturer,
    model: parsed.model,
    modes: parsed.modes,
    thumbnail: parsed.thumbnail ? { name: parsed.thumbnail.name, base64: gdtf.base64(parsed.thumbnail.bytes) } : null,
  })
}, $apis.requireAuth("users"))

// one-time upload links (created by the MCP tool create_upload_link)
routerAdd("POST", "/api/upload/{token}", (e) => require(`${__hooks}/uploads.js`).handle(e))

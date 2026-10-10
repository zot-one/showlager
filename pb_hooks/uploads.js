/// <reference path="../pb_data/types.d.ts" />

// One-time upload links, so agents can send large files (GDTF, manuals, photos) with
//   curl -F "file=@fixture.gdtf" <url>
// instead of base64 inside a tool call. Valid for 15 minutes, single use, kept in memory only.

const TTL_MS = 15 * 60 * 1000

function baseUrl(e) {
  const h = (name) => e.request.header.get(name)
  const proto = h("X-Forwarded-Proto") || (e.request.tls ? "https" : "http")
  const host = h("X-Forwarded-Host") || e.request.host
  return proto + "://" + host
}

// data: { target: "gdtf" | "manual" | "item_photo", recordId, actorId, via }
function create(e, data) {
  const token = $security.randomString(40)
  const expires = Date.now() + TTL_MS
  e.app.store().set("upload:" + token, Object.assign({}, data, { expires }))
  const url = baseUrl(e) + "/api/upload/" + token
  return {
    url,
    method: "POST",
    form_field: "file",
    expires_at: new Date(expires).toISOString(),
    curl: 'curl -F "file=@/path/to/file" ' + url,
  }
}

function saveOrExplain(app, rec) {
  try {
    app.save(rec)
  } catch (err) {
    throw new BadRequestError("Could not save the file: " + (err && err.message ? err.message : String(err)))
  }
}

// attach an uploaded/created filesystem.File according to the link data; returns a JSON-able result
function attach(app, data, file, bytes) {
  const lib = require(`${__hooks}/lib.js`)
  const gdtf = require(`${__hooks}/gdtf.js`)

  if (data.target === "item_photo") {
    const rec = app.findRecordById("items", data.recordId)
    const before = lib.snapshot(rec)
    rec.set("photos+", file)
    saveOrExplain(app, rec)
    lib.logChange(app, rec, before, "update", data.actorId, data.via)
    return { ok: true, inv_no: rec.getString("inv_no"), photos: rec.getStringSlice("photos").length }
  }

  if (data.target === "manual") {
    const rec = app.findRecordById("fixture_types", data.recordId)
    rec.set("manual+", file)
    saveOrExplain(app, rec)
    return { ok: true, fixture_type: rec.getString("manufacturer") + " " + rec.getString("model"), manuals: rec.getStringSlice("manual") }
  }

  if (data.target === "gdtf") {
    let parsed
    try {
      parsed = gdtf.parse(bytes || gdtf.fileBytes(file))
    } catch (err) {
      throw new BadRequestError("GDTF: " + (err && err.message ? err.message : String(err)))
    }
    const rec = data.recordId
      ? app.findRecordById("fixture_types", data.recordId)
      : new Record(app.findCollectionByNameOrId("fixture_types"))
    rec.set("gdtf", file)
    gdtf.applyToType(rec, parsed, true)
    saveOrExplain(app, rec)
    return {
      ok: true,
      fixture_type: { id: rec.id, manufacturer: rec.getString("manufacturer"), model: rec.getString("model") },
      modes: parsed.modes.map((m) => ({ name: m.name, channels: m.footprint })),
    }
  }

  throw new BadRequestError("Unknown upload target.")
}

function handle(e) {
  const key = "upload:" + e.request.pathValue("token")
  const data = e.app.store().get(key)
  if (!data || data.expires < Date.now()) {
    e.app.store().remove(key)
    throw new NotFoundError("This upload link is invalid or has expired. Create a new one.")
  }
  const files = e.findUploadedFiles("file")
  if (!files || !files.length) throw new BadRequestError("Send the file as multipart/form-data in the field 'file'.")
  e.app.store().remove(key) // single use
  return e.json(200, attach(e.app, data, files[0]))
}

module.exports = { create, handle, attach, baseUrl }

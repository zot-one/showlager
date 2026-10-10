/// <reference path="../pb_data/types.d.ts" />

// Shared helpers for main.pb.js. JSVM handlers run in isolated scopes,
// so every handler require()s this module itself.

const DMX_FIELDS = ["dmx_universe", "dmx_address", "dmx_mode"]
const SKIP_DIFF = ["id", "created", "updated", "inv_no", "dmx_set_at", "dmx_set_by"]

function pad(n, len) {
  let s = String(n)
  while (s.length < len) s = "0" + s
  return s
}

// prefix comes from settings.inv_prefix (set in the app), e.g. "INV" → INV-0001
function invPrefix(app) {
  try {
    const rows = app.findRecordsByFilter("settings", "", "", 1, 0)
    const p = rows.length ? rows[0].getString("inv_prefix") : ""
    return p.toUpperCase().replace(/[^A-Z0-9]/g, "") || "INV"
  } catch (e) {
    return "INV"
  }
}

function nextInvNo(app) {
  const prefix = invPrefix(app) + "-"
  const last = app.findRecordsByFilter("items", "inv_no ~ {:p}", "-inv_no", 1, 0, { p: prefix + "%" })
  const n = last.length ? parseInt(last[0].getString("inv_no").slice(prefix.length), 10) || 0 : 0
  return prefix + pad(n + 1, 4)
}

function authUserId(e) {
  return e.auth && e.auth.collection().name === "users" ? e.auth.id : ""
}

// Plain string snapshot of all diffable fields, comparable before/after save.
function snapshot(rec) {
  const out = {}
  const fields = rec.collection().fields
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]
    const name = f.getName()
    if (SKIP_DIFF.indexOf(name) >= 0) continue
    out[name] = f.type() === "file" ? rec.getStringSlice(name).join(", ") : rec.getString(name)
  }
  return out
}

// Server-owned fields: inv_no is assigned once, DMX stamp follows real DMX changes.
function prepareItem(e, isCreate) {
  const rec = e.record
  const orig = isCreate ? null : rec.original()

  if (isCreate) {
    rec.set("inv_no", nextInvNo(e.app))
    if (rec.getInt("quantity") < 1) rec.set("quantity", 1)
    if (!rec.getString("condition")) rec.set("condition", "ok")
  } else {
    rec.set("inv_no", orig.getString("inv_no"))
  }

  const dmxChanged = isCreate
    ? rec.getInt("dmx_address") > 0 || rec.getString("dmx_mode") !== ""
    : DMX_FIELDS.some((f) => orig.getString(f) !== rec.getString(f))

  if (dmxChanged) {
    rec.set("dmx_set_at", new DateTime())
    rec.set("dmx_set_by", authUserId(e))
  } else if (isCreate) {
    rec.set("dmx_set_at", "")
    rec.set("dmx_set_by", "")
  } else {
    rec.set("dmx_set_at", orig.getString("dmx_set_at"))
    rec.set("dmx_set_by", orig.getString("dmx_set_by"))
  }
}

function logChange(e, before, action) {
  try {
    const after = snapshot(e.record)
    const diff = {}
    for (const k in after) {
      if (before) {
        if (before[k] !== after[k]) diff[k] = [before[k], after[k]]
      } else if (after[k] !== "" && after[k] !== "0") {
        diff[k] = [null, after[k]]
      }
    }
    if (action === "update" && Object.keys(diff).length === 0) return

    const rec = new Record(e.app.findCollectionByNameOrId("changes"))
    rec.set("item", e.record.id)
    rec.set("user", authUserId(e))
    rec.set("action", action)
    rec.set("diff", diff)
    e.app.save(rec)
  } catch (err) {
    e.app.logger().error("change log failed", "item", e.record.id, "error", String(err))
  }
}

module.exports = { prepareItem, snapshot, logChange }

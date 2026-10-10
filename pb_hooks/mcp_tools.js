/// <reference path="../pb_data/types.d.ts" />

// MCP tools. Items are addressed by inventory number, locations and fixture types by name.
// ctx = { app, e, actorId, via, write }

const COND_TO_DB = { ok: "ok", defective: "defekt", in_repair: "reparatur", missing: "verschollen", defekt: "defekt", reparatur: "reparatur", verschollen: "verschollen" }
const COND_FROM_DB = { ok: "ok", defekt: "defective", reparatur: "in_repair", verschollen: "missing" }
const CONDITIONS = ["ok", "defective", "in_repair", "missing"]

class ToolError extends Error {}
const fail = (msg) => { throw new ToolError(msg) }
const pad3 = (n) => ("00" + n).slice(-3)
const lower = (s) => String(s || "").trim().toLowerCase()

function needWrite(ctx) {
  if (!ctx.write) fail("This API key is read-only. Ask an admin for a key with write access.")
}

// ---------- lookups
function jsonField(rec, name) {
  const raw = rec.getString(name)
  if (!raw) return []
  try { return JSON.parse(raw) || [] } catch (e) { return [] }
}
function allTypes(app) { return app.findRecordsByFilter("fixture_types", "", "manufacturer,model", 0, 0) }
function allLocations(app) { return app.findRecordsByFilter("locations", "", "name", 0, 0) }
const typeLabel = (t) => (t ? t.getString("manufacturer") + " " + t.getString("model") : null)

function findItem(app, invNo) {
  const n = String(invNo || "").trim().toUpperCase()
  if (!n) fail("inv_no is required, e.g. \"INV-0042\".")
  try {
    return app.findFirstRecordByFilter("items", "inv_no = {:n}", { n })
  } catch (e) {
    fail("No item with inventory number " + n + ". Use search_items to find it.")
  }
}

function findType(app, ref, required) {
  const q = lower(ref)
  if (!q) return required ? fail("fixture_type is required.") : null
  const types = allTypes(app)
  const exact = types.filter((t) => t.id === ref || lower(typeLabel(t)) === q || lower(t.getString("model")) === q)
  if (exact.length === 1) return exact[0]
  const partial = types.filter((t) => lower(typeLabel(t)).indexOf(q) >= 0)
  if (partial.length === 1) return partial[0]
  const options = (exact.length ? exact : partial).map(typeLabel)
  fail(options.length
    ? "\"" + ref + "\" matches several fixture types: " + options.join(", ") + ". Be more specific."
    : "No fixture type \"" + ref + "\". Use list_fixture_types, or create_fixture_type / upload_gdtf first.")
}

function findLocation(app, ref) {
  const q = lower(ref)
  if (!q) return null
  const locs = allLocations(app)
  const exact = locs.filter((l) => l.id === ref || lower(l.getString("name")) === q)
  if (exact.length === 1) return exact[0]
  const partial = locs.filter((l) => lower(l.getString("name")).indexOf(q) >= 0)
  if (partial.length === 1) return partial[0]
  fail(partial.length
    ? "\"" + ref + "\" matches several locations: " + partial.map((l) => l.getString("name")).join(", ") + "."
    : "No location \"" + ref + "\". Use list_locations, or create_location first.")
}

function userName(app, id) {
  if (!id) return null
  try { const u = app.findRecordById("users", id); return u.getString("name") || u.getString("email") } catch (e) { return null }
}

function modeOf(type, modeName) {
  const modes = type ? jsonField(type, "modes") : []
  return modes.filter((m) => m.name === modeName)[0] || (modes.length === 1 ? modes[0] : null)
}

function fileUrl(ctx, rec, name) {
  return require(`${__hooks}/uploads.js`).baseUrl(ctx.e) + "/api/files/" + rec.collection().id + "/" + rec.id + "/" + encodeURIComponent(name)
}

// ---------- serialisation
function dmxOf(app, item, type) {
  const addr = item.getInt("dmx_address")
  if (addr < 1) return null
  const mode = modeOf(type, item.getString("dmx_mode"))
  const fp = mode ? mode.footprint || 1 : 1
  const u = item.getInt("dmx_universe") || 1
  return {
    universe: u, address: addr, end: addr + fp - 1, channels: fp,
    mode: item.getString("dmx_mode") || null, mode_known: !!mode,
    label: u + "." + pad3(addr) + (fp > 1 ? "-" + pad3(addr + fp - 1) : ""),
    set_at: item.getString("dmx_set_at") || null, set_by: userName(app, item.getString("dmx_set_by")),
  }
}

function itemSummary(app, item, cache) {
  const type = item.getString("type") ? cache.type(item.getString("type")) : null
  const loc = item.getString("location") ? cache.loc(item.getString("location")) : null
  return {
    inv_no: item.getString("inv_no"),
    name: item.getString("name"),
    category: item.getString("category") || null,
    quantity: item.getInt("quantity") || 1,
    condition: COND_FROM_DB[item.getString("condition")] || item.getString("condition"),
    fixture_type: typeLabel(type),
    location: loc ? loc.getString("name") : null,
    sublocation: item.getString("sublocation") || null,
    dmx: dmxOf(app, item, type),
  }
}

function makeCache(app) {
  const types = {}, locs = {}
  allTypes(app).forEach((t) => { types[t.id] = t })
  allLocations(app).forEach((l) => { locs[l.id] = l })
  return { type: (id) => types[id] || null, loc: (id) => locs[id] || null }
}

function itemDetail(ctx, item) {
  const app = ctx.app
  const cache = makeCache(app)
  const out = itemSummary(app, item, cache)
  const type = item.getString("type") ? cache.type(item.getString("type")) : null
  out.serial = item.getString("serial") || null
  out.notes = item.getString("notes") || null
  out.photos = item.getStringSlice("photos").map((p) => fileUrl(ctx, item, p))
  out.created = item.getString("created")
  out.updated = item.getString("updated")
  if (type) {
    out.fixture_type_details = {
      modes: jsonField(type, "modes").map((m) => ({ name: m.name, channels: m.footprint })),
      gdtf: type.getString("gdtf") ? fileUrl(ctx, type, type.getString("gdtf")) : null,
      manuals: type.getStringSlice("manual").map((f) => fileUrl(ctx, type, f)),
    }
  }
  const history = app.findRecordsByFilter("changes", "item = {:id}", "-created", 10, 0, { id: item.id })
  out.history = history.map((h) => ({
    at: h.getString("created"), by: userName(app, h.getString("user")), via: h.getString("via") || null,
    action: h.getString("action"), changes: JSON.parse(h.getString("diff") || "{}"),
  }))
  return out
}

function typeSummary(app, t) {
  const count = app.countRecords("items", $dbx.hashExp({ type: t.id }))
  return {
    id: t.id, manufacturer: t.getString("manufacturer"), model: t.getString("model"),
    modes: jsonField(t, "modes").map((m) => ({ name: m.name, channels: m.footprint })),
    items: count, has_gdtf: !!t.getString("gdtf"), manuals: t.getStringSlice("manual").length,
  }
}

// ---------- item writes (same rules as the app: inventory number, DMX stamp, history)
function applyItemFields(app, rec, a) {
  const set = (k, v) => { if (v !== undefined) rec.set(k, v === null ? "" : v) }
  set("name", a.name !== undefined ? String(a.name).trim() : undefined)
  set("category", a.category)
  set("serial", a.serial)
  set("notes", a.notes)
  set("sublocation", a.sublocation)
  if (a.quantity !== undefined) rec.set("quantity", Math.max(1, Math.round(Number(a.quantity) || 1)))
  if (a.condition !== undefined) {
    const c = COND_TO_DB[lower(a.condition)]
    if (!c) fail("condition must be one of: " + CONDITIONS.join(", "))
    rec.set("condition", c)
  }
  if (a.fixture_type !== undefined) rec.set("type", a.fixture_type ? findType(app, a.fixture_type, true).id : "")
  if (a.location !== undefined) rec.set("location", a.location ? findLocation(app, a.location).id : "")
  if (a.dmx_mode !== undefined) rec.set("dmx_mode", a.dmx_mode || "")
  if (a.dmx_address !== undefined) {
    const addr = a.dmx_address ? Number(a.dmx_address) : 0
    if (addr && (addr < 1 || addr > 512 || addr !== Math.round(addr))) fail("dmx_address must be 1–512 (or null to clear).")
    rec.set("dmx_address", addr)
    rec.set("dmx_universe", addr ? Math.max(1, Math.round(Number(a.dmx_universe || rec.getInt("dmx_universe") || 1))) : 0)
  } else if (a.dmx_universe !== undefined && rec.getInt("dmx_address") > 0) {
    rec.set("dmx_universe", Math.max(1, Math.round(Number(a.dmx_universe) || 1)))
  }
}

function saveItem(ctx, rec, orig) {
  const lib = require(`${__hooks}/lib.js`)
  const before = orig ? lib.snapshot(orig) : null
  lib.prepareItem(ctx.app, rec, orig, ctx.actorId)
  try {
    ctx.app.save(rec)
  } catch (err) {
    fail("Could not save: " + (err && err.message ? err.message : String(err)))
  }
  lib.logChange(ctx.app, rec, before, orig ? "update" : "create", ctx.actorId, ctx.via)
}

// ---------- patch helpers
function patchOf(app, universe) {
  const cache = makeCache(app)
  // universe 0 counts as 1, like in the app
  const items = app.findRecordsByFilter("items", "dmx_address > 0", "dmx_address", 0, 0).filter((i) => (i.getInt("dmx_universe") || 1) === universe)
  const fixtures = items.map((i) => {
    const type = i.getString("type") ? cache.type(i.getString("type")) : null
    const mode = modeOf(type, i.getString("dmx_mode"))
    const fp = mode ? mode.footprint || 1 : 1
    return { inv_no: i.getString("inv_no"), name: i.getString("name"), start: i.getInt("dmx_address"), end: i.getInt("dmx_address") + fp - 1, channels: fp, mode: i.getString("dmx_mode") || null, mode_known: !!mode }
  })
  const occ = []
  for (let c = 0; c <= 513; c++) occ.push([])
  fixtures.forEach((f) => { for (let c = f.start; c <= Math.min(512, f.end); c++) occ[c].push(f) })
  const conflicts = []
  for (let c = 1; c <= 512; c++) {
    // same start + same footprint = deliberate group (e.g. two PARs on one address), not a conflict
    const distinct = {}
    occ[c].forEach((f) => { distinct[f.start + ":" + f.channels] = true })
    if (Object.keys(distinct).length < 2) continue
    const ids = occ[c].map((f) => f.inv_no).sort().join(",")
    const last = conflicts[conflicts.length - 1]
    if (last && last.to === c - 1 && last.key === ids) last.to = c
    else conflicts.push({ from: c, to: c, key: ids, items: occ[c].map((f) => f.inv_no) })
  }
  fixtures.filter((f) => f.end > 512).forEach((f) => conflicts.push({ from: f.start, to: f.end, key: "", items: [f.inv_no], note: "exceeds channel 512" }))
  const free = []
  let start = 0
  for (let c = 1; c <= 513; c++) {
    const empty = c <= 512 && occ[c].length === 0
    if (empty && !start) start = c
    if (!empty && start) { free.push({ from: start, to: c - 1, channels: c - start }); start = 0 }
  }
  return { fixtures, conflicts: conflicts.map((x) => ({ from: x.from, to: x.to, items: x.items, note: x.note })), free, occ }
}

// ---------- tool definitions
const str = (description) => ({ type: "string", description })
const int = (description) => ({ type: "integer", description })
const ITEM_FIELDS = {
  name: str("Name, e.g. \"PAR 3\" or \"DMX cable 10 m\"."),
  category: str("Free text, e.g. Licht, Ton, Kabel, Strom. Reuse existing categories (see inventory_summary)."),
  quantity: int("Number of identical pieces in this entry (for small parts like cables). Default 1."),
  fixture_type: str("Fixture type as \"Manufacturer Model\" (see list_fixture_types). Optional, for DMX devices."),
  location: str("Storage location name (see list_locations)."),
  sublocation: str("Spot within the location, e.g. a box, shelf or case."),
  condition: { type: "string", enum: CONDITIONS, description: "Condition. Default ok." },
  serial: str("Serial number."),
  notes: str("Free-form notes."),
  dmx_universe: int("Last known DMX universe (default 1)."),
  dmx_address: int("Last known DMX start address 1–512."),
  dmx_mode: str("DMX mode name as defined on the fixture type."),
}
const pick = (keys) => keys.reduce((o, k) => { o[k] = ITEM_FIELDS[k]; return o }, {})

const TOOLS = [
  {
    name: "inventory_summary",
    description: "Overview of the whole inventory: totals, counts by category, location and condition, and items that need attention (defective, in repair, missing). Good first call.",
    inputSchema: { type: "object", properties: {} },
    readOnly: true,
    run(ctx) {
      const app = ctx.app
      const cache = makeCache(app)
      const items = app.findRecordsByFilter("items", "", "inv_no", 0, 0)
      const by = (fn) => items.reduce((o, i) => { const k = fn(i) || "(none)"; o[k] = (o[k] || 0) + 1; return o }, {})
      return {
        entries: items.length,
        pieces: items.reduce((n, i) => n + (i.getInt("quantity") || 1), 0),
        by_category: by((i) => i.getString("category")),
        by_location: by((i) => { const l = cache.loc(i.getString("location")); return l ? l.getString("name") : "" }),
        by_condition: by((i) => COND_FROM_DB[i.getString("condition")]),
        needs_attention: items.filter((i) => i.getString("condition") !== "ok").map((i) => itemSummary(app, i, cache)),
        inventory_number_prefix: (function () { try { return app.findRecordsByFilter("settings", "", "", 1, 0)[0].getString("inv_prefix") || "INV" } catch (e) { return "INV" } })(),
      }
    },
  },
  {
    name: "search_items",
    description: "Search the inventory. Free text matches inventory number, name, category, serial, notes, place, fixture type and location; filters narrow it down. Returns compact entries.",
    inputSchema: {
      type: "object",
      properties: {
        query: str("Words to search for (all must match), e.g. \"par keller\"."),
        category: str("Exact category."),
        location: str("Location name."),
        condition: { type: "string", enum: CONDITIONS },
        fixture_type: str("Fixture type \"Manufacturer Model\"."),
        dmx_only: { type: "boolean", description: "Only items with a known DMX address." },
        limit: int("Max results (default 50, max 500)."),
      },
    },
    readOnly: true,
    run(ctx, a) {
      const app = ctx.app
      const parts = [], params = {}
      String(a.query || "").trim().split(/\s+/).filter(Boolean).forEach((w, i) => {
        params["q" + i] = w
        parts.push("(inv_no ~ {:q" + i + "} || name ~ {:q" + i + "} || category ~ {:q" + i + "} || serial ~ {:q" + i + "} || notes ~ {:q" + i + "} || sublocation ~ {:q" + i + "} || type.manufacturer ~ {:q" + i + "} || type.model ~ {:q" + i + "} || location.name ~ {:q" + i + "})")
      })
      if (a.category) { params.cat = a.category; parts.push("category = {:cat}") }
      if (a.location) { params.loc = findLocation(app, a.location).id; parts.push("location = {:loc}") }
      if (a.fixture_type) { params.typ = findType(app, a.fixture_type, true).id; parts.push("type = {:typ}") }
      if (a.condition) { params.cond = COND_TO_DB[lower(a.condition)] || a.condition; parts.push("condition = {:cond}") }
      if (a.dmx_only) parts.push("dmx_address > 0")
      const limit = Math.min(500, Math.max(1, Number(a.limit) || 50))
      const cache = makeCache(app)
      const rows = app.findRecordsByFilter("items", parts.join(" && "), "inv_no", limit, 0, params)
      return { count: rows.length, items: rows.map((i) => itemSummary(app, i, cache)) }
    },
  },
  {
    name: "get_item",
    description: "Full details of one item by inventory number: fixture type with modes, location, last known DMX address (with who set it when), photos, GDTF/manual links and recent history.",
    inputSchema: { type: "object", properties: { inv_no: str("Inventory number, e.g. \"INV-0042\".") }, required: ["inv_no"] },
    readOnly: true,
    run(ctx, a) { return itemDetail(ctx, findItem(ctx.app, a.inv_no)) },
  },
  {
    name: "create_item",
    description: "Add a new item. The inventory number is assigned automatically and returned. Use the same categories, locations and fixture types as existing items where possible.",
    inputSchema: { type: "object", properties: pick(Object.keys(ITEM_FIELDS)), required: ["name"] },
    run(ctx, a) {
      needWrite(ctx)
      if (!String(a.name || "").trim()) fail("name is required.")
      const rec = new Record(ctx.app.findCollectionByNameOrId("items"))
      applyItemFields(ctx.app, rec, a)
      saveItem(ctx, rec, null)
      return itemDetail(ctx, rec)
    },
  },
  {
    name: "update_item",
    description: "Change fields of an item. Only the given fields change; pass null to clear a field. Items cannot be deleted via the API.",
    inputSchema: { type: "object", properties: Object.assign({ inv_no: str("Inventory number of the item to change.") }, pick(Object.keys(ITEM_FIELDS))), required: ["inv_no"] },
    run(ctx, a) {
      needWrite(ctx)
      const rec = findItem(ctx.app, a.inv_no)
      const orig = rec.original()
      applyItemFields(ctx.app, rec, a)
      saveItem(ctx, rec, orig)
      return itemDetail(ctx, rec)
    },
  },
  {
    name: "set_dmx_address",
    description: "Record the last known DMX address of an item (what it is actually set to). Checks the channel range against the fixture mode and reports overlaps with other fixtures. Pass address null to clear.",
    inputSchema: {
      type: "object",
      properties: { inv_no: str("Inventory number."), universe: int("DMX universe, default 1."), address: { type: ["integer", "null"], description: "Start address 1–512, or null to clear." }, mode: str("Mode name, if it changed.") },
      required: ["inv_no", "address"],
    },
    run(ctx, a) {
      needWrite(ctx)
      const app = ctx.app
      const rec = findItem(app, a.inv_no)
      const orig = rec.original()
      const fields = { dmx_address: a.address, dmx_universe: a.universe || 1 }
      if (a.mode !== undefined) fields.dmx_mode = a.mode
      applyItemFields(app, rec, fields)
      const type = rec.getString("type") ? app.findRecordById("fixture_types", rec.getString("type")) : null
      const mode = modeOf(type, rec.getString("dmx_mode"))
      if (a.address && mode && a.address + mode.footprint - 1 > 512) fail("Address " + a.address + " + " + mode.footprint + " channels exceeds channel 512.")
      saveItem(ctx, rec, orig)
      const result = { item: itemSummary(app, rec, makeCache(app)) }
      if (a.address) {
        if (type && jsonField(type, "modes").length > 1 && !mode) result.warning = "Mode unknown, footprint assumed to be 1 channel. Pass mode to fix this."
        const p = patchOf(app, rec.getInt("dmx_universe") || 1)
        result.overlaps = p.conflicts.filter((c) => c.items.indexOf(rec.getString("inv_no")) >= 0)
      }
      return result
    },
  },
  {
    name: "get_patch",
    description: "DMX patch of one universe: all fixtures with their channel ranges, overlaps (conflicts) and free channel ranges.",
    inputSchema: { type: "object", properties: { universe: int("DMX universe, default 1.") } },
    readOnly: true,
    run(ctx, a) {
      const p = patchOf(ctx.app, Number(a.universe) || 1)
      return { universe: Number(a.universe) || 1, used_channels: p.occ.slice(1, 513).filter((x) => x.length).length, fixtures: p.fixtures, conflicts: p.conflicts, free: p.free }
    },
  },
  {
    name: "find_free_address",
    description: "Find start addresses in a universe where a fixture with the given number of channels fits without overlapping anything.",
    inputSchema: { type: "object", properties: { universe: int("DMX universe, default 1."), channels: int("Footprint of the fixture in channels.") }, required: ["channels"] },
    readOnly: true,
    run(ctx, a) {
      const need = Math.max(1, Number(a.channels) || 1)
      const p = patchOf(ctx.app, Number(a.universe) || 1)
      const fits = p.free.filter((f) => f.channels >= need)
      return { universe: Number(a.universe) || 1, channels: need, first_free: fits.length ? fits[0].from : null, candidates: fits.map((f) => ({ from: f.from, last_possible_start: f.to - need + 1 })) }
    },
  },
  {
    name: "list_locations",
    description: "All storage locations with the person responsible, address and number of items.",
    inputSchema: { type: "object", properties: {} },
    readOnly: true,
    run(ctx) {
      const app = ctx.app
      return {
        locations: allLocations(app).map((l) => ({
          name: l.getString("name"), keeper: userName(app, l.getString("keeper")), address: l.getString("address") || null,
          notes: l.getString("notes") || null, items: app.countRecords("items", $dbx.hashExp({ location: l.id })),
        })),
      }
    },
  },
  {
    name: "create_location",
    description: "Add a storage location (e.g. somebody's basement or a storage room).",
    inputSchema: { type: "object", properties: { name: str("Unique name, e.g. \"Basement Smith\"."), address: str("Address."), notes: str("Access, keys, opening hours …"), keeper_email: str("E-mail of the member responsible (optional).") }, required: ["name"] },
    run(ctx, a) {
      needWrite(ctx)
      const app = ctx.app
      const name = String(a.name || "").trim()
      if (!name) fail("name is required.")
      if (allLocations(app).some((l) => lower(l.getString("name")) === lower(name))) fail("A location named \"" + name + "\" already exists.")
      const rec = new Record(app.findCollectionByNameOrId("locations"))
      rec.set("name", name)
      rec.set("address", a.address || "")
      rec.set("notes", a.notes || "")
      if (a.keeper_email) {
        try { rec.set("keeper", app.findAuthRecordByEmail("users", a.keeper_email).id) } catch (e) { fail("No member with e-mail " + a.keeper_email + ".") }
      }
      app.save(rec)
      return { name, created: true }
    },
  },
  {
    name: "list_fixture_types",
    description: "All fixture types (models) with their DMX modes, number of items and whether a GDTF file or manual exists.",
    inputSchema: { type: "object", properties: {} },
    readOnly: true,
    run(ctx) { return { fixture_types: allTypes(ctx.app).map((t) => typeSummary(ctx.app, t)) } },
  },
  {
    name: "get_fixture_type",
    description: "One fixture type with all modes and their full channel layout (incl. DMX value ranges from GDTF), plus links to the GDTF file and manuals.",
    inputSchema: { type: "object", properties: { fixture_type: str("\"Manufacturer Model\" or id.") }, required: ["fixture_type"] },
    readOnly: true,
    run(ctx, a) {
      const t = findType(ctx.app, a.fixture_type, true)
      return Object.assign(typeSummary(ctx.app, t), {
        modes: jsonField(t, "modes"),
        power_w: t.getInt("power_w") || null, weight_kg: t.getFloat("weight_kg") || null, notes: t.getString("notes") || null,
        gdtf: t.getString("gdtf") ? fileUrl(ctx, t, t.getString("gdtf")) : null,
        manuals: t.getStringSlice("manual").map((f) => fileUrl(ctx, t, f)),
      })
    },
  },
  {
    name: "create_fixture_type",
    description: "Add a fixture type by hand (without GDTF). Prefer upload_gdtf / create_upload_link when a GDTF file is available: it fills modes and channels automatically.",
    inputSchema: {
      type: "object",
      properties: {
        manufacturer: str("Manufacturer."), model: str("Model."),
        modes: { type: "array", description: "DMX modes.", items: { type: "object", properties: { name: str("Mode name, e.g. \"8ch\"."), channels: { type: "array", items: { type: "string" }, description: "Channel names in order (channel 1, 2, …)." } }, required: ["name", "channels"] } },
        power_w: int("Power in watts."), notes: str("Notes."),
      },
      required: ["manufacturer", "model"],
    },
    run(ctx, a) {
      needWrite(ctx)
      const app = ctx.app
      const label = lower(a.manufacturer + " " + a.model)
      if (allTypes(app).some((t) => lower(typeLabel(t)) === label)) fail("Fixture type \"" + a.manufacturer + " " + a.model + "\" already exists.")
      const rec = new Record(app.findCollectionByNameOrId("fixture_types"))
      rec.set("manufacturer", String(a.manufacturer).trim())
      rec.set("model", String(a.model).trim())
      rec.set("modes", (a.modes || []).map((m) => ({ name: String(m.name), footprint: (m.channels || []).length, channels: (m.channels || []).map((n, i) => ({ ch: i + 1, name: String(n) })) })))
      if (a.power_w) rec.set("power_w", a.power_w)
      rec.set("notes", a.notes || "")
      app.save(rec)
      return typeSummary(app, rec)
    },
  },
  {
    name: "upload_gdtf",
    description: "Attach a GDTF file given as base64 (fine for small files). Creates the fixture type from the file if fixture_type is omitted, otherwise replaces its GDTF. Modes and channels are read from the file. For larger files use create_upload_link instead.",
    inputSchema: { type: "object", properties: { content_base64: str("The .gdtf file, base64 encoded."), filename: str("File name, e.g. \"Robe@Spiider.gdtf\"."), fixture_type: str("Existing fixture type to update (optional).") }, required: ["content_base64"] },
    run(ctx, a) {
      needWrite(ctx)
      const gdtf = require(`${__hooks}/gdtf.js`)
      const bytes = gdtf.unbase64(a.content_base64)
      if (bytes.length < 22) fail("content_base64 does not look like a file.")
      const type = a.fixture_type ? findType(ctx.app, a.fixture_type, true) : null
      const file = $filesystem.fileFromBytes(bytes, a.filename || "fixture.gdtf")
      return require(`${__hooks}/uploads.js`).attach(ctx.app, { target: "gdtf", recordId: type ? type.id : "", actorId: ctx.actorId, via: ctx.via }, file, bytes)
    },
  },
  {
    name: "add_item_photo",
    description: "Attach a photo (JPEG/PNG/WebP, base64) to an item. For larger images use create_upload_link.",
    inputSchema: { type: "object", properties: { inv_no: str("Inventory number."), content_base64: str("Image, base64 encoded."), filename: str("File name, e.g. \"front.jpg\".") }, required: ["inv_no", "content_base64"] },
    run(ctx, a) {
      needWrite(ctx)
      const item = findItem(ctx.app, a.inv_no)
      const gdtf = require(`${__hooks}/gdtf.js`)
      const file = $filesystem.fileFromBytes(gdtf.unbase64(a.content_base64), a.filename || "photo.jpg")
      return require(`${__hooks}/uploads.js`).attach(ctx.app, { target: "item_photo", recordId: item.id, actorId: ctx.actorId, via: ctx.via }, file)
    },
  },
  {
    name: "create_upload_link",
    description: "Get a one-time upload URL (valid 15 minutes) for a file you have locally: a GDTF file (creates or updates a fixture type, modes are read automatically), a manual (PDF) for a fixture type, or a photo for an item. Upload with: curl -F \"file=@path\" <url>.",
    inputSchema: {
      type: "object",
      properties: {
        target: { type: "string", enum: ["gdtf", "manual", "item_photo"], description: "What the file is." },
        fixture_type: str("For gdtf (optional: omit to create a new type from the file) and manual (required)."),
        inv_no: str("For item_photo: the item."),
      },
      required: ["target"],
    },
    run(ctx, a) {
      needWrite(ctx)
      let recordId = ""
      if (a.target === "item_photo") recordId = findItem(ctx.app, a.inv_no).id
      else if (a.target === "manual") recordId = findType(ctx.app, a.fixture_type, true).id
      else if (a.target === "gdtf") recordId = a.fixture_type ? findType(ctx.app, a.fixture_type, true).id : ""
      else fail("target must be gdtf, manual or item_photo.")
      return require(`${__hooks}/uploads.js`).create(ctx.e, { target: a.target, recordId, actorId: ctx.actorId, via: ctx.via })
    },
  },
]

module.exports = { TOOLS, ToolError }

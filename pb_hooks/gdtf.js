/// <reference path="../pb_data/types.d.ts" />

// Server-side GDTF parser (used by the app preview, REST uploads and MCP).
// GDTF = zip with description.xml (+ thumbnail). Only those entries are decompressed.

const fflate = require(`${__hooks}/vendor/fflate.js`)

// ---------- minimal XML parser (GDTF is machine-generated, attributes only matter)
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }
function decode(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, e) => {
    if (e[0] === "#") return String.fromCharCode(e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
    return ENTITIES[e] !== undefined ? ENTITIES[e] : m
  })
}
function parseAttrs(s) {
  const out = {}
  const re = /([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  let m
  while ((m = re.exec(s))) out[m[1]] = decode(m[2] !== undefined ? m[2] : m[3])
  return out
}
function parseXml(xml) {
  const root = { name: "#root", attrs: {}, children: [] }
  const stack = [root]
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<![A-Z][^>]*>|<\/([\w.:-]+)\s*>|<([\w.:-]+)((?:\s+[\w.:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g
  let m
  while ((m = re.exec(xml))) {
    if (m[1]) {
      if (stack.length > 1) stack.pop()
    } else if (m[2]) {
      const node = { name: m[2], attrs: parseAttrs(m[3] || ""), children: [] }
      stack[stack.length - 1].children.push(node)
      if (!m[4]) stack.push(node)
    }
  }
  return root
}
const kids = (n, name) => (n ? n.children.filter((c) => c.name === name) : [])
const kid = (n, name) => kids(n, name)[0] || null
function find(n, name) {
  if (!n) return null
  if (n.name === name) return n
  for (const c of n.children) { const f = find(c, name); if (f) return f }
  return null
}

// ---------- channel naming (English; the app translates known attributes)
const ATTR_NAMES = {
  Dimmer: "Dimmer", Pan: "Pan", Tilt: "Tilt",
  ColorAdd_R: "Red", ColorAdd_G: "Green", ColorAdd_B: "Blue", ColorAdd_W: "White",
  ColorAdd_WW: "Warm white", ColorAdd_CW: "Cold white", ColorAdd_A: "Amber", ColorAdd_UV: "UV",
  ColorAdd_L: "Lime", ColorAdd_C: "Cyan", ColorAdd_M: "Magenta", ColorAdd_Y: "Yellow",
  ColorSub_C: "Cyan (subtractive)", ColorSub_M: "Magenta (subtractive)", ColorSub_Y: "Yellow (subtractive)",
  CTO: "CTO", CTC: "CTC", CTB: "CTB", Shutter1: "Shutter/strobe", Zoom: "Zoom", Focus1: "Focus",
  Iris: "Iris", Frost1: "Frost", Prism1: "Prism", Gobo1: "Gobo 1", Gobo2: "Gobo 2",
  Color1: "Color wheel", ColorMacro1: "Color macro", Control1: "Control", Fog: "Fog", Haze: "Haze",
  Fan: "Fan", StrobeFrequency: "Strobe frequency", PanTiltSpeed: "Pan/tilt speed",
}
const prettyAttr = (a) => ATTR_NAMES[a] || a.replace(/_/g, " ").replace(/([a-z])([A-Z0-9])/g, "$1 $2").trim()

// "128/1" → 128, "32768/2" → 128: everything on the 8-bit coarse scale
function dmx8(s) {
  if (!s) return 0
  const p = String(s).split("/")
  const val = Number(p[0]) || 0
  const bytes = Number(p[1]) || 1
  return Math.floor(val / Math.pow(256, Math.max(0, bytes - 1)))
}
function withRanges(list) {
  const sorted = list.filter((x) => x.name).sort((a, b) => a.from - b.from)
  return sorted.map((x, i) => Object.assign({}, x, { to: i + 1 < sorted.length ? Math.max(x.from, sorted[i + 1].from - 1) : 255 }))
}

function parseMode(modeEl) {
  const raw = []
  for (const c of kids(kid(modeEl, "DMXChannels"), "DMXChannel")) {
    const offsets = String(c.attrs.Offset || "").split(",").map(Number).filter((n) => n > 0)
    if (!offsets.length) continue // virtual channel
    const brk = Number(c.attrs.DMXBreak) || 1
    const lc = kid(c, "LogicalChannel")
    const attr = (lc && lc.attrs.Attribute) || String(c.attrs.InitialFunction || "").split(".")[1] || "?"
    const fns = []
    for (const cf of kids(lc, "ChannelFunction")) {
      const sets = withRanges(kids(cf, "ChannelSet").map((s) => ({ from: dmx8(s.attrs.DMXFrom), name: s.attrs.Name })))
      fns.push({ from: dmx8(cf.attrs.DMXFrom), name: cf.attrs.CustomName || cf.attrs.Name, sets })
    }
    raw.push({ offsets, brk, attr, geometry: c.attrs.Geometry || "", fns: withRanges(fns) })
  }

  // multi-cell fixtures repeat attributes; prefix those with the geometry
  const seen = {}
  raw.forEach((r) => { seen[r.attr] = (seen[r.attr] || 0) + 1 })

  const channels = []
  for (const r of raw) {
    const geo = seen[r.attr] > 1 && r.geometry ? r.geometry : ""
    const label = (geo ? geo + " " : "") + prettyAttr(r.attr)
    r.offsets.forEach((ch, i) => {
      const entry = { ch, name: i === 0 ? label : label + (i === 1 ? " fine" : " ultra"), attr: r.attr }
      if (geo) entry.geo = geo
      if (i > 0) entry.fine = i
      if (r.brk !== 1) entry.brk = r.brk
      // a single 0–255 function without named sets says nothing a channel name doesn't
      if (i === 0 && (r.fns.length > 1 || r.fns.some((f) => f.sets.length > 1))) entry.fns = r.fns
      channels.push(entry)
    })
  }
  channels.sort((a, b) => (a.brk || 1) - (b.brk || 1) || a.ch - b.ch)
  const main = channels.filter((c) => !c.brk)
  return {
    name: modeEl.attrs.Name || "Mode",
    footprint: main.length ? Math.max.apply(null, main.map((c) => c.ch)) : 0,
    channels,
  }
}

function toU8(bytes) {
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
}

// bytes: Uint8Array / number array of the .gdtf file
function parse(bytes) {
  const u8 = toU8(bytes)
  let files
  try {
    files = fflate.unzipSync(u8, { filter: (f) => f.name === "description.xml" })
  } catch (e) {
    throw new Error("Not a valid GDTF file (not a zip archive).")
  }
  if (!files["description.xml"]) throw new Error("description.xml is missing in the GDTF file.")
  const doc = parseXml(fflate.strFromU8(files["description.xml"]))
  const ft = find(doc, "FixtureType")
  if (!ft) throw new Error("No FixtureType found in the GDTF file.")

  const modes = kids(kid(ft, "DMXModes"), "DMXMode").map(parseMode)

  let thumbnail = null
  if (ft.attrs.Thumbnail) {
    const wanted = { png: ft.attrs.Thumbnail + ".png", svg: ft.attrs.Thumbnail + ".svg" }
    const imgs = fflate.unzipSync(u8, { filter: (f) => f.name === wanted.png || f.name === wanted.svg })
    if (imgs[wanted.png]) thumbnail = { name: "thumbnail.png", bytes: imgs[wanted.png] }
    else if (imgs[wanted.svg]) thumbnail = { name: "thumbnail.svg", bytes: imgs[wanted.svg] }
  }

  return {
    manufacturer: ft.attrs.Manufacturer || "",
    model: ft.attrs.LongName || ft.attrs.Name || "",
    shortName: ft.attrs.ShortName || "",
    modes,
    thumbnail,
  }
}

// read a filesystem.File (unsaved upload) into bytes
function fileBytes(file) {
  const r = file.reader.open()
  try { return toBytes(r) } finally { r.close() }
}

// Fill a fixture_types record from GDTF bytes. Manufacturer/model/image only when empty, modes per `overwriteModes`.
function applyToType(rec, parsed, overwriteModes) {
  if (!rec.getString("manufacturer") && parsed.manufacturer) rec.set("manufacturer", parsed.manufacturer)
  if (!rec.getString("model") && parsed.model) rec.set("model", parsed.model)
  const hasModes = Array.isArray(rec.get("modes")) ? rec.get("modes").length > 0 : rec.getString("modes").length > 4
  if (overwriteModes || !hasModes) rec.set("modes", parsed.modes)
  if (!rec.getString("image") && parsed.thumbnail) {
    rec.set("image", $filesystem.fileFromBytes(Array.from(parsed.thumbnail.bytes), parsed.thumbnail.name))
  }
}

// REST/app uploads: parse a newly uploaded GDTF in a fixture_types create/update request
function fromRequest(e) {
  const files = e.record.getUnsavedFiles("gdtf")
  if (!files.length) return
  const body = e.requestInfo().body || {}
  const sent = body.modes
  const sentModes = sent !== undefined && sent !== null && String(sent) !== "" && String(sent) !== "[]"
  let parsed
  try {
    parsed = parse(fileBytes(files[0]))
  } catch (err) {
    throw new BadRequestError("GDTF: " + (err && err.message ? err.message : String(err)))
  }
  applyToType(e.record, parsed, !sentModes)
}

// small base64 encoder (no btoa in the JSVM)
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
function base64(u8) {
  let out = ""
  for (let i = 0; i < u8.length; i += 3) {
    const a = u8[i], b = u8[i + 1], c = u8[i + 2]
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b || 0) >> 4)]
    out += i + 1 < u8.length ? B64[((b & 15) << 2) | ((c || 0) >> 6)] : "="
    out += i + 2 < u8.length ? B64[c & 63] : "="
  }
  return out
}
function unbase64(s) {
  const clean = String(s || "").replace(/^data:[^,]*,/, "").replace(/[^A-Za-z0-9+/]/g, "")
  const out = []
  for (let i = 0; i < clean.length; i += 4) {
    const n = [0, 1, 2, 3].map((k) => (i + k < clean.length ? B64.indexOf(clean[i + k]) : -1))
    out.push((n[0] << 2) | (n[1] >> 4))
    if (n[2] >= 0) out.push(((n[1] & 15) << 4) | (n[2] >> 2))
    if (n[3] >= 0) out.push(((n[2] & 3) << 6) | n[3])
  }
  return out
}

module.exports = { parse, fileBytes, applyToType, fromRequest, base64, unbase64 }

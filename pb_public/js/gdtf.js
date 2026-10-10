// GDTF = zip containing description.xml (+ thumbnail, wheel images, models).
// Parsed in the browser; the original file is uploaded unchanged.

async function unzipEntries(buf) {
  const v = new DataView(buf)
  let eocd = -1
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error("Keine gültige GDTF-Datei (kein ZIP-Archiv).")

  const count = v.getUint16(eocd + 10, true)
  let p = v.getUint32(eocd + 16, true)
  const entries = new Map()
  const dec = new TextDecoder()
  for (let n = 0; n < count && v.getUint32(p, true) === 0x02014b50; n++) {
    const method = v.getUint16(p + 10, true)
    const size = v.getUint32(p + 20, true)
    const nameLen = v.getUint16(p + 28, true)
    const extraLen = v.getUint16(p + 30, true)
    const commentLen = v.getUint16(p + 32, true)
    const local = v.getUint32(p + 42, true)
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen))
    entries.set(name, { method, size, local })
    p += 46 + nameLen + extraLen + commentLen
  }

  return {
    names: [...entries.keys()],
    async read(name) {
      const e = entries.get(name)
      if (!e) return null
      const start = e.local + 30 + v.getUint16(e.local + 26, true) + v.getUint16(e.local + 28, true)
      const raw = new Uint8Array(buf, start, e.size)
      if (e.method === 0) return raw.slice()
      if (e.method !== 8) throw new Error(`Komprimierung ${e.method} wird nicht unterstützt.`)
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))
      return new Uint8Array(await new Response(stream).arrayBuffer())
    },
  }
}

const ATTR_NAMES = {
  Dimmer: "Dimmer", Pan: "Pan", Tilt: "Tilt",
  ColorAdd_R: "Rot", ColorAdd_G: "Grün", ColorAdd_B: "Blau", ColorAdd_W: "Weiß",
  ColorAdd_WW: "Warmweiß", ColorAdd_CW: "Kaltweiß", ColorAdd_A: "Amber", ColorAdd_UV: "UV",
  ColorAdd_L: "Lime", ColorAdd_C: "Cyan", ColorAdd_M: "Magenta", ColorAdd_Y: "Gelb",
  ColorSub_C: "Cyan (sub)", ColorSub_M: "Magenta (sub)", ColorSub_Y: "Gelb (sub)",
  CTO: "CTO", CTC: "CTC", CTB: "CTB", Shutter1: "Shutter/Strobe", Zoom: "Zoom", Focus1: "Fokus",
  Iris: "Iris", Frost1: "Frost", Prism1: "Prisma", Gobo1: "Gobo 1", Gobo2: "Gobo 2",
  Color1: "Farbrad", ColorMacro1: "Farbmakro", Control1: "Steuerung", Fog: "Nebel", Haze: "Haze",
  Fan: "Lüfter", StrobeFrequency: "Strobe-Frequenz", PanTiltSpeed: "Pan/Tilt-Speed",
}

const prettyAttr = (a) =>
  ATTR_NAMES[a] || a.replace(/_/g, " ").replace(/([a-z])([A-Z0-9])/g, "$1 $2").trim()

// "128/1" → 128, "32768/2" → 128: everything on the 8-bit coarse scale
function dmx8(s) {
  if (!s) return 0
  const [val, bytes] = s.split("/").map(Number)
  return Math.floor((val || 0) / 256 ** Math.max(0, (bytes || 1) - 1))
}

function withRanges(list) {
  const sorted = list.filter((x) => x.name).sort((a, b) => a.from - b.from)
  return sorted.map((x, i) => ({ ...x, to: i + 1 < sorted.length ? Math.max(x.from, sorted[i + 1].from - 1) : 255 }))
}

function parseMode(modeEl) {
  const raw = []
  for (const c of modeEl.querySelectorAll(":scope > DMXChannels > DMXChannel")) {
    const offsets = (c.getAttribute("Offset") || "").split(",").map(Number).filter((n) => n > 0)
    if (!offsets.length) continue // virtual channel
    const brk = Number(c.getAttribute("DMXBreak")) || 1
    const lc = c.querySelector(":scope > LogicalChannel")
    const attr = lc?.getAttribute("Attribute") || c.getAttribute("InitialFunction")?.split(".")[1] || "?"
    const fns = []
    for (const cf of lc ? lc.querySelectorAll(":scope > ChannelFunction") : []) {
      const sets = withRanges(
        [...cf.querySelectorAll(":scope > ChannelSet")].map((s) => ({ from: dmx8(s.getAttribute("DMXFrom")), name: s.getAttribute("Name") })),
      )
      fns.push({ from: dmx8(cf.getAttribute("DMXFrom")), name: cf.getAttribute("CustomName") || cf.getAttribute("Name"), sets })
    }
    raw.push({ offsets, brk, attr, geometry: c.getAttribute("Geometry") || "", fns: withRanges(fns) })
  }

  // multi-cell fixtures repeat attributes; prefix those with the geometry
  const seen = {}
  raw.forEach((r) => { seen[r.attr] = (seen[r.attr] || 0) + 1 })

  const channels = []
  for (const r of raw) {
    const label = (seen[r.attr] > 1 && r.geometry ? `${r.geometry} ` : "") + prettyAttr(r.attr)
    r.offsets.forEach((ch, i) => {
      const entry = { ch, name: i === 0 ? label : `${label} ${i === 1 ? "fein" : "ultra"}` }
      if (r.brk !== 1) entry.brk = r.brk
      // single 0–255 function without named sets says nothing a channel name doesn't
      if (i === 0 && (r.fns.length > 1 || r.fns.some((f) => f.sets.length > 1))) entry.fns = r.fns
      channels.push(entry)
    })
  }
  channels.sort((a, b) => (a.brk || 1) - (b.brk || 1) || a.ch - b.ch)
  const main = channels.filter((c) => !c.brk)
  return {
    name: modeEl.getAttribute("Name") || "Mode",
    footprint: main.length ? Math.max(...main.map((c) => c.ch)) : 0,
    channels,
  }
}

export async function parseGdtf(file) {
  const zip = await unzipEntries(await file.arrayBuffer())
  const xmlBytes = await zip.read("description.xml")
  if (!xmlBytes) throw new Error("description.xml fehlt in der GDTF-Datei.")
  const doc = new DOMParser().parseFromString(new TextDecoder().decode(xmlBytes), "application/xml")
  if (doc.querySelector("parsererror")) throw new Error("description.xml ist kein gültiges XML.")
  const ft = doc.querySelector("FixtureType")
  if (!ft) throw new Error("Kein FixtureType in der GDTF-Datei gefunden.")

  const modes = [...ft.querySelectorAll(":scope > DMXModes > DMXMode")].map(parseMode)

  let thumbnail = null
  const thumb = ft.getAttribute("Thumbnail")
  if (thumb) {
    for (const ext of ["png", "svg"]) {
      const bytes = await zip.read(`${thumb}.${ext}`)
      if (bytes) {
        thumbnail = new File([bytes], `thumbnail.${ext}`, { type: ext === "png" ? "image/png" : "image/svg+xml" })
        break
      }
    }
  }

  return {
    manufacturer: ft.getAttribute("Manufacturer") || "",
    model: ft.getAttribute("LongName") || ft.getAttribute("Name") || "",
    shortName: ft.getAttribute("ShortName") || "",
    description: ft.getAttribute("Description") || "",
    modes,
    thumbnail,
  }
}

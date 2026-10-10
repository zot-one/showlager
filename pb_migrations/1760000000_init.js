/// <reference path="../pb_data/types.d.ts" />

const AUTH = '@request.auth.id != ""'
const ADMIN = '@request.auth.role = "admin"'
const MB = 1024 * 1024

const autodates = () => [
  { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
]

migrate((app) => {
  // --- users: members log in, only admins manage accounts
  const users = app.findCollectionByNameOrId("users")
  users.fields.add(new Field({ name: "role", type: "select", values: ["member", "admin"], maxSelect: 1 }))
  users.listRule = AUTH
  users.viewRule = AUTH
  users.createRule = ADMIN
  users.updateRule = `${ADMIN} || (id = @request.auth.id && @request.body.role:isset = false)`
  users.deleteRule = `${ADMIN} && id != @request.auth.id`
  users.manageRule = ADMIN
  users.authToken.duration = 90 * 24 * 3600 // stay logged in on phones for label scans
  app.save(users)

  const locations = new Collection({
    type: "base",
    name: "locations",
    listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH, deleteRule: ADMIN,
    fields: [
      { name: "name", type: "text", required: true, max: 120, presentable: true },
      { name: "keeper", type: "relation", collectionId: users.id, maxSelect: 1 },
      { name: "address", type: "text", max: 500 },
      { name: "notes", type: "text", max: 5000 },
      ...autodates(),
    ],
    indexes: ["CREATE UNIQUE INDEX idx_locations_name ON locations (name)"],
  })
  app.save(locations)

  const types = new Collection({
    type: "base",
    name: "fixture_types",
    listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH, deleteRule: ADMIN,
    fields: [
      { name: "manufacturer", type: "text", required: true, max: 120 },
      { name: "model", type: "text", required: true, max: 160, presentable: true },
      { name: "gdtf", type: "file", maxSelect: 1, maxSize: 50 * MB },
      {
        name: "image", type: "file", maxSelect: 1, maxSize: 10 * MB,
        mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"], thumbs: ["160x160"],
      },
      { name: "manual", type: "file", maxSelect: 5, maxSize: 50 * MB },
      // [{ name, footprint, channels: [{ ch, name, fns: [{ from, to, name }] }] }]
      { name: "modes", type: "json", maxSize: 4 * MB },
      { name: "color", type: "text", max: 16 },
      { name: "power_w", type: "number", min: 0 },
      { name: "weight_kg", type: "number", min: 0 },
      { name: "notes", type: "text", max: 20000 },
      ...autodates(),
    ],
  })
  app.save(types)

  const items = new Collection({
    type: "base",
    name: "items",
    listRule: AUTH, viewRule: AUTH, createRule: AUTH, updateRule: AUTH, deleteRule: ADMIN,
    fields: [
      { name: "inv_no", type: "text", max: 20, presentable: true },
      { name: "name", type: "text", required: true, max: 200 },
      { name: "category", type: "text", max: 80 },
      { name: "type", type: "relation", collectionId: types.id, maxSelect: 1 },
      { name: "quantity", type: "number", min: 0, onlyInt: true },
      { name: "location", type: "relation", collectionId: locations.id, maxSelect: 1 },
      { name: "sublocation", type: "text", max: 120 },
      { name: "condition", type: "select", values: ["ok", "defekt", "reparatur", "verschollen"], maxSelect: 1 },
      { name: "serial", type: "text", max: 120 },
      {
        name: "photos", type: "file", maxSelect: 12, maxSize: 20 * MB,
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"],
        thumbs: ["480x360", "160x160"],
      },
      { name: "notes", type: "text", max: 20000 },
      { name: "dmx_universe", type: "number", min: 1, max: 999, onlyInt: true },
      { name: "dmx_address", type: "number", min: 1, max: 512, onlyInt: true },
      { name: "dmx_mode", type: "text", max: 120 },
      { name: "dmx_set_at", type: "date" },
      { name: "dmx_set_by", type: "relation", collectionId: users.id, maxSelect: 1 },
      ...autodates(),
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_items_inv_no ON items (inv_no)",
      "CREATE INDEX idx_items_patch ON items (dmx_universe, dmx_address)",
    ],
  })
  app.save(items)

  const changes = new Collection({
    type: "base",
    name: "changes",
    listRule: AUTH, viewRule: AUTH, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: "item", type: "relation", collectionId: items.id, maxSelect: 1, cascadeDelete: true, required: true },
      { name: "user", type: "relation", collectionId: users.id, maxSelect: 1 },
      { name: "action", type: "select", values: ["create", "update"], maxSelect: 1 },
      { name: "diff", type: "json", maxSize: MB }, // { field: [before, after] }
      ...autodates(),
    ],
    indexes: ["CREATE INDEX idx_changes_item ON changes (item, created)"],
  })
  app.save(changes)

  // single row; empty label_template means "use the built-in default"
  const settings = new Collection({
    type: "base",
    name: "settings",
    listRule: AUTH, viewRule: AUTH, createRule: null, updateRule: AUTH, deleteRule: null,
    fields: [
      { name: "label_template", type: "json", maxSize: MB }, // { v, elements: [{ type, x, y, w, h, … }] } in mm
      { name: "label_logo", type: "file", maxSelect: 1, maxSize: 5 * MB, mimeTypes: ["image/png", "image/jpeg", "image/svg+xml", "image/webp"] },
      ...autodates(),
    ],
  })
  app.save(settings)
  app.save(new Record(settings, {}))

  const s = app.settings()
  s.meta.appName = "Showtechnik-Inventar"
  s.backups.cron = "30 3 * * *"
  s.backups.cronMaxKeep = 14
  s.trustedProxy.headers = ["X-Forwarded-For"]
  s.rateLimits.enabled = true
  app.save(s)
}, (app) => {
  for (const name of ["settings", "changes", "items", "fixture_types", "locations"]) {
    app.delete(app.findCollectionByNameOrId(name))
  }
  const users = app.findCollectionByNameOrId("users")
  users.fields.removeByName("role")
  app.save(users)
})

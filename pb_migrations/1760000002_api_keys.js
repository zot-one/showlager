/// <reference path="../pb_data/types.d.ts" />

// API keys for agents and scripts (REST + MCP). Only the SHA-256 hash is stored.
migrate((app) => {
  const ADMIN = '@request.auth.role = "admin"'
  const users = app.findCollectionByNameOrId("users")

  const keys = new Collection({
    type: "base",
    name: "api_keys",
    listRule: ADMIN, viewRule: ADMIN, createRule: null, updateRule: null, deleteRule: ADMIN,
    fields: [
      { name: "name", type: "text", required: true, max: 80, presentable: true },
      { name: "key_hash", type: "text", required: true, max: 64, hidden: true },
      { name: "hint", type: "text", max: 20 }, // e.g. "sl_Ab3d…9xQz", to recognise a key later
      { name: "access", type: "select", values: ["read", "write"], maxSelect: 1, required: true },
      { name: "owner", type: "relation", collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true },
      { name: "last_used", type: "date" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_api_keys_hash ON api_keys (key_hash)"],
  })
  app.save(keys)

  // which API key made a change ("Anna via API key 'Claude'")
  const changes = app.findCollectionByNameOrId("changes")
  changes.fields.add(new Field({ name: "via", type: "text", max: 80 }))
  app.save(changes)
}, (app) => {
  app.delete(app.findCollectionByNameOrId("api_keys"))
  const changes = app.findCollectionByNameOrId("changes")
  changes.fields.removeByName("via")
  app.save(changes)
})

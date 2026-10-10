/// <reference path="../pb_data/types.d.ts" />

// Club name, logo initials and inventory number prefix are set in the app (Einstellungen), not in code.
migrate((app) => {
  const settings = app.findCollectionByNameOrId("settings")
  settings.fields.add(new Field({ name: "org_name", type: "text", max: 120 }))
  settings.fields.add(new Field({ name: "org_short", type: "text", max: 5 }))
  settings.fields.add(new Field({ name: "inv_prefix", type: "text", max: 6, pattern: "^[A-Z0-9]*$" }))
  app.save(settings)

  const s = app.settings()
  s.meta.appName = "Showlager"
  app.save(s)
}, (app) => {
  const settings = app.findCollectionByNameOrId("settings")
  for (const name of ["org_name", "org_short", "inv_prefix"]) settings.fields.removeByName(name)
  app.save(settings)
})

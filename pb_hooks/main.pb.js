/// <reference path="../pb_data/types.d.ts" />

// ---------- items: inventory number, DMX stamp, change history

onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  lib.prepareItem(e.app, e.record, null, lib.actorOf(e))
  e.next()
  lib.logChange(e.app, e.record, null, "create", lib.actorOf(e), lib.viaOf(e))
}, "items")

onRecordUpdateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  const orig = e.record.original()
  const before = lib.snapshot(orig)
  lib.prepareItem(e.app, e.record, orig, lib.actorOf(e))
  e.next()
  lib.logChange(e.app, e.record, before, "update", lib.actorOf(e), lib.viaOf(e))
}, "items")

// ---------- fixture types: a newly uploaded GDTF fills manufacturer, model, modes and image.
// Modes are only taken from the file if the request did not send its own (the app sends edited ones).

onRecordCreateRequest((e) => {
  require(`${__hooks}/gdtf.js`).fromRequest(e)
  e.next()
}, "fixture_types")

onRecordUpdateRequest((e) => {
  require(`${__hooks}/gdtf.js`).fromRequest(e)
  e.next()
}, "fixture_types")

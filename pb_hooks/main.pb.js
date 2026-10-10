/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  lib.prepareItem(e, true)
  e.next()
  lib.logChange(e, null, "create")
}, "items")

onRecordUpdateRequest((e) => {
  const lib = require(`${__hooks}/lib.js`)
  const before = lib.snapshot(e.record.original())
  lib.prepareItem(e, false)
  e.next()
  lib.logChange(e, before, "update")
}, "items")

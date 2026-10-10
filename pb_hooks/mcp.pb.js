/// <reference path="../pb_data/types.d.ts" />

// MCP endpoint for AI agents: POST https://<host>/mcp with "Authorization: Bearer sl_…"
routerAdd("POST", "/mcp", (e) => require(`${__hooks}/mcp.js`).handle(e))

// no server-sent event stream and no sessions: GET/DELETE are not supported
routerAdd("GET", "/mcp", (e) => {
  e.response.header().set("Allow", "POST")
  return e.json(405, { message: "Use POST. Showlager speaks MCP over Streamable HTTP with JSON responses." })
})

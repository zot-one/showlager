/// <reference path="../pb_data/types.d.ts" />

// Minimal MCP server (Streamable HTTP transport, plain JSON responses, no sessions).
// Spec: https://modelcontextprotocol.io — only the tools capability is offered.

const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]

const INSTRUCTIONS = [
  "Showlager is the stage equipment inventory of a theatre/cultural club: lights, sound, cables, stands, effects.",
  "Items have an inventory number (e.g. INV-0042) and may belong to a fixture type (a model with DMX modes and channels from GDTF),",
  "a storage location (often a member's home) and a spot within it. Data such as names and categories is usually German.",
  "DMX addresses are the last known setting of the physical fixture; use get_patch or find_free_address before assigning one.",
  "Deleting is not possible through the API. Start with inventory_summary or search_items to get oriented.",
].join(" ")

function rpc(e, status, id, body) {
  return e.json(status, Object.assign({ jsonrpc: "2.0", id: id === undefined ? null : id }, body))
}

function handle(e) {
  const key = e.get("apiKey")
  if (!key) {
    e.response.header().set("WWW-Authenticate", 'Bearer realm="showlager"')
    return rpc(e, 401, null, { error: { code: -32001, message: "Send an API key: 'Authorization: Bearer sl_…'. Admins create keys in the app under API keys." } })
  }

  const msg = e.requestInfo().body
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return rpc(e, 400, null, { error: { code: -32600, message: "Invalid JSON-RPC request." } })
  }
  // notifications (no id) need no answer
  if (msg.id === undefined || msg.id === null) return e.noContent(202)

  const { TOOLS, ToolError } = require(`${__hooks}/mcp_tools.js`)
  const write = key.access === "write"
  const available = TOOLS.filter((t) => write || t.readOnly)
  const params = msg.params || {}

  switch (msg.method) {
    case "initialize": {
      const wanted = String(params.protocolVersion || "")
      return rpc(e, 200, msg.id, {
        result: {
          protocolVersion: VERSIONS.indexOf(wanted) >= 0 ? wanted : VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "showlager", title: "Showlager", version: "1.0.0" },
          instructions: INSTRUCTIONS + (write ? "" : " This API key is read-only."),
        },
      })
    }
    case "ping":
      return rpc(e, 200, msg.id, { result: {} })
    case "tools/list":
      return rpc(e, 200, msg.id, {
        result: {
          tools: available.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
            annotations: { readOnlyHint: !!t.readOnly, destructiveHint: false, idempotentHint: !!t.readOnly, openWorldHint: false },
          })),
        },
      })
    case "tools/call": {
      const tool = TOOLS.filter((t) => t.name === params.name)[0]
      if (!tool) return rpc(e, 200, msg.id, { error: { code: -32602, message: "Unknown tool: " + params.name } })
      if (!write && !tool.readOnly) {
        return rpc(e, 200, msg.id, { result: { content: [{ type: "text", text: "This API key is read-only." }], isError: true } })
      }
      const ctx = { app: e.app, e, actorId: e.auth ? e.auth.id : "", via: key.name, write }
      try {
        const out = tool.run(ctx, params.arguments || {})
        return rpc(e, 200, msg.id, { result: { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: out } })
      } catch (err) {
        const known = err instanceof ToolError || (err && err.status)
        const text = err && err.message ? err.message : String(err)
        if (!known) e.app.logger().error("mcp tool failed", "tool", tool.name, "error", text)
        return rpc(e, 200, msg.id, { result: { content: [{ type: "text", text: known ? text : "Internal error: " + text }], isError: true } })
      }
    }
    default:
      return rpc(e, 200, msg.id, { error: { code: -32601, message: "Method not found: " + msg.method } })
  }
}

module.exports = { handle }

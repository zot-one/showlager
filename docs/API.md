# Showlager API

Showlager can be used by AI agents through **MCP** and by scripts through the **REST API**. Both use API keys.

- [API keys](#api-keys)
- [MCP for AI agents](#mcp-for-ai-agents)
- [REST API](#rest-api)
- [Uploads (GDTF, manuals, photos)](#uploads-gdtf-manuals-photos)

## API keys

Admins create keys in the app under **API keys**. A key is shown once, only its SHA-256 hash is stored.

| Access | Allowed |
|---|---|
| Read only | Read items, fixture types, locations, history, member names, club settings |
| Read and write | Additionally create and change items, locations and fixture types, upload photos, GDTF files and manuals |

A key acts on behalf of the admin who created it. Every change appears in the item history as
"*Anna via API key ‘Claude’*". Regardless of access, keys can **not** delete anything, manage accounts or keys,
or change settings. Revoke a key in the app to cut off access immediately.

Send the key as a bearer token:

```
Authorization: Bearer sl_…
```

## MCP for AI agents

Endpoint: `https://<your-host>/mcp` · Transport: Streamable HTTP (JSON responses, no sessions) · Capability: tools.

**Claude Code**

```sh
claude mcp add --transport http showlager https://<your-host>/mcp --header "Authorization: Bearer sl_…"
```

**Other clients** (Claude Desktop, Cursor, …)

```json
{
  "mcpServers": {
    "showlager": {
      "type": "http",
      "url": "https://<your-host>/mcp",
      "headers": { "Authorization": "Bearer sl_…" }
    }
  }
}
```

The app shows both snippets with the real host and key right after creating a key.

### Tools

Items are addressed by **inventory number** (e.g. `INV-0042`), locations and fixture types by **name**
(case-insensitive, unique partial matches work, e.g. `"lumatek par"`). Read-only keys only see the read tools.

| Tool | Write | Purpose |
|---|---|---|
| `inventory_summary` | | Totals, counts by category/location/condition, items needing attention |
| `search_items` | | Free-text search (all words must match) plus filters: category, location, condition, fixture type, DMX only |
| `get_item` | | Full item: type with modes, location, last DMX address with who/when, photos, GDTF/manual links, history |
| `create_item` | ✓ | New item; the inventory number is assigned and returned |
| `update_item` | ✓ | Change given fields only; `null` clears a field |
| `set_dmx_address` | ✓ | Record the address a fixture is actually set to; checks the range and reports overlaps |
| `get_patch` | | One universe: fixtures with channel ranges, overlaps, free ranges |
| `find_free_address` | | Start addresses where a fixture with N channels fits |
| `list_locations` / `create_location` | / ✓ | Storage locations (often members' homes) |
| `list_fixture_types` / `get_fixture_type` | | Models with modes; full channel layout incl. DMX value ranges |
| `create_fixture_type` | ✓ | Model with hand-entered modes (prefer GDTF) |
| `upload_gdtf` | ✓ | GDTF as base64 (small files); creates or updates the type, modes are read from the file |
| `add_item_photo` | ✓ | Photo as base64 |
| `create_upload_link` | ✓ | One-time URL for larger files, see below |

Conditions in MCP: `ok`, `defective`, `in_repair`, `missing`. Names and categories are free text, usually German
(e.g. *Licht*, *Ton*, *Kabel*); reuse the existing ones from `inventory_summary`.

Tool errors (unknown item, read-only key, invalid value) come back as tool results with `isError: true` and a
message that says what to do next.

## REST API

The REST API is the regular [PocketBase API](https://pocketbase.io/docs/api-records/) under `/api/`.
Lists are paginated (`?page=1&perPage=50`), support `filter`, `sort` and `expand`.

```sh
curl -H "Authorization: Bearer sl_…" \
  "https://<host>/api/collections/items/records?filter=(category='Licht')&sort=inv_no&expand=type,location"
```

### Collections

**`items`** — one entry per item (or per group of identical small parts)

| Field | Type | Notes |
|---|---|---|
| `inv_no` | text | Assigned by the server on create, cannot be changed |
| `name` | text | required |
| `category` | text | free text |
| `type` | relation → `fixture_types` | optional |
| `quantity` | number | default 1 |
| `location` | relation → `locations` | |
| `sublocation` | text | spot within the location (box, shelf, case) |
| `condition` | select | `ok`, `defekt`, `reparatur`, `verschollen` |
| `serial`, `notes` | text | |
| `photos` | files | up to 12 images |
| `dmx_universe`, `dmx_address`, `dmx_mode` | number, number, text | last known setting; address `0` = unknown |
| `dmx_set_at`, `dmx_set_by` | date, relation → `users` | set by the server whenever the DMX fields change |

**`fixture_types`** — models

| Field | Type | Notes |
|---|---|---|
| `manufacturer`, `model` | text | required (filled from the GDTF if omitted) |
| `gdtf` | file | the original GDTF, stored unchanged |
| `image` | file | thumbnail, taken from the GDTF if empty |
| `manual` | files | PDFs |
| `modes` | JSON | `[{ name, footprint, channels: [{ ch, name, attr?, fine?, brk?, fns? }] }]` |
| `color`, `power_w`, `weight_kg`, `notes` | | |

**`locations`**: `name` (unique), `keeper` → `users`, `address`, `notes`.
**`changes`** (read only): `item`, `user`, `via` (API key name), `action` (`create`/`update`), `diff` (`{ field: [before, after] }`).
**`users`** (read only for keys): `name`, `role`. **`settings`** (read only for keys): club name, initials, inventory prefix, label template.

### Examples

Create an item:

```sh
curl -X POST -H "Authorization: Bearer sl_…" -H "Content-Type: application/json" \
  -d '{"name":"PAR 9","category":"Licht","type":"<type id>","location":"<location id>","dmx_universe":1,"dmx_address":65,"dmx_mode":"8ch"}' \
  https://<host>/api/collections/items/records
```

Create a fixture type from a GDTF file (manufacturer, model, modes and image are read from the file):

```sh
curl -X POST -H "Authorization: Bearer sl_…" -F "gdtf=@Robe@Spiider.gdtf" \
  https://<host>/api/collections/fixture_types/records
```

Add a photo to an item:

```sh
curl -X PATCH -H "Authorization: Bearer sl_…" -F "photos+=@front.jpg" \
  https://<host>/api/collections/items/records/<item id>
```

Files are served at `/api/files/<collection>/<record id>/<filename>`.

### Not available for API keys

`DELETE` on anything, the `users` collection (writes), `api_keys`, `settings` (writes), `/api/settings`, backups,
collection schema, batch and realtime endpoints. These return `403` with a reason.

## Uploads (GDTF, manuals, photos)

| Way | Good for |
|---|---|
| REST multipart (`-F file=@…`) | Scripts and agents with shell access |
| MCP `upload_gdtf` / `add_item_photo` (base64) | Small files the agent already holds in memory |
| MCP `create_upload_link` → `curl -F "file=@path" <url>` | Agents with shell access that talk MCP: no base64 in the conversation |

Upload links are valid for 15 minutes and work once. A GDTF upload to a new link creates the fixture type from
the file; with `fixture_type` given it replaces that type's GDTF and modes.

### Helper endpoints

- `POST /api/gdtf/parse` (multipart field `file`): parse a GDTF without saving; returns manufacturer, model, modes and the thumbnail (base64).
- `POST /api/upload/<token>` (multipart field `file`): target of upload links.

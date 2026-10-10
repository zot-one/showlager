# Third-party licenses

The project itself is MIT licensed (see `LICENSE`). It ships or uses the following third-party components.
Full license texts are in `licenses/`.

## Bundled in this repository

| Component | Version | File(s) | License |
|---|---|---|---|
| [htm](https://github.com/developit/htm) | 3.1.1 | `pb_public/vendor/preact-htm.mjs` | Apache-2.0 — `licenses/htm-Apache-2.0.txt` |
| [Preact](https://github.com/preactjs/preact) (bundled inside htm's `preact/standalone` build) | 10.x | `pb_public/vendor/preact-htm.mjs` | MIT — `licenses/preact-MIT.txt` |
| [PocketBase JavaScript SDK](https://github.com/pocketbase/js-sdk) | 0.28.1 | `pb_public/vendor/pocketbase.mjs` | MIT — `licenses/pocketbase-MIT.txt` |
| [uqr](https://github.com/unjs/uqr) (QR code encoder, based on Project Nayuki's QR Code generator) | 0.1.3 | `pb_public/vendor/uqr.mjs` | MIT — `licenses/uqr-MIT.txt` |
| [fflate](https://github.com/101arrowz/fflate) (zip/deflate, used by the server to read GDTF files) | 0.8.2 | `pb_hooks/vendor/fflate.js` | MIT — `licenses/fflate-MIT.txt` |
| [IBM Plex Sans / IBM Plex Mono](https://github.com/IBM/plex) (Latin subset, as distributed by Google Fonts) | — | `pb_public/fonts/*.woff2` | SIL Open Font License 1.1 — `licenses/IBM-Plex-OFL-1.1.txt` |

The vendored files are unmodified except for a one-line license comment at the top.

## Downloaded at build time (not in this repository)

| Component | Version | Where | License |
|---|---|---|---|
| [PocketBase](https://github.com/pocketbase/pocketbase) | 0.40.5 | fetched by `Dockerfile` / README setup step | MIT — same text as `licenses/pocketbase-MIT.txt` (© Gani Georgiev) |

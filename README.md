# Órbita · Oportunidades de Julián

Static personal scholarship and opportunity map. Open `dist/index.html` or serve `dist/` over HTTP. No build or server dependencies.

Data comes from the referenced Santander Fase 2 chat, conversation `6ac2a7af-6ab0-83e8-b804-ad06a8584015`, retrieved October 10, 2026 (America/Mexico_City). Dates and eligibility have not been reverified. Money amounts on historical or future programs are identified accordingly in the detail panel. UMG lines are research topics, not confirmed grants.

The scene uses three orthogonal Cartesian planes: green XY, red XZ and blue YZ, all with 100-unit grid divisions. Right-button hold selects and moves cards, left-button drag pans, and wheel zoom stays anchored to the pointer even during a held right-button drag. Orbit mode or Alt + left drag rotates the camera. Touch and keyboard movement remain available.

Ideas are small fixed cuboids aligned with X, Y and Z, rather than camera-facing cards. The name appears on all six faces. A shared native 3D camera matrix matches the Cartesian projection as the view rotates. Width means X, length/depth means Y, and height means Z.

Selecting an object reveals window-style resize handles: corners scale all three dimensions proportionally around the opposite fixed corner, and side handles change one dimension around its opposite fixed edge. Left dragging a handle resizes; arrow keys also work on a focused handle. Escape cancels an active resize. The inspector offers the same dimensions and exact coordinates. Earlier saved maps shrink once to the new defaults while keeping notes, positions, priorities and statuses.

A stationary left click also selects, while a left drag pans. Selection shows larger contrasting grips plus a quick width/length/height control. The details panel opens explicitly so it cannot cover the selected object by default. Closing details keeps the selection and resize handles.

Movement can follow the screen or be constrained to XY, XZ or YZ. Priority changes preserve manual positions; organizing by importance explicitly rearranges them. Category filters, list view, undo, add/edit/delete, local browser storage and JSON backups remain supported. No automatic monitoring or cross-device synchronization.

## Future opportunities

Add cards to `dist/data.js` with stable unique IDs. New IDs merge into a saved browser map; existing cards keep personal positions, priorities, notes, and statuses. Deleted cards remain deleted through tombstone IDs. The website editor can add cards directly without source changes.

## Data portability

Exports contain cards, positions, dimensions, camera, preferences, and deleted IDs. Imports add or update matching card IDs while preserving other current cards. Earlier maps receive default card dimensions and the new Cartesian camera while retaining their cards, notes, statuses, priorities, positions and deleted IDs. The camera remains local and is reframed after import. Maximum 500 cards and a 3 MB import file. Untrusted text is escaped; links accept HTTP/HTTPS only.

## Color palette

The Colors dialog provides a draggable five-point HSV wheel, five editable swatches, hue/saturation/brightness, HEX and RGB fields, and harmony presets. Colors can target a whole plane, any of its four sign-based sectors, an individual idea, selected ideas, or all ideas. Custom face ink adapts to the face background. Theme, palette and card colors persist locally, participate in undo and travel with JSON exports/imports. Restoring a whole plane also clears its sector overrides.

Connections: Ctrl (or Cmd) plus click toggles cards in the selection, including the spatial view, right-button drag and list. The Connections section in the size panel joins selected cards to a selected central card or the focused card. Each incident line can use a straight, curved or elbow path, dotted/dashed/solid stroke, color wheel or HEX color, thickness and explicit arrows in either direction. A central card forces arrows outward; two central endpoints show arrows at both ends. Line editing is offered only while an endpoint is selected. Connections and central flags persist locally, export/import with the map, follow movement/resize, and participate in undo. Deleting a card removes its incident lines in the same undo step.

## Direct chat control (MCP)

The same Site now serves a dependency-free Cloudflare Worker, public frontend assets, authenticated user-owned D1 maps, and a stateless JSON-RPC MCP endpoint at `/mcp`. The hosting audience is preserved. Public anonymous visitors can keep using local maps. The authenticated chat prepares a temporary one-use connection URL for the current browser map; MCP actions still require dispatch-provided ChatGPT identity. No OpenAI API key or separate voice model is used.

Before the first connection, the current browser map is copied to `orbita-julian-map-v1:before-direct-v1` before migration. No prepared file or example state replaces it. Each shared map is partitioned by Site-scoped user identity and map ID. The visible button `Conectar` explicitly connects/selects its session. Another tab does not steal an active session. Orders fail honestly if the selected view is disconnected, hidden, busy, or changed.

Tools: `orbita_get_active_map`, `orbita_apply_actions`, `orbita_delete_cards`, `orbita_undo`, `orbita_command_status`. Use the map/session IDs returned by the read tool. Each mutation has a request ID, optimistic revision control and one undo entry for a whole batch. Relative moves use the most recently reported camera and viewport; `screen_dy: -100` moves a card upward without panning the camera. The response says applied only after the selected browser session acknowledges the revision. Otherwise it returns a saved/pending status and the same request ID for status lookup.

Foreground sync polls at 800 ms; background polling is slower. The connection reconnects with the same map binding and keeps local edits for reconciliation. Manual edits use field patches and revision checks so unrelated concurrent fields are preserved. Undo is shared across browser and chat edits. No arbitrary JavaScript execution or browser debugging is exposed by the connector.

### Build and local preview

Source frontend files are under `public/`; `worker/service.js` implements the service and MCP tools. Run `npm run build` to embed all assets in `dist/server/index.js`. No dependency installation is needed. Run `node scripts/local-worker.cjs` for a local preview at `http://127.0.0.1:4175`. The preview uses Node SQLite with an isolated in-memory database and a fixed local mock identity; that mock identity is not part of the deployed Worker. Production D1 schema changes are append-only SQL migrations under `drizzle/`.

The Sites-managed plugin is created/refreshed when publishing with the `mcp` capability. Reuse that plugin instead of registering another server or editing Codex internals. If installation is needed, install/connect the personal plugin returned by Sites. A single initial load of the new Site version is required to start the browser channel; routine commands need neither recargas, screenshots nor browser automation.

Validation: one real local browser session acknowledged a direct move in 754 ms. This is a local measurement, not a production latency guarantee. Essential checks cover relative geometry, request deduplication, per-user isolation, manual saves, undo, conflict handling and durable map reconnection.

## One-click connection without web login

Call the existing `orbita_get_active_map({})` tool. When disconnected it returns `connection_url`, `connection_expires_at` and instructions. Open that URL internally in the same existing Site/browser profile; do not display or copy its fragment token. The web erases the fragment before loading assets, displays the trusted MCP account identity, and offers one `Conectar` button. No web sign-in, copied code or manual plugin selection is needed. The six tool names and input schemas are unchanged. The getter now declares readOnlyHint=false because it prepares an expiring connection capability, without creating a map or modifying existing map data.

The 256-bit permission expires after five minutes, is stored only as a SHA-256 hash, and can link exactly one browser map/session to its issuing MCP identity. Preparing another permission revokes unused ones for that identity. Claim and binding are atomic in D1. A retry can recover a lost response only with the same private browser key and session until expiry; another browser cannot replay it. Existing ownership is never changed. Missing saved local data stops the claim instead of uploading sample cards. Latest local edits during the request are reconciled with Core.diff; camera remains local. Connected state requires the live view to acknowledge the current revision.

A 256-bit browser key stays in local storage and travels only in a same-origin HTTPS header. The server stores its SHA-256 hash, scoped to the claimed owner/map. Subsequent visits reuse this binding. The old `orbita_pair_map({pairing_code})` server tool remains for compatibility but codes are absent from the default UI. MCP authentication is Sites-managed. No bypass credentials, paid voice APIs or Codex internals are involved.

Validation: `node scripts/check-connection.cjs` exercises the actual shipped browser controller against the built Worker with an isolated in-memory D1 adapter: authenticated MCP issuance → button claim → latest local map preservation → active acknowledgement, response-loss recovery, missing local map, other-browser replay, owner conflict, expiry, revocation and immediate fragment removal. `node scripts/check-direct.cjs` validates direct action/acknowledgement and existing edit behavior. No real visitor data is used.

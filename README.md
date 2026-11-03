# Órbita · Mapa mental interactivo

Un mapa mental espacial para ordenar ideas de forma más natural, visual e interactiva. En lugar de una lista fija, las ideas ocupan cuadros con profundidad que puedes mover, agrupar, priorizar y conectar dentro de un espacio cartesiano tridimensional.

## Qué puedes hacer

- Crear, editar y eliminar ideas.
- Arrastrar cuadros por el espacio y ajustar ancho, largo y alto.
- Mover la vista, girar la perspectiva y hacer zoom hacia el puntero.
- Seleccionar varios cuadros con **Ctrl + clic** y conectarlos.
- Personalizar la forma, el tipo, el color, el grosor y la dirección de las líneas.
- Marcar un **cuadro central** para dirigir sus flechas hacia las demás ideas.
- Cambiar colores de planos, sectores y cuadros con una rueda y cinco muestras.
- Organizar por importancia, filtrar categorías y alternar entre mapa y lista.
- Deshacer cambios y exportar o importar una copia del mapa en JSON.

## Uso local

Aplicación estática escrita con HTML, CSS y JavaScript, sin dependencias de compilación. Desde la raíz del repositorio:

```sh
python -m http.server 8080 --directory public
```

Abre `http://localhost:8080` en el navegador.

**Controles:** clic izquierdo para seleccionar; Ctrl + clic para selección múltiple; clic derecho sostenido para mover cuadros; arrastre con el izquierdo para mover la vista; rueda para acercar o alejar hacia el puntero. El modo de giro o Alt + arrastre izquierdo cambia la perspectiva.

## Guardado y ejemplo inicial

El mapa se guarda en el navegador mediante `localStorage`. Exporta una copia JSON para conservarlo o llevarlo a otro dispositivo. Los datos personales que cada visitante escriba en el mapa permanecen en su navegador y no se suben al repositorio.

La demostración incluye becas, cursos y programas de emprendimiento como ejemplo de organización. Sus fechas y condiciones son referencias por verificar en las fuentes oficiales; pueden editarse o sustituirse por otras ideas.

## Archivos principales

- `public/index.html` y `public/style.css`: interfaz y diseño adaptable.
- `public/app.js`: mapa, selección, controles, persistencia y edición.
- `public/scene-math.js`: proyección espacial, cámara y dimensiones.
- `public/connection-utils.js`: conexiones y flechas.
- `public/color-utils.js` y `public/palette.js`: color y paleta interactiva.
- `public/data.js`: ideas y relaciones del ejemplo inicial.

Desarrollado como proyecto personal de Julián Ortiz.


## Direct chat control (MCP)

The same Site now serves a dependency-free Cloudflare Worker, public frontend assets, authenticated user-owned D1 maps, and a stateless JSON-RPC MCP endpoint at `/mcp`. The hosting audience is preserved. Public anonymous visitors can keep using local maps. The browser can link one map with a temporary one-use code and a map-scoped browser capability; MCP actions still require dispatch-provided ChatGPT identity. No OpenAI API key or separate voice model is used.

Before the first connection, the current browser map is copied to `orbita-julian-map-v1:before-direct-v1` before migration. No prepared file or example state replaces it. Each shared map is partitioned by Site-scoped user identity and map ID. The visible button `Usar este mapa en el chat` explicitly selects its session. Another tab does not steal an active session. Orders fail honestly if the selected view is disconnected, hidden, busy, or changed.

Tools: `orbita_get_active_map`, `orbita_apply_actions`, `orbita_delete_cards`, `orbita_undo`, `orbita_command_status`. Use the map/session IDs returned by the read tool. Each mutation has a request ID, optimistic revision control and one undo entry for a whole batch. Relative moves use the most recently reported camera and viewport; `screen_dy: -100` moves a card upward without panning the camera. The response says applied only after the selected browser session acknowledges the revision. Otherwise it returns a saved/pending status and the same request ID for status lookup.

Foreground sync polls at 800 ms; background polling is slower. The connection reconnects with the same map binding and keeps local edits for reconciliation. Manual edits use field patches and revision checks so unrelated concurrent fields are preserved. Undo is shared across browser and chat edits. No arbitrary JavaScript execution or browser debugging is exposed by the connector.

### Build and local preview

Source frontend files are under `public/`; `worker/service.js` implements the service and MCP tools. Run `npm run build` to embed all assets in `dist/server/index.js`. No dependency installation is needed. Run `node scripts/local-worker.cjs` for a local preview at `http://127.0.0.1:4175`. The preview uses Node SQLite with an isolated in-memory database and a fixed local mock identity; that mock identity is not part of the deployed Worker. Production D1 schema changes are append-only SQL migrations under `drizzle/`.

The Sites-managed plugin is created/refreshed when publishing with the `mcp` capability. Reuse that plugin instead of registering another server or editing Codex internals. If installation is needed, install/connect the personal plugin returned by Sites. A single initial load of the new Site version is required to start the browser channel; routine commands need neither recargas, screenshots nor browser automation.

Validation: one real local browser session acknowledged a direct move in 754 ms. This is a local measurement, not a production latency guarantee. Essential checks cover relative geometry, request deduplication, per-user isolation, manual saves, undo, conflict handling and durable map reconnection.


## Browser pairing without web login

Press `Conectar con mi chat`, copy the temporary ORBITA code into the authorized chat, and call `orbita_pair_map({pairing_code})`. Codes expire after five minutes and work once. The browser uses a random 256-bit map-scoped key, kept locally and sent only in an HTTPS header. The database stores its hash. No web login screen or secrets in URLs are used. Existing map/view data and edits made while pairing are retained. MCP authentication remains managed by Sites.

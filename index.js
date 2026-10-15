/**
 * Host half of dsh-desktop-skin-studio.
 *
 * The plugin is browser-only: skin application is DOM work performed by the
 * Client bundle, and the durable skin library lives in the page's IndexedDB.
 * This Host half registers exactly one thing — a tiny status route — and its
 * presence is otherwise what makes DSH mount `./client`.
 *
 * ## Why the route exists
 *
 * A Client plugin that never activates is invisible from every other angle: the
 * bundle is served, the script runs, the module registers, and still nothing
 * appears in the UI. When that happened here, the page had no way to report what
 * it saw (the shipped desktop app has no debug console, the Host is
 * auth-gated, and a headless probe of that page is unreliable). So the Client
 * half now POSTs what it observed, and this route hands it back as JSON:
 *
 *   GET /dsh-desktop-skin-studio/status   → the last report, or a "not yet" note
 *
 * The route carries no secrets (a state name, the slot key, a diagnostics
 * summary) and is served on the Host's own HTTP surface like every other app
 * route. The rest of the Host half stays shape-minimal, for the reasons below.
 *
 * - No `Config` export. Cordis validates a plugin's `Config` through
 *   schemastery, so exporting a plain JSON Schema makes `resolveConfig` call
 *   `.validate` on `undefined` and the whole row fails activation.
 * - No `inject` export. The route is optional: on a Host without `webServer`
 *   the row still activates and only the diagnostic is missing.
 */

/** Loader row name, matching the `cordis.patch.yml` insert id. */
export const name = 'dsh-desktop-skin-studio'

/** Route owned by this plugin's status endpoint. */
const STATUS_PATH = '/dsh-desktop-skin-studio/status'

/** Cap on a stored report, so a runaway client cannot grow the row indefinitely. */
const MAX_BODY_BYTES = 64 * 1024

/**
 * Register the status route once a web server exists.
 *
 * @param {object} ctx - host cordis context.
 * @returns {void}
 */
export function apply(ctx) {
  // The marker is deliberate: this runs during profile composition, when no
  // logger is attached yet, and "did the Host half run at all" is the first
  // question any activation problem has to answer. A Host that predates this
  // file (the app was not restarted) prints nothing here, which is itself the
  // answer.
  process.stderr.write('dsh-desktop-skin-studio: host half mounted\n')

  if (typeof ctx.inject !== 'function') {
    process.stderr.write('dsh-desktop-skin-studio: host context exposes no inject(); status route not mounted\n')
    return
  }

  /** Latest report from the page, or undefined before the first POST. */
  let report

  ctx.inject(['webServer'], (scope) => {
    const register = () =>
      scope.webServer.register({
        kind: 'exact',
        path: STATUS_PATH,
        handler: (request, response) => {
          if (request.method === 'POST') {
            const chunks = []
            let size = 0
            request.on('data', (chunk) => {
              size += chunk.length
              if (size > MAX_BODY_BYTES) {
                response.writeHead(413, { 'content-type': 'application/json' })
                response.end('{"error":"report too large"}')
                request.destroy()
                return
              }
              chunks.push(chunk)
            })
            request.on('end', () => {
              try {
                report = JSON.parse(Buffer.concat(chunks).toString('utf8'))
              } catch (error) {
                report = { parseError: String(error) }
              }
              response.writeHead(204)
              response.end()
            })
            return
          }
          const body = JSON.stringify(
            {
              mounted: true,
              received: report !== undefined,
              report:
                report ?? 'no report yet — the Client half has not reached its activation report',
              hint:
                'received:false means the page never reported; the report names the state it reached when it did',
            },
            null,
            2,
          )
          response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
          response.end(body)
        },
      })

    try {
      // Registered inside the web-server scope's own effect, so the route is
      // removed with the service rather than outliving it.
      scope.effect(register, 'dsh-desktop-skin-studio: status route')
      process.stderr.write(`dsh-desktop-skin-studio: status route mounted at ${STATUS_PATH}\n`)
    } catch (error) {
      process.stderr.write(`dsh-desktop-skin-studio: status route failed: ${String(error)}\n`)
    }
  })
}

export default { name, apply }

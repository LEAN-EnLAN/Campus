/**
 * Reading a bundled catalog file over HTTP, with the one check that matters.
 *
 * `response.ok` is not enough. A dev server has no 404 for an unknown path: it
 * serves `index.html` with status 200, so the guard passes and the JSON parser
 * is the thing that fails, with `Unexpected token '<', "<!doctype "...`. That
 * message names the symptom and buries the cause, and the cause — a catalog
 * file the server is not publishing — is the one thing a person needs told.
 *
 * Only HTML is treated as the fallback. A missing or unusual content-type is
 * not evidence of anything, and refusing it would break static hosts that
 * serve JSON without labelling it.
 */
export async function fetchCatalogFile(
  path: string,
  send: (path: string) => Promise<Response> = (p) => fetch(p),
): Promise<string> {
  const response = await send(path)

  if (!response.ok) {
    throw new Error(`no pudimos cargar ${path} (${response.status})`)
  }

  if ((response.headers.get('content-type') ?? '').includes('text/html')) {
    throw new Error(
      `${path} no está publicado: el servidor devolvió la app en su lugar. ` +
        'Generá el catálogo con `pnpm catalog:generate` y reiniciá el servidor.',
    )
  }

  return response.text()
}

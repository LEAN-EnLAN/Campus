/**
 * Shown instead of the app when the build has no Supabase configuration.
 *
 * `src/lib/supabase.ts` throws at import time, before React renders, which used
 * to leave a blank page whose only clue was a console error. This screen has no
 * dependency on that module, so it can always render.
 */
export function ConfigError({ missing }: { missing: readonly string[] }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-xl content-center gap-4 p-6" role="alert">
      <h1 className="text-2xl font-semibold">Campus no está configurado</h1>
      <p className="text-ink-muted text-sm">Faltan estas variables de entorno en el build:</p>
      <ul className="space-y-1">
        {missing.map((name) => (
          <li key={name}>
            <code className="text-sm">{name}</code>
          </li>
        ))}
      </ul>
      <p className="text-ink-muted text-sm">
        Cargalas (en Vercel: Settings → Environment Variables; en tu máquina: el archivo{' '}
        <code>.env</code>) y volvé a desplegar o reiniciá el servidor: los valores se incorporan
        al compilar, no se leen después.
      </p>
    </main>
  )
}

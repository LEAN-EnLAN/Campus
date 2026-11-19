import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { toAssistantError } from '@/lib/ai/errors'
import { cn } from '@/lib/utils'

import {
  briefingQueryKey,
  generateBriefing,
  readCachedBriefing,
  today,
  writeCachedBriefing,
} from './briefing'
import { useAssistantData } from './context'
import { useAssistantSettings } from './storage'

/**
 * "Briefing del día": one paragraph about today, written from the student's
 * real dates and finals. Renders nothing without a key. One call per day per
 * session: the text is cached in sessionStorage and "Actualizar" asks again.
 */

export function BriefingCard({ className }: { className?: string }) {
  const settings = useAssistantSettings()
  // No key, no card: skip every query hook so screens without a key stay untouched.
  if (!settings) return null
  return <BriefingCardBody className={className} />
}

function BriefingCardBody({ className }: { className?: string }) {
  const settings = useAssistantSettings()
  const { data } = useAssistantData()
  const queryClient = useQueryClient()
  const day = today()
  const model = settings?.model ?? 'claude-sonnet-5-5'

  const briefing = useQuery({
    queryKey: briefingQueryKey(day, model),
    enabled: Boolean(settings && data),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const cached = readCachedBriefing(day, model)
      if (cached) return cached
      if (!settings || !data) throw new Error('missing')
      const text = await generateBriefing(settings, data, { signal })
      writeCachedBriefing({ day, model, text })
      return text
    },
  })

  if (!settings) return null

  function refresh() {
    writeCachedBriefing(null)
    void queryClient.refetchQueries({ queryKey: briefingQueryKey(day, model) })
  }

  const loading = briefing.isFetching
  const error = briefing.error ? toAssistantError(briefing.error).message : null

  return (
    <section
      aria-labelledby="briefing-title"
      className={cn('border-rule bg-paper-elevated rounded-2xl border p-5', className)}
    >
      <header className="flex items-center gap-3">
        <span className="bg-accent-soft text-accent-ink flex size-9 shrink-0 items-center justify-center rounded-xl">
          <Sparkles aria-hidden="true" className="size-4" />
        </span>
        <h2 id="briefing-title" className="text-ink flex-1 text-base font-semibold">
          Briefing del día
        </h2>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading || !data}>
          <RefreshCw aria-hidden="true" className={cn(loading && 'motion-safe:animate-spin')} />
          Actualizar
        </Button>
      </header>
      <div aria-live="polite" className="mt-3">
        {error ? (
          <p role="alert" className="text-danger text-sm font-medium">
            {error}
          </p>
        ) : briefing.data && !loading ? (
          <p className="text-ink text-sm leading-relaxed">{briefing.data}</p>
        ) : (
          <p className="text-ink-muted text-sm">Armando tu resumen del día…</p>
        )}
      </div>
      <p className="text-ink-muted mt-3 text-xs">
        Lo escribe Claude con tus fechas y tu plan. Puede equivocarse.
      </p>
    </section>
  )
}

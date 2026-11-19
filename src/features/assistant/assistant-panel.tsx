import { Link } from '@tanstack/react-router'
import { ArrowUp, CalendarPlus, KeyRound, RotateCcw, Sparkles, Square, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { Button, buttonVariants } from '@/components/ui/button'
import { tabbables } from '@/components/ui/tabbable'
import { cn } from '@/lib/utils'

import { useAssistantData } from './context'
import { useAssistantSettings } from './storage'
import type { ItemProposal } from './tools'
import { useAssistantChat, type ChatEntry } from './use-assistant-chat'

export const SUGGESTED_PROMPTS = [
  '¿Qué hago hoy?',
  '¿Qué final me conviene rendir primero?',
  'Armame un plan para esta semana',
  '¿Qué curso el cuatri que viene?',
] as const

/**
 * The study assistant: a right-side sheet on desktop, a bottom sheet on a phone.
 *
 * Modal on purpose (focus trap, Escape, focus restore — the same contract as
 * `Modal`), but kept mounted while closed so a conversation survives closing it.
 */
export function AssistantPanel({
  open,
  onOpenChange,
  onProposeItem,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "Revisar y guardar" on a proposal: open Quick capture with it. Nothing is saved here. */
  onProposeItem: (proposal: ItemProposal) => void
}) {
  const titleId = useId()
  const purposeId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const settings = useAssistantSettings()
  const { data, isLoading } = useAssistantData()
  const chat = useAssistantChat(settings, data)
  const [draft, setDraft] = useState('')

  const close = () => onOpenChange(false)
  const closeRef = useRef(close)
  closeRef.current = close

  // Focus in, Tab trapped, Escape closes, focus back where it came from.
  useEffect(() => {
    if (!open) return
    const restore = document.activeElement as HTMLElement | null
    const timer = window.setTimeout(() => {
      const panel = panelRef.current
      ;(inputRef.current ?? (panel ? tabbables(panel)[0] : undefined))?.focus()
    }, 20)
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = tabbables(panelRef.current)
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      restore?.focus()
    }
  }, [open])

  // Follow the answer as it streams in.
  const lastText = chat.entries.at(-1)?.text
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [chat.entries.length, lastText])

  if (!open) return null

  function submit(text: string) {
    if (!text.trim() || chat.busy) return
    void chat.send(text)
    setDraft('')
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit(draft)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end">
      <div
        aria-hidden="true"
        onClick={close}
        className="bg-ink/25 motion-safe:animate-fade-in absolute inset-0 backdrop-blur-[6px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={purposeId}
        className={cn(
          'border-rule bg-paper-elevated relative flex w-full flex-col border shadow-lg',
          'max-h-sheet rounded-t-3xl md:m-3 md:max-h-none md:w-md md:rounded-3xl',
          'motion-safe:animate-fade-in',
        )}
      >
        <header className="border-rule flex items-start gap-3 border-b px-5 pt-5 pb-4">
          <span className="bg-accent-soft text-accent-ink flex size-10 shrink-0 items-center justify-center rounded-xl">
            <Sparkles aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-ink text-lg font-semibold tracking-tight">
              Asistente
            </h2>
            <p id={purposeId} className="text-ink-muted text-[13px] leading-snug">
              Responde con tus fechas y tu plan. Va directo de este dispositivo a Anthropic.
            </p>
          </div>
          {settings && chat.entries.length > 0 ? (
            <Button
              variant="ghost"
              size="icon-touch"
              onClick={chat.reset}
              aria-label="Nueva conversación"
            >
              <RotateCcw aria-hidden="true" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-touch"
            onClick={close}
            aria-label="Cerrar asistente"
          >
            <X aria-hidden="true" />
          </Button>
        </header>

        {!settings ? (
          <NoKeyState onNavigate={close} />
        ) : (
          <>
            <div
              ref={listRef}
              role="log"
              aria-label="Conversación"
              aria-busy={chat.busy}
              className="flex min-h-48 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-5 py-4"
            >
              {chat.entries.length === 0 ? (
                <Suggestions
                  disabled={!data || chat.busy}
                  loading={isLoading}
                  onPick={submit}
                />
              ) : (
                chat.entries.map((entry) => (
                  <Bubble key={entry.id} entry={entry} onProposeItem={onProposeItem} />
                ))
              )}
            </div>

            <form
              className="border-rule border-t px-4 pt-3 pb-4"
              onSubmit={(event) => {
                event.preventDefault()
                submit(draft)
              }}
            >
              <div className="bg-paper-sunken focus-within:ring-focus flex items-end gap-2 rounded-2xl p-1.5 pl-3.5 focus-within:ring-2">
                <label htmlFor={`${titleId}-input`} className="sr-only">
                  Tu pregunta
                </label>
                <textarea
                  id={`${titleId}-input`}
                  ref={inputRef}
                  rows={1}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onInputKeyDown}
                  placeholder="Preguntá sobre tus materias o fechas…"
                  className="text-ink placeholder:text-ink-faint max-h-32 min-h-11 flex-1 resize-none bg-transparent py-2.5 text-sm leading-relaxed outline-none"
                />
                {chat.busy ? (
                  <Button
                    variant="secondary"
                    size="icon-touch"
                    className="rounded-full"
                    onClick={chat.stop}
                    aria-label="Frenar respuesta"
                  >
                    <Square aria-hidden="true" className="size-3.5 fill-current" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="primary"
                    size="icon-touch"
                    className="rounded-full"
                    disabled={!draft.trim() || !data}
                    aria-label="Enviar pregunta"
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                )}
              </div>
              <p className="text-ink-muted mt-2 px-1 text-xs">
                Puede equivocarse: revisá las fechas antes de guardarlas.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function NoKeyState({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-12 text-center">
      <span className="bg-accent-soft text-accent-ink flex size-14 items-center justify-center rounded-2xl">
        <KeyRound aria-hidden="true" className="size-6" />
      </span>
      <p className="text-ink max-w-72 text-sm leading-relaxed">
        Para usar el asistente, pegá tu clave de Anthropic en Ajustes. Queda solo en este
        dispositivo.
      </p>
      <Link
        to="/settings"
        hash="asistente"
        onClick={onNavigate}
        className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'rounded-full')}
      >
        Configurar el asistente <span aria-hidden="true">→</span>
      </Link>
    </div>
  )
}

function Suggestions({
  disabled,
  loading,
  onPick,
}: {
  disabled: boolean
  loading: boolean
  onPick: (prompt: string) => void
}) {
  return (
    <div className="my-auto flex flex-col gap-4 py-4">
      <p className="text-ink text-base font-medium">¿En qué te doy una mano?</p>
      <ul className="flex flex-wrap gap-2" aria-label="Preguntas sugeridas">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(prompt)}
              className={cn(
                'border-rule bg-paper text-ink min-h-11 rounded-full border px-4 text-left text-sm',
                'hover:border-accent hover:bg-accent-soft transition-colors duration-150',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
      {loading ? <p className="text-ink-muted text-xs">Cargando tu cursada…</p> : null}
    </div>
  )
}

function Bubble({
  entry,
  onProposeItem,
}: {
  entry: ChatEntry
  onProposeItem: (proposal: ItemProposal) => void
}) {
  if (entry.role === 'user') {
    return (
      <div className="bg-accent text-on-tint max-w-[85%] self-end rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
        {entry.text}
      </div>
    )
  }
  const waiting = entry.state === 'streaming' && entry.text === ''
  return (
    <div className="flex max-w-[92%] flex-col gap-2 self-start">
      {waiting ? (
        <p className="bg-paper-sunken text-ink-muted rounded-2xl rounded-bl-md px-4 py-2.5 text-sm">
          <span className="motion-safe:animate-pulse">Mirando tus datos…</span>
        </p>
      ) : entry.text ? (
        <div className="bg-paper-sunken text-ink rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed">
          <RichText text={entry.text} />
          {entry.state === 'streaming' ? (
            <span
              aria-hidden="true"
              className="bg-accent ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 rounded-sm motion-safe:animate-pulse"
            />
          ) : null}
        </div>
      ) : null}
      {entry.proposals.map((proposal, index) => (
        <ProposalCard
          key={index}
          proposal={proposal}
          onReview={() => onProposeItem(proposal)}
        />
      ))}
      {entry.state === 'stopped' ? (
        <p className="text-ink-muted text-xs">Frenaste la respuesta.</p>
      ) : null}
      {entry.state === 'error' ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {entry.error}
        </p>
      ) : null}
    </div>
  )
}

function ProposalCard({
  proposal,
  onReview,
}: {
  proposal: ItemProposal
  onReview: () => void
}) {
  return (
    <div className="border-rule bg-paper rounded-2xl border p-4">
      <p className="text-ink-muted text-xs font-medium tracking-wide uppercase">
        Propuesta · {proposal.kindLabel}
      </p>
      <p className="text-ink mt-1 text-sm font-semibold">{proposal.title}</p>
      <p className="text-ink-muted text-[13px]">
        {[proposal.subjectName, proposal.whenLabel ?? 'Sin fecha'].filter(Boolean).join(' · ')}
      </p>
      <Button variant="primary" size="md" className="mt-3 rounded-full" onClick={onReview}>
        <CalendarPlus aria-hidden="true" />
        Revisar y guardar
      </Button>
      <p className="text-ink-muted mt-2 text-xs">No se guarda nada hasta que confirmes.</p>
    </div>
  )
}

/** Paragraphs, "- " bullets and **bold** — the little Markdown the model uses. No HTML. */
function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (!bullets.length) return
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-1 list-disc space-y-0.5 pl-5">
        {bullets.map((line, i) => (
          <li key={i}>{inline(line)}</li>
        ))}
      </ul>,
    )
    bullets = []
  }
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const bullet = /^\s*(?:[-*•]|\d+\.)\s+(.*)$/.exec(line)
    if (bullet) {
      bullets.push(bullet[1] ?? '')
      continue
    }
    flush()
    if (line.trim() === '') continue
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    blocks.push(
      <p key={`p-${blocks.length}`} className={cn('my-1', heading && 'font-semibold')}>
        {inline(heading?.[1] ?? line)}
      </p>,
    )
  }
  flush()
  return <>{blocks}</>
}

function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    )
}

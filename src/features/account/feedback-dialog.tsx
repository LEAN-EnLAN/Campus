import { useRouterState } from '@tanstack/react-router'
import { Mail, MessageCircleHeart } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'

import { useToast } from '@/components/toast'
import { Button } from '@/components/ui/button'
import { TextareaField } from '@/components/ui/field'
import { Modal, ModalFooter, ModalHeader } from '@/components/ui/modal'
import { useBackend } from '@/lib/backends/context'
import { FEEDBACK_MAX } from '@/lib/backends/types'

import { version as APP_VERSION } from '../../../package.json'

import { FEEDBACK_EMAIL } from './feedback-channel'
import { useSendFeedback } from './queries'

/** "Contanos algo": a few words to the team, with where the student was. */
export function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const titleId = useId()
  const { feedback } = useBackend()

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId}>
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <ModalHeader
          titleId={titleId}
          title="Contanos algo"
          description={
            feedback
              ? 'Una idea, algo que no anda o algo que te gustó. Lo lee una persona del equipo.'
              : 'En el modo Local, Campus no envía nada desde la app.'
          }
          icon={<MessageCircleHeart />}
        />
        {feedback ? <FeedbackForm onDone={onClose} /> : <MailFeedback onClose={onClose} />}
      </div>
    </Modal>
  )
}

function FeedbackForm({ onDone }: { onDone: () => void }) {
  const [body, setBody] = useState('')
  const send = useSendFeedback()
  const toast = useToast()
  const route = useRouterState({ select: (state) => state.location.pathname })

  const empty = body.trim() === ''
  const pending = send.isPending

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (empty || pending) return
    try {
      await send.mutateAsync({ body, route, appVersion: APP_VERSION })
    } catch {
      return // shown below; the text stays so nothing is lost
    }
    setBody('')
    onDone()
    toast.show({ message: 'Gracias, lo leemos' })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextareaField
        label="¿Qué nos querés contar?"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={FEEDBACK_MAX}
        rows={5}
        disabled={pending}
        hint="Junto con tu mensaje enviamos en qué pantalla estabas y la versión de Campus."
      />
      {send.isError ? (
        <p role="alert" className="text-danger text-sm font-medium">
          No pudimos enviar tu mensaje. Probá de nuevo.
        </p>
      ) : null}
      <ModalFooter>
        <Button variant="ghost" disabled={pending} onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={empty || pending}>
          {pending ? 'Enviando…' : 'Enviar'}
        </Button>
      </ModalFooter>
    </form>
  )
}

function MailFeedback({ onClose }: { onClose: () => void }) {
  const subject = encodeURIComponent(`Campus ${APP_VERSION}`)
  return (
    <>
      <p className="text-ink-muted text-sm">Escribinos por email:</p>
      {FEEDBACK_EMAIL ? (
        <a
          className="text-accent-ink inline-flex min-h-11 items-center gap-2 font-medium underline-offset-4 hover:underline"
          href={`mailto:${FEEDBACK_EMAIL}?subject=${subject}`}
        >
          <Mail aria-hidden="true" className="size-4" />
          {FEEDBACK_EMAIL}
        </a>
      ) : null}
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      </ModalFooter>
    </>
  )
}
